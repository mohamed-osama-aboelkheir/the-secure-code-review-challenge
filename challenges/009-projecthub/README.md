# Secure Code Review Challenge #9: ProjectHub

**ProjectHub** is a small project-management service: teams collaborate on projects, track tasks,
and share status reports with stakeholders. Your task is to review it the way you would review a real
service handed to you before launch: build a mental model of what it does and what it should
protect, then find the one flaw that breaks that model.

**Date Posted**: 29-Oct-2026

**Solution Will be Posted**: 12-Nov-2026

---

## The application

- **Users** register and log in. Authentication is a **JWT**: the API takes it as a bearer token, and
  the web UI keeps it in an **HTTP-only cookie**.
- Anyone can create a **project** and becomes its **owner**. Projects are private to their
  **members**; owners and **admins** invite users by username, change member roles, and remove
  members. Invited users accept or decline from their invitations list.
- Members create, update, and delete **tasks** in their projects and assign them to other members.
- Each project has a customizable **status report template** that members can edit and use to
  generate a report at any time.
- The backend is **Spring Boot** (Java 21) with **Spring Security**; data lives in **MongoDB**
  (Spring Data). The same server renders a **server-side HTML UI** (FreeMarker), and the JSON API is
  under `/api`.
- Everything is packaged with **Docker Compose**.

The full source is in this directory. It is a complete, working application — not a snippet. Read
all of it, including its dependencies. Both the web UI and the JSON API are in scope.

## Your mission

1. **Threat-model first.** Before reading line by line, map the system (see the
   [suggested methodology](../../README.md#suggested-methodology)).
2. **Identify** the planted vulnerability.
3. **Exploit** it to prove the impact.
4. **Fix** it — a primary fix plus any defense-in-depth you'd recommend.

## Running the application

Requires Docker + Docker Compose.

```bash
cd challenges/009-projecthub
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

Open <http://localhost:3000/>, register a couple of users, and use the app. There are no seeded
accounts. Stop it with `docker-compose down` (add `-v` to also drop the MongoDB volume).

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control.

## Record your solution

Work through the challenge using the [suggested methodology](../../README.md#suggested-methodology),
and record your findings in your own copy of the
[**solution template**](../../SOLUTION_TEMPLATE.md).

### Please keep it private (no spoilers)

**Do not post the vulnerability, exploit, or fix in GitHub Issues or Discussions until the solution
is published.** Keep your write-up in your own notes so early answers don't spoil the challenge for
others. Post-reveal discussion is very welcome once the solution drops.

---

*The solution — correct answer, why the plausible alternatives don't fit, the "why it looks safe"
analysis, full exploitation steps, the fix, and real-world CVE grounding — will be published with the
next drop, about two weeks out.*
