# Secure Code Review Challenge #7: Blogger

**Blogger** is a small blogging platform: sign up, publish posts, keep some of them private, and
search across everything you're allowed to see. Your task is to review it the way you would review a
real service handed to you before launch: build a mental model of what it does and what it should
protect, then find the one flaw that breaks that model.

**Date Posted**: 01-Oct-2026

**Solution Will be Posted**: 15-Oct-2026

---

## The application

Blogger is a simple multi-user blog:

- **Users** register and log in. Authentication is a **JWT**: the API returns it as a bearer token,
  and the server-rendered web UI keeps the same token in an **HTTP-only cookie** so you stay logged
  in while browsing.
- Authenticated users **create posts** (title + body), **edit** and **delete** their own, and mark
  any post **private**.
- **Posts are public by default.** A private post is visible, editable, and deletable **only by its
  author** — everyone else should be denied.
- A **full-text search** feature ranks posts by relevance. Results must respect privacy: you should
  see public posts plus your own private ones, and nobody else's private posts.
- Data lives in **PostgreSQL**, accessed through the **Knex** query builder.
- The backend is **Express.js** (Node). The same server also renders a **server-side HTML UI**
  (Nunjucks templates) so the whole app is usable from a browser without touching the API directly.
- Everything is packaged with **Docker Compose**.

The full source is in this directory — `app.js`, `src/` for the API and data layer, and `views/` for
the server-rendered UI. It is a complete, working application — not a snippet. Read all of it,
including its dependencies.

Both surfaces are in scope: the browser UI (`views/`, served by `src/routes/pages.js`) and the JSON
API (`src/routes/`) are the same data seen two ways — the pages are only another consumer of the same
data layer, and the API is also reachable directly.

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
cd challenges/007-blogger
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

This starts PostgreSQL and the app. On first boot the app runs its database migrations automatically,
then starts serving.

- Web UI: <http://localhost:3000/> — open in a browser to register, post, and search
- API: <http://localhost:3000/api> (used by the examples below)
- Health check: <http://localhost:3000/health>
- PostgreSQL: `localhost:5432`

**No accounts are seeded** — create your own from the **Register** page in the UI, or via
`POST /api/auth/register` (both return a working session). The examples below create one.

Stop it with:

```bash
docker-compose down          # add -v to also drop the PostgreSQL volume
```

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control. The `.env.example` you copy holds throwaway dev secrets; never reuse them.

## Using the web UI (normal usage)

Open <http://localhost:3000/> and you can drive the whole service from the browser:

- **Feed** (`/`) — public posts plus your own private posts, newest first. Click a title to open a
  post.
- **My Posts** (`/my-posts`) — just your posts; create, edit, or delete from here.
- **Search** (`/search`) — type a query and submit to see matching posts (public ones and your own
  private ones).
- **Register / Login / Logout** — top-right of the nav bar. Logging in sets the session cookie; a
  private post shows a red left border and a "(private)" label, and only its author sees Edit/Delete.

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

Pass `-H "Authorization: Bearer $TOKEN"` on requests that need authentication.

#### Create a post (public, then private)

```bash
curl -s -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title": "Hello world", "body": "My first post on Blogger."}' | jq

curl -s -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title": "Draft ideas", "body": "For my eyes only.", "is_private": true}' | jq
```

#### Read the feed, your posts, and search

```bash
curl -s http://localhost:3000/api/posts/feed | jq
curl -s http://localhost:3000/api/posts/mine -H "Authorization: Bearer $TOKEN" | jq
curl -s "http://localhost:3000/api/posts/search?q=hello" | jq
```

#### Get, update, and delete a single post

```bash
curl -s http://localhost:3000/api/posts/1 | jq

curl -s -X PATCH http://localhost:3000/api/posts/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"body": "Edited body."}' | jq

curl -s -X DELETE http://localhost:3000/api/posts/1 \
  -H "Authorization: Bearer $TOKEN" | jq
```

## API reference

**Authentication**
- `POST /api/auth/register` — register a new user *(returns a JWT)*
- `POST /api/auth/login` — log in, returns a JWT

**Posts**
- `GET /api/posts/feed` — public posts (plus your private posts when authenticated), newest first
- `GET /api/posts/mine` — list your posts *(requires authentication)*
- `GET /api/posts/search?q=...` — full-text search, respecting privacy rules
- `GET /api/posts/:id` — get a single post *(private posts: author only)*
- `POST /api/posts` — create a post *(requires authentication)*
- `PATCH /api/posts/:id` — update a post *(owner only)*
- `DELETE /api/posts/:id` — delete a post *(owner only)*

**Utility**
- `GET /` and other non-API paths — the server-rendered web UI
- `GET /health` — health check

Authentication is accepted either as an `Authorization: Bearer <token>` header or as the `token`
cookie the web UI sets. Tokens expire after 7 days.

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
