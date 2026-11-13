# Secure Code Review Challenge #10: Ticketee

**Ticketee** is a small Jira-style issue tracker: teams create projects, invite teammates, and move
issues across a board from To Do to Done. Your task is to review it the way you would review a real
service handed to you before launch: build a mental model of what it does and what it should
protect, then find the one flaw that breaks that model.

**Date Posted**: 13-Nov-2026

**Solution Will be Posted**: 27-Nov-2026

---

## The application

- **Users** register and log in.
- Anyone can create a **project**. Projects are private to their **members**, and the project lead
  invites teammates to join.
- Members track **issues** on a board and write their descriptions in **Markdown**.
- The backend is **ASP.NET Core** (.NET 10) with **Razor Pages** for the web UI and a JSON API under
  `/api`; data lives in **PostgreSQL**.
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

Requires Docker + Docker Compose (Windows, macOS and Linux).

```bash
cd challenges/010-ticketee
cp .env.example .env        # throwaway dev secrets — never reuse them
docker-compose up --build
```

Open <http://localhost:3000/>, register a couple of users, and use the app. There are no seeded
accounts. Stop it with `docker-compose down` (add `-v` to also drop the PostgreSQL volume).

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
