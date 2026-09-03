# Secure Code Review Challenge #5: Notekeeper

**Notekeeper** is a personal note-taking web app. Your task is to review it the way you would review
a real service handed to you before launch: build a mental model of what it does and what it should
protect, then find the one flaw that breaks that model.

**Date Posted**: 03-Sep-2026

**Solution Will be Posted**: 17-Sep-2026

---

## The application

Notekeeper is a small note manager:

- **Users** register and log in, then manage their notes (create, view, edit, delete).
- Notes can be **exported to a file** and **imported back** later.
- Data is stored in **PostgreSQL** via the Django ORM.
- The app is a **Django 5.2** project (Python), packaged with **Docker Compose**. It serves a
  server-rendered web UI plus a few JSON endpoints that the pages call with `fetch`.

The full source is in this directory. It is a complete, working application — not a snippet. Read all
of it, including its dependencies.

## Your mission

1. **Threat-model first.** Before reading line by line, map the system (see the
   [suggested methodology](../../README.md#suggested-methodology)).
2. **Identify** the planted vulnerability.
3. **Exploit** it to prove the impact.
4. **Fix** it — a primary fix plus any defense-in-depth you'd recommend.

Capture your findings in the [solution template](../../SOLUTION_TEMPLATE.md) (privately, no spoilers
please).

## Running the application

Requires Docker + Docker Compose.

```bash
cd challenges/005-notekeeper
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

This starts PostgreSQL and the Django app, applies migrations, and seeds two accounts so you can log
in right away.

- Web UI: <http://localhost:8000/>
- Django admin: <http://localhost:8000/admin/>
- PostgreSQL: `localhost:5432`

**Seeded accounts** (created on first boot, see `.env`):

| Role  | Username | Password     |
| ----- | -------- | ------------ |
| User  | `demo`   | `demo12345`  |
| Admin | `admin`  | `admin12345` |

You can also register your own account from the sign-up page.

Stop it with:

```bash
docker-compose down          # add -v to also drop the PostgreSQL volume
```

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control. The `.env.example` you copy holds throwaway dev secrets; never reuse them.

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
