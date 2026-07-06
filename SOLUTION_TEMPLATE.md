# Secure Code Review — Solution Template

> Copy this file into your own **private** notes for each challenge and fill it in as you work.
> Please keep it private until the official solution is released — no public spoilers.

- **Challenge:** <!-- e.g. #1 Schooled -->
- **Date reviewed:**
- **Time spent (optional):**

---

## 1. Application scope & architecture

<!-- What does the app do? What are its assets and trust boundaries? What's the tech stack
     (language, framework, datastore, auth), and how do the components fit together? -->



## 2. Entry points

<!-- Every place untrusted input enters: web pages/forms, backend endpoints/routes, APIs,
     file uploads, background jobs, etc. Note the auth/role required for each. -->

| Entry point | Method | Auth / role | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

## 3. Dangerous sinks (code & dependencies)

<!-- Where could untrusted data cause harm: SQL/NoSQL queries, OS commands, HTML rendering,
     deserialization, file paths, redirects, template engines, vulnerable dependencies, etc. -->



## 4. Threat model

### Business-logic vulnerabilities
<!-- Flaws in the intended rules/flows: authorization gaps, IDOR, privilege escalation,
     workflow bypasses, missing ownership checks, etc. -->



### Source-to-sink vulnerabilities
<!-- Untrusted source reaching a dangerous sink: injection (SQL/OS/etc.), XSS, SSRF, path
     traversal, deserialization, etc. Trace source → transformation → sink. -->



## 5. Mitigation review

<!-- For each threat above, is it mitigated in the code? How and WHERE (file:line)?
     Note things that only *look* mitigated. -->

| Threat | Mitigated? | How / where (file:line) |
| --- | --- | --- |
|  |  |  |

## 6. Potential vulnerabilities & exploitation

<!-- The issue(s) you believe are real. For each: the vulnerability class, the exact code path,
     and your exploitation attempt (steps / commands / payloads) and result. -->

- **Vulnerability class:**
- **Location (file:line):**
- **Why it's exploitable:**
- **Exploitation steps / PoC:**



## 7. Suggested fix

<!-- For each exploitable vulnerability: the primary fix, plus any defense-in-depth. -->


