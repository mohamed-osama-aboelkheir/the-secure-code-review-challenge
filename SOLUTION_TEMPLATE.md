# Secure Code Review — Solution Template

> Copy this file into your own **private** notes for each challenge and fill it in as you work.
> Please keep it private until the official solution is released — no public spoilers.

- **Challenge:** <!-- e.g. #1 Schooled -->
- **Date reviewed:**
- **Time spent (optional):**

---

## 1. 🗺️ Application scope & architecture

<!-- What does the app do? What are its assets and roles? What's the tech stack (language,
     framework, datastore, auth), and how do the components fit together? -->



## 2. 🚪 Entry points

<!-- Every place untrusted input enters: web pages/forms, backend endpoints/routes, APIs,
     file uploads, background jobs, etc. Note the auth/role required for each. -->

| Entry point | Method | Auth / role | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

## 3. 🎯 Dangerous sinks (code & dependencies)

<!-- Where user input could change behavior / cause harm: SQL/NoSQL queries, OS commands, HTML/DOM
     rendering, template engines, deserialization, file paths, redirects, vulnerable
     dependencies, etc. -->



## 4. 🧩 Threat model

<!-- Apply two categories: business-logic (should be there, isn't — checked per entry point) and
     source-to-sink (shouldn't be there, could be — checked per dangerous sink). -->

### 🔓 Business-logic vulnerabilities
<!-- Checked at every entry point (#2). Things that SHOULD be there but are missing: missing/broken
     authentication, missing/broken authorization (IDOR, missing tenant isolation, privilege
     escalation), missing CSRF protection on mutating calls, workflow bypasses, etc. -->



### 💉 Source-to-sink (injection) vulnerabilities
<!-- Checked at every dangerous sink (#3). Things that SHOULDN'T be there but could be: untrusted
     input reaching a sink and causing SQL/NoSQL injection, XSS, command injection, SSTI, SSRF,
     path traversal, deserialization, etc. Trace source → transformation → sink. -->



## 5. 🔍 Mitigation review

<!-- For each threat above, is it mitigated in the code? How and WHERE (file:line)?
     Note things that only *look* mitigated. -->

| Threat | Mitigated? | How / where (file:line) |
| --- | --- | --- |
|  |  |  |

## 6. 🧪 Potential vulnerabilities & exploitation

<!-- The issue(s) you believe are real. For each: the vulnerability class, the exact code path,
     and your exploitation attempt (steps / commands / payloads) and result. -->

- **Vulnerability class:**
- **Location (file:line):**
- **Why it's exploitable:**
- **Exploitation steps / PoC:**



## 7. 🛠️ Suggested fix

<!-- For each exploitable vulnerability: the primary fix, plus any defense-in-depth. -->


