# Secure Code Review Challenge #2: Professional

**Professional** is a professional-profile and résumé-generation API. Your task is to review it the
way you would review a real service handed to you before launch: build a mental model of what it
protects, then find the one flaw that breaks that model.

**Date Posted**: 23-Jul-2026

**Solution Will be Posted**: 06-Aug-2026

---

## The application

Professional is a small profile-management platform:

- **Users** can register, create one or more professional profiles (bio + work experience), and
  mark a profile public or private.
- Public profiles are visible to anyone; private profiles are visible only to their owner.
- Users can generate a **PDF résume** from their own profile data.
- Users authenticate with **JWT** tokens.
- Data is stored in **MongoDB**.
- The API is a **Flask** app, packaged with **Docker Compose**.

The full source is in this directory. It is a complete, working application — not a snippet. Read all
of it, including its dependencies.

The application has both a static, browser-based UI (`static/`, served by Flask, calling the same
JSON API with `fetch`) and the JSON API itself — they're the same backend routes, so review both
surfaces.

## Your mission

1. **Threat-model first.** Before reading line by line, map the system (see the prompts below).
2. **Identify** the planted vulnerability.
3. **Exploit** it to prove the impact.
4. **Fix** it — a primary fix plus any defense-in-depth you'd recommend.

For a structured approach, follow the
[suggested methodology](../../README.md#suggested-methodology) and capture your findings in the
[solution template](../../SOLUTION_TEMPLATE.md) (privately, no spoilers please).

## Running the application

Requires Docker + Docker Compose (and `jq` for the examples below).

```bash
cd challenges/002-professional
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

This starts MongoDB and the API.

- Web UI: <http://localhost:5000/> — open in a browser to register/log in, browse and manage
  profiles, and generate a résumé
- API: <http://localhost:5000> (used by the examples below)
- MongoDB: `localhost:27017`

Stop it with:

```bash
docker-compose down
```

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control. The `.env.example` you copy holds throwaway dev secrets; never reuse them.

## Using the API (normal usage)

#### Register and log in

```bash
curl -s -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "jane_doe", "password": "securepass123"}' | jq

TOKEN=$(curl -s -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "jane_doe", "password": "securepass123"}' | jq -r '.token')
```

#### Create a profile

```bash
curl -s -X POST http://localhost:5000/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "bio": "Experienced software engineer with 5 years in web development.",
    "work_experiences": [
      {
        "company": "Tech Corp",
        "role": "Senior Software Engineer",
        "location": "San Francisco, CA",
        "time": "2020-2023",
        "description": "Led development of microservices architecture."
      }
    ],
    "is_private": false
  }' | jq
```

#### Browse and manage profiles (authenticated)

```bash
# List all public profiles
curl -s -X GET http://localhost:5000/profiles | jq

# List my own profiles
curl -s -X GET http://localhost:5000/profiles/my \
  -H "Authorization: Bearer $TOKEN" | jq

# Update a profile I own
curl -s -X PUT http://localhost:5000/profiles/PROFILE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"is_private": true}' | jq
```

#### Generate a PDF résumé

```bash
curl -s -X POST http://localhost:5000/profiles/my/resume \
  -H "Authorization: Bearer $TOKEN" \
  --output resume.pdf
```

## API reference

**Authentication**
- `POST /register` — register a new user
- `POST /login` — log in, returns a JWT

**Profiles** *(`:id` routes take a MongoDB ObjectId)*
- `GET /profiles` — list all public profiles
- `GET /profiles/my` — your own profiles *(authentication required)*
- `POST /profiles` — create a profile *(authentication required)*
- `GET /profiles/:id` — get a profile (private ones are 404 to non-owners)
- `PUT /profiles/:id` — update a profile you own *(authentication required)*
- `DELETE /profiles/:id` — delete a profile you own *(authentication required)*
- `POST /profiles/my/resume` — generate a PDF résumé from your first profile *(authentication
  required)*


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
