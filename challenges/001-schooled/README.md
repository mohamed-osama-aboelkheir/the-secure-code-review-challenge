# Secure Code Review Challenge #1: Schooled

**Schooled** is a course-management API. Your task is to review it the way you would review a real
service handed to you before launch: build a mental model of what it protects, then find the one
flaw that breaks that model.

**Date Posted**: 06-Jul-2026


**Solution Will be Posted**: 23-Jul-2026

---

## The application

Schooled is a small course platform:

- **Teachers** can create and manage courses.
- **Students** can browse and enroll in courses.
- **Admins** have full system access, including listing and viewing all users.
- Users authenticate with **JWT** tokens.
- Data is stored in **PostgreSQL**.
- The API is an **Express** app, packaged with **Docker Compose**.

The full source is in this directory. It is a complete, working application — not a snippet. Read all
of it.

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
cd challenges/001-schooled
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

This starts PostgreSQL and the API, initializes the schema, and seeds an `admin` user (its random
password is printed in the container logs — you won't need it to solve the challenge).

- Web UI: <http://localhost:3000/> — open in a browser to register/log in, browse and enroll in
  courses, and (as a teacher/admin) manage them. The UI shows your current role and only the actions
  available to that role.
- API: <http://localhost:3000> — the same functionality over JSON (used by the UI and the examples
  below)
- Health check: <http://localhost:3000/health>
- PostgreSQL: `localhost:5432`

The application has both a **server-rendered web UI** and a **JSON API** — they share the same
backend routes, so review both surfaces.

Stop it with:

```bash
docker-compose down
```

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control. The `.env.example` you copy holds throwaway dev secrets; never reuse them.

## Using the API (normal usage)

#### Register a teacher and log in

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "professor_smith",
    "email": "smith@university.edu",
    "password": "securepass123",
    "role": "teacher"
  }' | jq

TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "professor_smith", "password": "securepass123"}' | jq -r '.token')
```

#### Register a student

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student_jane",
    "email": "jane@student.edu",
    "password": "studentpass123",
    "role": "student"
  }' | jq

STUDENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "student_jane", "password": "studentpass123"}' | jq -r '.token')
```

#### Browse and enroll (authenticated)

```bash
# List available courses
curl -s -X GET http://localhost:3000/api/courses \
  -H "Authorization: Bearer $TOKEN" | jq

# Create a course (teacher/admin)
curl -s -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Advanced Web Security",
    "description": "Modern web security threats and defenses",
    "studentLimit": 25,
    "startDate": "2026-09-01",
    "endDate": "2026-12-01"
  }' | jq

# Enroll in a course (student/admin)
curl -s -X POST http://localhost:3000/api/courses/1/enroll \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq
```

## API reference

**Authentication**
- `POST /api/auth/register` — register a new user (roles: `student`, `teacher`; **not** `admin`)
- `POST /api/auth/login` — log in, returns a JWT

**Courses** *(authentication required)*
- `GET /api/courses` — list available courses
- `GET /api/courses/:id` — course details
- `POST /api/courses` — create a course *(teacher/admin)*
- `POST /api/courses/:id/enroll` — enroll *(student/admin)*
- `DELETE /api/courses/:id/enroll` — cancel enrollment *(student/admin)*
- `GET /api/courses/user/enrollments` — your enrollments

**Admin** *(admin only)*
- `GET /api/admin/users` — list all users
- `GET /api/admin/users/:id` — user details
- `POST /api/admin/users/:id/promote` — promote a user to admin


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
