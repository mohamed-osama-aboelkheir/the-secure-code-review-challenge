# Secure Code Review Challenge #6: FileDrop

**FileDrop** is a personal file storage service: you sign in, drop files in, and pull them back out
from anywhere. Your task is to review it the way you would review a real service handed to you before
launch: build a mental model of what it does and what it should protect, then find the one flaw that
breaks that model.

**Date Posted**: 17-Sep-2026

**Solution Will be Posted**: 01-Oct-2026

---

## The application

FileDrop is a small storage platform:

- **Users** register and log in. Authentication is **JWT bearer tokens** — the browser client keeps
  its token and sends it on the `Authorization` header; there is no session cookie.
- Authenticated users **upload files** (up to 10 MB each, 100 MB per account), **list** what they
  have stored, **download** any of it, and **delete** files they no longer want.
- Every account has its **own storage area on disk**; the files in it are private to that account.
- User records live in **MongoDB**; the stored files themselves live on the filesystem.
- The backend is **Express.js** (Node) and the frontend is a **React single-page app** (built with
  Vite) that the same server hosts as static assets and drives entirely through the JSON API.
- Everything is packaged with **Docker Compose**.

The full source is in this directory — `app.js` and `src/` for the API, `web/` for the React client.
It is a complete, working application — not a snippet. Read all of it, including its dependencies.

Both surfaces are in scope: the browser client (`web/src/`) and the JSON API (`src/routes/`) are the
same data seen two ways — the SPA is only a consumer of the API, which is also reachable directly.

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
cd challenges/006-filedrop
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

This starts MongoDB and the app. The first build is a little slow — it compiles the React client in
a separate build stage before starting the server.

- Web UI: <http://localhost:3000/> — open in a browser to sign in, upload, download and delete
- API: <http://localhost:3000/api> (used by the examples below)
- Health check: <http://localhost:3000/health>
- MongoDB: `localhost:27017`

**Seeded accounts** (created on first boot, see `.env`):

| Username | Password     |
| -------- | ------------ |
| `demo`   | `demo12345`  |
| `casey`  | `casey12345` |

You can also create your own account from the sign-up tab.

Stop it with:

```bash
docker-compose down          # add -v to also drop the MongoDB and storage volumes
```

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control. The `.env.example` you copy holds throwaway dev secrets; never reuse them.

## Using the web UI (normal usage)

Open <http://localhost:3000/> and you can drive the whole service from the browser:

- **Sign in** with one of the seeded accounts, or **create an account** from the sign-up tab.
- **Drop a file** on the upload zone (or click it to browse) to store it.
- See everything you have stored, with size, upload time and how much of your quota is used.
- **Download** or **delete** any of your files from the table.

## Using the API (normal usage)

#### Register and log in

```bash
# Register (also returns a token you can use right away)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "jane_doe", "email": "jane@example.com", "password": "securepass123"}' | jq

# Log in later and keep the token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "jane_doe", "password": "securepass123"}' | jq -r '.token')
```

Pass `-H "Authorization: Bearer $TOKEN"` on every subsequent request.

#### Upload a file

```bash
echo "quarterly numbers" > report.txt

curl -s -X POST http://localhost:3000/api/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@report.txt" | jq
```

```json
{
  "message": "File uploaded successfully",
  "file": { "name": "report.txt", "size": 18, "uploadedAt": "2026-09-17T10:00:00.000Z" }
}
```

#### List your files

```bash
curl -s http://localhost:3000/api/files -H "Authorization: Bearer $TOKEN" | jq
```

```json
{
  "files": [{ "name": "report.txt", "size": 18, "uploadedAt": "2026-09-17T10:00:00.000Z" }],
  "usage": { "usedBytes": 18, "quotaBytes": 104857600 }
}
```

#### Download and delete

```bash
curl -s http://localhost:3000/api/files/report.txt/download \
  -H "Authorization: Bearer $TOKEN" \
  --output report-copy.txt

curl -s -X DELETE http://localhost:3000/api/files/report.txt \
  -H "Authorization: Bearer $TOKEN" | jq
```

## API reference

**Authentication**
- `POST /api/auth/register` — register a new user *(returns a JWT)*
- `POST /api/auth/login` — log in, returns a JWT
- `GET /api/auth/me` — the current user *(requires authentication)*

**Files** *(all require authentication)*
- `GET /api/files` — list your files and quota usage
- `POST /api/files` — upload a file *(multipart: `file`)*
- `GET /api/files/:filename/download` — download one of your files
- `DELETE /api/files/:filename` — delete one of your files

**Utility**
- `GET /` — the React web UI (and any other non-API path, for client-side routing)
- `GET /api` — API information
- `GET /health` — health check

**Limits:** 10 MB per uploaded file, 100 MB of storage per account. Tokens expire after 24 hours.

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
