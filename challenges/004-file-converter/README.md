# Secure Code Review Challenge #4: File Converter

**File Converter** is a document-conversion service: users upload a file, a background job converts
it with Pandoc, and they download the result. Your task is to review it the way you would review a
real service handed to you before launch: build a mental model of what it does and what it should
protect, then find the one flaw that breaks that model.

**Date Posted**: 20-Aug-2026

**Solution Will be Posted**: 03-Sep-2026

---

## The application

File Converter is a small asynchronous conversion platform:

- **Users** register and log in; sessions are cookie-based (`express-session`).
- Authenticated users **upload a document** (`.docx` or `.md`, up to 10 MB) and pick a target
  format.
- Each upload becomes a **conversion job** with its own job ID. The conversion itself runs in the
  background by invoking **Pandoc**.
- Users **poll the job status** by job ID and, once it's `completed`, **download** the converted
  file.
- Data is stored in **MongoDB**; uploads and outputs live on disk in `uploads/`.
- The app is **Express.js** (Node), packaged with **Docker Compose**. It exposes two surfaces over
  the same data: a **JSON API** and a **server-rendered web UI** built with **EJS** templates.

The full source is in this directory. It is a complete, working application — not a snippet. Read all
of it, including its dependencies.

Both surfaces are in scope: the browser UI (`src/routes/ui.js`, `views/`, `public/`) and the JSON
API (`src/routes/auth.js`, `src/routes/convert.js`) are separate route sets backed by the same store
and the same background worker.

## Your mission

1. **Threat-model first.** Before reading line by line, map the system (see the
   [suggested methodology](../../README.md#suggested-methodology)).
2. **Identify** the planted vulnerability.
3. **Exploit** it to prove the impact.
4. **Fix** it — a primary fix plus any defense-in-depth you'd recommend.

Capture your findings in the [solution template](../../SOLUTION_TEMPLATE.md) (privately, no spoilers
please).

## Running the application

Requires Docker + Docker Compose (and `jq` for the examples below).

```bash
cd challenges/004-file-converter
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

This starts MongoDB and the app. The first build is slow — the image installs Pandoc and a LaTeX
distribution so that PDF output works.

- Web UI: <http://localhost:3000/> — open in a browser to register, upload, watch a conversion
  run, and download the result
- API: <http://localhost:3000/api> (used by the examples below)
- Health check: <http://localhost:3000/health>
- MongoDB: `localhost:27017`

Stop it with:

```bash
docker-compose down          # add -v to also drop the MongoDB volume
```

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control. The `.env.example` you copy holds throwaway dev secrets; never reuse them.

## Using the web UI (normal usage)

Open <http://localhost:3000/> and you can drive the whole service from the browser:

- **Register** an account, or **log in** to an existing one.
- **Upload a document** and choose its target format, then **start the conversion**.
- Watch the job page **poll its own status** — it shows a spinner while the job is `pending` or
  `processing` and reveals the download link the moment it reports `completed`.
- Review **previous conversions** on the dashboard and **download** any finished result.

## Using the API (normal usage)

#### Register and log in

```bash
# Register (also logs you in and stores the session cookie in cookies.txt)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "jane_doe", "email": "jane@example.com", "password": "securepass123"}' | jq

# Log in again later with the same cookie jar
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "jane_doe", "password": "securepass123"}' | jq
```

Pass `-b cookies.txt` on every subsequent request to stay authenticated.

#### Submit a conversion job

```bash
printf '# My Document\n\nThis is a test.\n' > document.md

JOB_ID=$(curl -s -X POST http://localhost:3000/api/convert \
  -b cookies.txt \
  -F "file=@document.md" \
  -F "targetFormat=docx" | jq -r '.jobId')

echo "Job ID: $JOB_ID"
```

```json
{
  "message": "Conversion job submitted",
  "jobId": "202608201"
}
```

#### Check the job status

```bash
curl -s http://localhost:3000/api/convert/$JOB_ID -b cookies.txt | jq
```

```json
{
  "jobId": "202608201",
  "status": "completed",
  "targetFormat": "docx",
  "createdAt": "2026-08-20T10:00:00.000Z",
  "outputUrl": "/api/convert/202608201/download"
}
```

Status moves `pending` → `processing` → `completed` (or `failed`); give it a couple of seconds.

#### Download the converted file

```bash
curl -s http://localhost:3000/api/convert/$JOB_ID/download \
  -b cookies.txt \
  --output output.docx
```

## API reference

**Authentication**
- `POST /api/auth/register` — register a new user *(auto-logs in)*
- `POST /api/auth/login` — log in, sets the session cookie
- `POST /api/auth/logout` — destroy the session

**Conversion** *(all require authentication)*
- `POST /api/convert` — submit a job *(multipart: `file`, `targetFormat`)*
- `GET /api/convert/:jobId` — job status
- `GET /api/convert/:jobId/download` — download the converted file

**Web UI** *(server-rendered pages; the conversion pages require a signed-in session)*
- `GET /login`, `POST /login` — log in
- `GET /register`, `POST /register` — create an account
- `POST /logout` — log out
- `GET /dashboard` — upload form plus your previous conversions
- `POST /convert` — submit a conversion from the dashboard form
- `GET /jobs/:jobId` — job page with live status polling
- `GET /jobs/:jobId/download` — download the converted file

**Utility**
- `GET /` — the web UI
- `GET /api` — API information
- `GET /health` — health check

**Supported formats:** input `.docx`, `.md` — output `docx`, `pdf`, `md` (target must differ from
the input format). Max upload size: 10 MB.

## Record your solution

Work through the challenge using the [suggested methodology](../../README.md#suggested-methodology),
and record your findings in your own copy of the
[**solution template**](../../SOLUTION_TEMPLATE.md) — copy it into your private notes and fill it in
as you go.

### Please keep it private (no spoilers)

**Do not post the vulnerability, exploit, or fix in GitHub Issues or Discussions until the solution
is published.** Keep your write-up in your own notes so early answers don't spoil the challenge for
others. Post-reveal discussion is very welcome once the solution drops.

---

*The solution — correct answer, why the plausible alternatives don't fit, the "why it looks safe"
analysis, full exploitation steps, the fix, and real-world CVE grounding — will be published with the
next drop, about two weeks out.*
