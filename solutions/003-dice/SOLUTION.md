# Secure Code Review — Challenge #3: Dice — Solution

<table>
<tr>
<td width="100%">

<!-- TODO: YouTube walkthrough — replace VIDEO_ID once recorded/published -->
<a href="https://youtu.be/VIDEO_ID">
  <img src="https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg" align="right" width="240" alt="Watch the walkthrough">
</a>

### 🎥 This solution is explained in detail on my YouTube Channel <img src="../../assets/AppSec_Untangled_Logo.jpg" width="30"> [AppSec Untangled](https://www.youtube.com/@AppSecUntangled)

Full walkthrough of the review process, the finding, and the fix.

[![Watch on YouTube](https://img.shields.io/badge/▶_Watch_the_walkthrough-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/VIDEO_ID)

<!-- TODO: replace the badge link above with the real video URL when published -->

</td>
</tr>
</table>

---

# Part I: Review Steps

*The methodology followed to build a mental model of the system before looking for the flaw. It
mirrors the [suggested methodology](../../README.md#suggested-methodology): scope → entry points →
sinks → threat model → mitigation review.*

## 1. 🗺️ Application scope & architecture

**What it does:** "Dice" is a tiny single-page utility with two features: (a) roll one or several
six-sided dice, and (b) a **random-word selector** — submit a list of words and get one picked at
random, with the full list echoed back. There is **no authentication, no database, no sessions** —
every request is self-contained.

**Tech stack:** Node.js · [Express 5](https://expressjs.com/) · a static HTML/JS UI served by
Express · packaged with Docker Compose. The word selector runs user input through
[DOMPurify](https://github.com/cure53/DOMPurify) (backed by [jsdom](https://github.com/jsdom/jsdom))
and Unicode normalization via [unorm](https://www.npmjs.com/package/unorm) before returning it.

**Roles:** one state only — **anonymous**. Everyone can hit every endpoint. There is no authorization
model to break, so the review weight shifts almost entirely to **injection / output-handling**.

**The libraries in play** (a review reasons about dependencies, not just app code):

| Library | What it is |
| --- | --- |
| **[Express](https://expressjs.com/)** | Minimal Node web framework — `app.get/post(...)` handlers become HTTP endpoints; `express.json()`/`urlencoded()` parse request bodies. |
| **[DOMPurify](https://github.com/cure53/DOMPurify)** | An HTML sanitizer. `DOMPurify.sanitize(str, { ALLOWED_TAGS: [] })` strips **all** HTML tags, returning text with no markup. Server-side it needs a DOM, supplied by jsdom. |
| **[jsdom](https://github.com/jsdom/jsdom)** | A pure-JS DOM implementation so DOMPurify can run outside a browser. |
| **[unorm](https://www.npmjs.com/package/unorm)** | Unicode normalization (`unorm.nfkc(str)` → NFKC form). NFKC applies **compatibility** decomposition + canonical composition, mapping many "look-alike"/compatibility characters to their canonical ASCII equivalents. |

**Key assets:** there's no stored data or credentials to protect. The asset that matters is the
**integrity of the browser session of anyone who uses the app** — i.e. the app must not let one
user's input execute script in another user's browser (XSS).

### 🧭 How the application runs (code flow)

1. **One container.**
   [`docker-compose.yml`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/docker-compose.yml)
   builds the local
   [`Dockerfile`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/Dockerfile)
   (`node:20-alpine`) and publishes `3000:3000`.

2. **`index.js` is the whole backend.**
   It builds a jsdom window and binds DOMPurify to it
   ([`index.js:10-12`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L10-L12)),
   enables JSON + urlencoded body parsing
   ([`:14-15`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L14-L15)),
   and defines the routes.

3. **The dice routes are pure numbers.**
   [`GET /api/roll-dice`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L26-L29)
   and
   [`POST /api/roll-dices`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L32-L39)
   only ever emit integers — no user text is reflected.

4. **The word routes share one helper.**
   Both
   [`GET /api/random-word`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L64-L82)
   and
   [`POST /api/random-word`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L85-L94)
   funnel their word list into
   [`processWords()`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L42-L61),
   which **sanitizes then normalizes** each word and returns them in the JSON response. This helper is
   the heart of the review.

5. **The UI is a static page that renders the JSON.**
   [`views/index.html`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/views/index.html)
   is served at `/`. Its JS calls the same API with `fetch` and writes the response back into the page.
   It also **auto-runs the word selector from a `?words=` URL parameter on page load**
   ([`:245-263`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/views/index.html#L245-L263))
   — meaning a single crafted link drives the whole flow with no clicks.

---

## 2. 🚪 Entry points

Every place untrusted input enters. No auth anywhere, so every row is reachable by anyone.

| Method | Path | Auth | Untrusted input |
| ------ | ---- | ---- | --------------- |
| GET  | [`/`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L21-L23) | None | `?words=` (consumed by client JS on load) |
| GET  | [`/api/roll-dice`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L26-L29) | None | — |
| POST | [`/api/roll-dices`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L32-L39) | None | `count` (JSON body) |
| GET  | [`/api/random-word`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L64-L82) | None | `words` (query string, comma-separated) |
| POST | [`/api/random-word`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L85-L94) | None | `words[]` (JSON body) |

The **web UI** (`GET /` + inline JS) is an additional surface: it takes the same word input from a
textarea **or from the `?words=` URL parameter** and renders the API response into the DOM.

---

## 3. 🎯 Dangerous sinks (code & dependencies)

Where user input could change behavior / cause harm. These are **candidates** — §4/5 decides which are
actually reachable and exploitable.

| #   | Sink                                                                                                             | Location                                                                                                                                                      | Fed from           |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| S1  | **`innerHTML =` with API data** — the selected word and every word in the list are written into the DOM as HTML. | [`index.html:230-237`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/views/index.html#L230-L237) | `words` → API JSON |
| S2  | **`processWords()` sanitize→normalize pipeline** — the server's one and only defense for word text.              | [`index.js:47-51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L47-L51)               | `words`            |
| S3  | Unbounded loop on `count`.                                                                                       | [`index.js:33-37`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L33-L37)               | `count`            |

**A note on S1** — the UI renders API data with `innerHTML`, not `textContent`:

```js
let html = `<div class="selected-word">Selected: ${data.selectedWord}</div>`;   // :230
data.allWords.forEach((word, index) => {
    html += `<div class="word-item">${index + 1}. ${word}</div>`;                // :233
});
resultDiv.innerHTML = html;                                                       // :237
```

If `data.selectedWord` / `word` can contain HTML, that HTML is parsed and executed. The **only** thing
standing between user input and this sink is the server-side `processWords()` pipeline (S2) — so the
whole question becomes: *can a payload survive `processWords()` still containing live HTML?* That is
the focus of the mitigation review.

---

## 4 & 5. 🧩 Threat model & 🔍 mitigation review

Applying both categories — **business-logic** (should be there, per entry point) and **source→sink**
(shouldn't be reachable, per sink) — and verifying each against the code. Each block: the threat →
where it applies → expected mitigation → what the code actually does → verdict. *(The one real finding
is placed last so the flow reads cleanly.)*

### 🔓 Business-logic vulnerabilities

#### Authentication / authorization / IDOR / CSRF
- **Where it applies:** all endpoints.
- **Analysis:** there are no accounts, no sessions, no per-object data, and no state-changing
  server-side resource. Every endpoint is intentionally public and returns only a function of its own
  input. There is no privilege boundary to cross (no IDOR), and no ambient credential a cross-site
  request could ride (no CSRF impact).
- **Verdict:** ✅ Not applicable by design. This app's risk is **not** in its (absent) authz model.

#### Denial of service via unbounded `count`
- **Where it applies:** `POST /api/roll-dices`
  ([`index.js:33-37`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L33-L37)).
- **Expected mitigation:** clamp/validate numeric input to a sane range
  ([OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)).
- **In the code:** `const count = parseInt(req.body.count) || 1;` with **no upper bound**; the UI caps
  it at 10 but the API doesn't, so `{"count": 100000000}` builds a huge array and can pin CPU/memory.
- **Verdict:** ⚠️ Real but **minor** robustness/DoS issue, not the planted flaw. Flagged for hardening
  in §7; carries no confidentiality/integrity impact.

### 💉 Source-to-sink (injection) vulnerabilities

#### DOM XSS in the UI — is the `innerHTML` sink safe? (S1 + S2) — **the finding**

- **Entry points / sinks:** `words` → API → `innerHTML` at
  [`index.html:230-237`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/views/index.html#L230-L237),
  guarded only by `processWords()`
  ([`index.js:47-51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L47-L51)).
- **Expected mitigation:** render untrusted data as **text** (`textContent`), and/or sanitize with a
  vetted library **as the last transformation before output** — never modify sanitizer output
  afterwards
  ([OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html),
  [DOMPurify security goals](https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model)).
- **In the code — the pipeline is run in the wrong order:**
  ```js
  const sanitizedWords = words.map(word => {
      let sanitized = DOMPurify.sanitize(word, { ALLOWED_TAGS: [] });   // 1) strip HTML
      sanitized = unorm.nfkc(sanitized);                               // 2) THEN normalize
      return sanitized;
  });
  ```
  DOMPurify does correctly strip real tags — a literal `<img src=x onerror=alert(1)>` comes back as
  `""`. **But normalization runs *after* sanitization.** NFKC maps many Unicode "compatibility"
  characters onto ASCII HTML metacharacters — e.g. `＜` (U+FF1C FULLWIDTH LESS-THAN) → `<`, `＞`
  (U+FF1E) → `>`. Those fullwidth characters are **not** HTML syntax, so DOMPurify passes them through
  untouched as plain text; the `nfkc()` call then rewrites them into real `<` and `>`, **re-materializing
  a live HTML tag after the sanitizer has already had its say.** The output is then trusted by the UI
  and written via `innerHTML`.
- **This is exactly the anti-pattern OWASP and DOMPurify warn about:** *canonicalize/normalize **before**
  you validate or sanitize, never after* ([CWE-180: Incorrect Behavior Order: Validate Before Canonicalize](https://cwe.mitre.org/data/definitions/180.html)). 
  DOMPurify's own docs state you must treat its output as final and not transform it.
- **Verdict:** ❌ **NOT mitigated.** The sanitizer is bypassed by post-sanitization normalization,
  and the resulting HTML reaches an `innerHTML` sink. Full analysis and PoC in §6.

#### Mutation/other DOMPurify bypasses
- Considered, but unnecessary here: the ordering bug is a far simpler and fully reliable bypass, so no
  mXSS trickery is required.

---

# Part II: Solution

## 6. 🧪 The vulnerability & exploitation

- **Class:** **DOM-based Cross-Site Scripting (XSS)**
  ([CWE-79](https://cwe.mitre.org/data/definitions/79.html)) enabled by a **sanitizer-bypass through
  incorrect order of operations** — normalizing *after* sanitizing
  ([CWE-180: Validate Before Canonicalize](https://cwe.mitre.org/data/definitions/180.html),
  related [CWE-179](https://cwe.mitre.org/data/definitions/179.html)), rooted in
  [CWE-176: Improper Handling of Unicode Encoding](https://cwe.mitre.org/data/definitions/176.html).
- **Root cause:** `processWords()` calls `DOMPurify.sanitize(...)` and **then** `unorm.nfkc(...)`
  ([`index.js:47-51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/index.js#L47-L51)).
- **Sink:** the UI writes the returned words into the page with `innerHTML`
  ([`index.html:230-237`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/views/index.html#L230-L237)).

### 🧠 Why it works

1. The app's only XSS defense is `DOMPurify.sanitize(word, { ALLOWED_TAGS: [] })`, which removes all
   HTML tags. On its own this is sound.
2. But the next line, `unorm.nfkc(sanitized)`, runs **NFKC** normalization on the *already-sanitized*
   string. NFKC is a canonicalizing transform: it folds Unicode "compatibility" characters into their
   canonical equivalents. e.g.
```bash
$ node
Welcome to Node.js v24.16.0.
Type ".help" for more information.
> const unorm = require('unorm');
undefined
> s='𝕒𝕡𝕡𝕝𝕖, 𝕓𝕒𝕟𝕒𝕟𝕒, 𝕔𝕙𝕖𝕣𝕣𝕪'
'𝕒𝕡𝕡𝕝𝕖, 𝕓𝕒𝕟𝕒𝕟𝕒, 𝕔𝕙𝕖𝕣𝕣𝕪'
>  unorm.nfkc(s);
'apple, banana, cherry'
>
```
3. Several of those equivalents are the very characters that make up HTML
   syntax:
	- `＜` — U+FF1C FULLWIDTH LESS-THAN SIGN → NFKC output: `<` — [compart.com/en/unicode/U+FF1C](https://www.compart.com/en/unicode/U+FF1C)
	- `＞` — U+FF1E FULLWIDTH GREATER-THAN SIGN → NFKC output: `>` — [compart.com/en/unicode/U+FF1E](https://www.compart.com/en/unicode/U+FF1E)

4. Because the attacker can write the tag using **fullwidth** characters, DOMPurify never sees a tag — to
   it, `＜img …＞` is ordinary text — so it passes the payload through. The subsequent `nfkc()` then
   converts `＜`→`<` and `＞`→`>`, reconstructing `<img …>` **after** the sanitizer has run.
5. The server returns that string in `selectedWord` / `allWords`, and the browser drops it straight
   into `innerHTML` → the tag is parsed and its event handler executes.

> ⚠️ **Why `<img onerror>` and not `<script>`.** A payload like `＜script＞…＜/script＞` normalizes to a
> real `<script>` tag too, but HTML5 does **not** execute `<script>` elements inserted via `innerHTML`
> ([MDN — Security considerations](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#security_considerations)).
> For an `innerHTML` sink the reliable primitives are event-handler tags such as `<img src=x onerror=…>`
> or `<svg onload=…>`, which is why the PoC below uses `<img onerror>`.

### 🔬 Proving the bypass at the sanitizer (isolated)

Running just the `processWords` transform on two inputs makes the flaw unmistakable — a real tag is
killed, the fullwidth tag is *revived*:

```
INPUT       : "<img src=x onerror=alert(1)>"      (real ASCII tag)
afterPurify : ""                                   ← DOMPurify strips it ✔
afterNFKC   : ""

INPUT       : "＜img src=x onerror=alert(1)＞"      (fullwidth tag)
afterPurify : "＜img src=x onerror=alert(1)＞"      ← passes through as "text"
afterNFKC   : "<img src=x onerror=alert(1)>"       ← normalization revives the tag 💥
```

### 🚀 Exploitation steps / PoC

**A. Server reflects live HTML (tested with `curl`).** Both endpoints reconstruct the tag:

```bash
# POST (JSON body). --data-binary preserves the multibyte UTF-8 characters.
curl -s -X POST http://localhost:3000/api/random-word \
  -H "Content-Type: application/json" \
  --data-binary '{"words": ["＜img src=x onerror=alert(document.domain)＞"]}'
# → {"selectedWord":"<img src=x onerror=alert(document.domain)>",
#     "allWords":["<img src=x onerror=alert(document.domain)>"],"originalCount":1}

# GET (query parameter) — same result
curl -s "http://localhost:3000/api/random-word" --get \
  --data-urlencode 'words=＜img src=x onerror=alert(1)＞'
# → {"selectedWord":"<img src=x onerror=alert(1)>", ...}
```

The response contains a **real** `<img onerror=…>` tag — the sanitizer has been bypassed server-side.

**B. One-click XSS in a victim's browser (delivery via `?words=`).** The UI auto-runs the selector
from the URL on page load ([`index.html:245-263`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/003-dice/views/index.html#L245-L263))
and renders the result with `innerHTML`, so a single link is a complete reflected/DOM-XSS:

```
http://localhost:3000/?words=%EF%BC%9Cimg%20src%3Dx%20onerror%3Dalert(document.domain)%EF%BC%9E
```

`%EF%BC%9C` / `%EF%BC%9E` are the UTF-8 encodings of `＜` / `＞`. When a victim opens the link, the
page POSTs the fullwidth payload, the server returns `<img src=x onerror=alert(document.domain)>`, the
UI assigns it to `innerHTML`, the image fails to load, and `onerror` fires → arbitrary JavaScript in
the victim's origin.

![XSS proof-of-concept — the injected `onerror` handler fires an alert in the victim's browser](xss-poc.png)

**Impact:** any script the attacker chooses runs in the origin of anyone who opens the crafted link —
cookie/token theft (none here, but in a real app that's session hijack), keylogging, request forgery
against same-origin endpoints, phishing overlays, drive-by actions. Because there's no auth, the
delivery is trivial: just get a victim to click a URL.

---

## 7. 🛠️ Suggested fix

**Primary fix — normalize *before* you sanitize, and make the sanitizer the last step.** Canonicalize
first so DOMPurify sees the final characters and can strip them:

```js
const sanitizedWords = words.map(word => {
    const normalized = unorm.nfkc(word);                 // 1) canonicalize FIRST
    return DOMPurify.sanitize(normalized, { ALLOWED_TAGS: [] }); // 2) THEN sanitize (last transform)
});
```
With this order, `＜img …＞` normalizes to `<img …>` *before* DOMPurify runs, so DOMPurify strips it to
`""` — the bypass is closed.

**Defense-in-depth (do these too — never rely on a single control):**

1. **Fix the output sink — treat data as text, not HTML.** The UI should never build HTML by string
   concatenation of API data. Use `textContent` / DOM APIs so a stray `<` can't start a tag:
   ```js
   const sel = document.createElement('div');
   sel.className = 'selected-word';
   sel.textContent = `Selected: ${data.selectedWord}`;
   resultDiv.replaceChildren(sel);
   // build each word row with document.createElement + textContent as well
   ```
   This alone would neutralize the payload even with the server bug present — output encoding at the
   sink is the most robust XSS control
   ([OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)).
2. **Add a Content-Security-Policy.** A restrictive CSP (e.g. `default-src 'self'; script-src 'self';
   object-src 'none'; base-uri 'none'`) blocks inline event handlers like `onerror=` from executing,
   containing a missed sink
   ([MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)).
   Note the current page uses inline `on*` handlers, so adopting CSP means moving that JS out of
   attributes.
3. **Input validation / allow-listing** on the word fields — length caps and a character allow-list
   (e.g. letters/digits/limited punctuation) make it far harder to smuggle markup at all
   ([OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)).
4. **Clamp `count`** on `POST /api/roll-dices` (e.g. `Math.min(Math.max(1, count), 10)`) to close the
   unbounded-loop DoS noted in §4/5.

---

## 8. 🌍 Real-world grounding & resources

- **The core lesson — order of operations in a sanitization pipeline.** Any transform that runs *after*
  a sanitizer can reintroduce dangerous syntax the sanitizer removed. Canonicalize/normalize/decode
  **first**, validate/sanitize **last**. This is codified as
  [CWE-180: Incorrect Behavior Order: Validate Before Canonicalize](https://cwe.mitre.org/data/definitions/180.html)
  and [CWE-179: Incorrect Behavior Order: Early Validation](https://cwe.mitre.org/data/definitions/179.html);
  the outcome here is [CWE-79 (XSS)](https://cwe.mitre.org/data/definitions/79.html).
- **DOMPurify's own guidance** explicitly warns that you must **not modify its output** afterwards and
  that it should be the final step — post-processing (like normalization) voids its guarantees.
  [DOMPurify — Security Goals & Threat Model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model).
- **Unicode normalization as a security-relevant transform.** NFKC deliberately folds compatibility
  characters (fullwidth, ligatures, circled forms, etc.) to canonical equivalents — which is exactly
  why applying it to untrusted data at the wrong time changes the string's meaning. Mishandling
  Unicode this way is its own weakness class:
  [CWE-176 — Improper Handling of Unicode Encoding](https://cwe.mitre.org/data/definitions/176.html).
  [Unicode UAX #15 — Normalization Forms](https://unicode.org/reports/tr15/) ·
  [UTR #36 — Unicode Security Considerations](https://unicode.org/reports/tr36/) ·
  [Unicode Security FAQ](https://unicode.org/faq/security.html) ·
  [MDN — `String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize).
- **OWASP** — [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
  · [DOM-based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
  · [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  · [Unicode Security (community)](https://owasp.org/www-community/vulnerabilities/Unicode_Security)
  · [A03:2021 – Injection](https://owasp.org/Top10/A03_2021-Injection/).
- **Hands-on learning** — [PortSwigger Web Security Academy — Cross-site scripting](https://portswigger.net/web-security/cross-site-scripting)
  (labs on reflected/DOM XSS and filter bypasses).

**Takeaway:** the individual pieces are all "correct" — DOMPurify strips tags, NFKC normalizes text —
but the **sequence** is wrong. Sanitizing and *then* normalizing lets fullwidth `＜…＞` walk past the
sanitizer and get rewritten into a live `<…>` tag, which an `innerHTML` sink happily executes. The
fix is one swap (normalize → sanitize) plus output encoding at the sink. **The lesson: a sanitizer is
only as good as its position in the pipeline — canonicalize before you validate, and never touch the
sanitizer's output.**
