# Secure Code Review — Challenge #1: Schooled — Solution

# Part I: Review Steps

*The methodology followed to build a mental model of the system before looking for the flaw.*

## 1. Application scope & architecture

Schooled is a course-management platform. Teachers create and manage courses; students browse and enroll; admins have full system access including user management.

**Tech stack:** 
- Node.js
- ExpressJS https://expressjs.com/
- EJS server-rendered UI https://ejs.co/
- PostgreSQL (via `pg` Pool)
- JWT

**Components:**

```
Browser / curl
    │
    ▼
Express (server.js)
    ├── GET /          → EJS render (views/index.ejs) + public/app.js
    ├── /api/auth      → src/routes/auth.js
    ├── /api/courses   → src/routes/courses.js  [authenticateToken]
    └── /api/admin     → src/routes/admin.js    [authenticateToken + requireRole('admin')]
                                │
                                ▼
                        src/store/database.js  →  PostgreSQL
```

**Auth:** JWT signed with `JWT_SECRET`. For the browser UI the token is stored in an `httpOnly SameSite=Strict` cookie; API clients use `Authorization: Bearer`. The `authenticateToken` middleware accepts either. On every request it re-fetches the user from the DB (so revoked users are rejected even if the JWT is still valid).

**Key assets:**
- User PII (email, password hash)
- Course data (teachers own their courses)

---

## 2. Entry points

| Entry point | Method | Auth / role | Notes |
| --- | --- | --- | --- |
| `/api/auth/register` | POST | None | Body: `username`, `email`, `password`, `role` |
| `/api/auth/login` | POST | None | Body: `username`, `password` |
| `GET /` | GET | None (cookie optional) | `?logout` clears the session cookie |
| `/api/courses` | GET | Any authenticated | Lists available courses |
| `/api/courses/:id` | GET | Any authenticated | `:id` from URL |
| `/api/courses/user/enrollments` | GET | Any authenticated | Returns own enrollments |
| `/api/courses` | POST | teacher, admin | Body: title, description, studentLimit, startDate, endDate |
| `/api/courses/:id/enroll` | POST | student, admin | `:id` from URL |
| `/api/courses/:id/enroll` | DELETE | student, admin | `:id` from URL |
| `/api/admin/users` | GET | admin | Lists all users |
| `/api/admin/users/:id` | GET | admin | `:id` from URL |
| `/api/admin/users/:id/promote` | POST | admin | `:id` from URL |

The web UI (`GET /` + `public/app.js`) surfaces all of the above to a browser user; it is an additional attack surface for XSS and CSRF even though it calls the same backend routes.

---

## 3. Dangerous sinks (code & dependencies)

| Sink | Location | Input source |
| --- | --- | --- |
| SQL queries via `pg` Pool | `src/store/database.js` throughout | All user-supplied fields |
| EJS HTML render (`<%= %>`) | `views/index.ejs` | `user.username`, `user.role` (from JWT) |
| DOM mutation | `public/app.js` | API JSON responses (username, email, role, course titles) |


---

## 4. Threat model

### Business-logic vulnerabilities

**Broken Authentication**
All courses and admin routes should only be available to authenticated user.
- `authenticateToken` middleware
- Authentication logic
- JWT misconfig

**Role-Based Authorization**
Some routes are only accessible to specific roles e.g. teacher or admin
- `requireRole` middleware
- role should not come from user input

**Role assignment at registration (primary concern)**
The only way to become `admin` is either (a) to be the seeded admin or (b) to be promoted by an existing admin (`POST /api/admin/users/:id/promote`). The registration endpoint intends to block self-assignment of `admin` via a denylist check. Denylists that operate on the raw input without normalization are inherently fragile — any transformation applied downstream (trim, lowercase, Unicode normalization) can produce a value the denylist was meant to reject.

**Privilege escalation via promotion endpoint**
The `/api/admin/users/:id/promote` endpoint is gated by `requireRole('admin')`, so only an existing admin can call it. However, once the above registration bypass is exploited, the attacker is already admin and can use this endpoint to promote additional accounts.

**Horizontal privilege escalation / IDOR**
- Enrollments endpoint uses `req.user.id` from the verified JWT — no IDOR.
- Admin endpoints return data for any `userId` from the URL, but they are gated by `requireRole('admin')` — no horizontal escalation for non-admins.
- No course ownership check on course retrieval or deletion; a teacher could potentially delete another teacher's course. Lower severity for this challenge.

### Source-to-sink vulnerabilities

**XSS (server-rendered UI)**
Source: `user.username` and `user.role` from the JWT, interpolated in `views/index.ejs`.
Sink: HTML output.
Transformation: EJS `<%= %>` HTML-encodes `<`, `>`, `"`, `&`. A username like `<script>alert(1)</script>` renders as the escaped literal. Clean. https://ejs.co/#docs

**XSS (client JS)**
Source: API JSON responses (username, email, role, course/enrollment data).
Sink: DOM.
Transformation: `public/app.js` uses `textContent` and element properties exclusively — never `innerHTML`. Clean. https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent#differences_from_innertext

**CSRF**
Source: cross-origin request carrying auth state.
Sink: any mutating API endpoint.
Mitigation: the auth cookie is `SameSite=Strict`, so browsers never send it on cross-site requests. A forged cross-site POST arrives without the cookie, fails `authenticateToken`, and gets a 401. API clients use Bearer tokens which CSRF does not affect. Clean. https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#samesite-cookie-attribute

**SQL injection**
Source: all user inputs (username, email, password, role, course fields, URL IDs).
Sink: PostgreSQL via `pg` Pool.
Transformation: parameterized queries (`$1`, `$2`, …) throughout `src/store/database.js`. Clean. https://node-postgres.com/features/queries#parameterized-query


---

## 5. Mitigation review

| Threat | Mitigated? | How / where (file:line) |
| --- | --- | --- |
| XSS via username/role in EJS | Yes | `<%= %>` auto-escaping: `views/index.ejs` throughout |
| XSS via API data in DOM | Yes | `textContent` only: `public/app.js` throughout |
| SQL injection | Yes | Parameterized queries: `src/store/database.js` throughout |
| CSRF | Yes | `httpOnly SameSite=Strict` cookie: `src/routes/auth.js:16-21` |
| Password storage | Yes | bcrypt 10 rounds: `src/routes/auth.js:52` |
| Unauthenticated access to protected routes | Yes | `authenticateToken` middleware: `src/routes/courses.js:10`, `src/routes/admin.js:9` |
| Unauthorized role access | Yes | `requireRole()`: `src/routes/courses.js:52,97,134`, `src/routes/admin.js:9` |
| Clickjacking | Yes | `frameAncestors: ["'none'"]` CSP via helmet: `server.js:37` |
| Inline script injection | Yes | `scriptSrc: ["'self'"]` (no `unsafe-inline`): `server.js:31` |
| Admin self-registration — exact `"admin"` | Yes | `if (role === 'admin')`: `src/routes/auth.js:36` |
| Admin self-registration — whitespace variant (`"admin "`, `"\tadmin"`) | **No** | Guard uses bare `role` (no trim); `createUser` trims before storing. The VALID_ROLES allowlist in `src/store/database.js:4` uses `role.trim()`, letting `"admin "` pass as a recognized role, while the guard at `src/routes/auth.js:36` rejects only exact `"admin"` |
| Admin self-registration — case variant (`"Admin"`) | Yes (accidentally) | `VALID_ROLES.includes(role.trim())` is case-sensitive, so `"Admin"` is rejected at `src/store/database.js:63` |

---

# Part II: Solution

*Finding, exploiting, and fixing the planted vulnerability.*

## 6. Potential vulnerabilities & exploitation

- **Vulnerability class:** Privilege Escalation / Authorization Bypass via inconsistent input normalization
- **Location (file:line):**
  - Guard (no trim): `src/routes/auth.js:36`
  - Allowlist (uses trim): `src/store/database.js:63`
  - Storage (uses trim): `src/store/database.js:66`
- **Why it's exploitable:** The admin guard compares `role === 'admin'` against the raw, untrimmed input. The `createUser` function — and the `VALID_ROLES` allowlist that precedes it — both call `role.trim()`, so `"admin "` (trailing space) is treated as `"admin"` by the DB layer but as something other than `"admin"` by the guard. The attacker registers with `"admin "`, which passes the guard and is stored as `"admin"`. The JWT returned by the register response already carries `role: "admin"` (sourced from the DB row), giving immediate admin access.

**Exploitation steps / PoC:**

```bash
# 1. Register with a trailing space in the role
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"attacker","email":"attacker@evil.com","password":"pass123","role":"admin "}' \
  | jq -r '.token')

# The response user.role is already "admin" and the token encodes that role.

# 2. Immediately call an admin-only endpoint
curl -s -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" | jq .
# → returns the full user list, confirming admin access
```

Other working payloads (all trimmed to `"admin"` by `String.prototype.trim()`):
- `"admin "` (trailing space)
- `" admin"` (leading space)
- `"admin\t"` (tab)
- `" admin "` (both sides)

**Why the obvious alternatives don't fit:**
- *SQL injection:* all queries use parameterized placeholders — no string interpolation.
- *XSS:* EJS `<%= %>` encodes output; client JS uses `textContent`. No injection path.
- *CSRF:* `SameSite=Strict` cookie blocks cross-site requests before they reach a route handler.
- `"Admin"` (capital A): rejected by the `VALID_ROLES` allowlist (`"Admin".trim()` → `"Admin"`, not in the list).

---

## 7. Suggested fix

**Primary fix — normalize before validating (src/routes/auth.js)**

Apply the same normalization to `role` before any check, and use an allowlist (not a denylist) that excludes `admin`:

```javascript
const { username, email, password, role } = req.body;

if (!username || !email || !password || !role) {
  return res.status(400).json({ error: 'All fields are required' });
}

const normalizedRole = role.trim().toLowerCase();
const allowedRoles = ['student', 'teacher'];
if (!allowedRoles.includes(normalizedRole)) {
  return res.status(403).json({ error: 'Cannot register as admin' });
}

// Pass the normalized value downstream so storage is also consistent
const user = await db.createUser(username, email, passwordHash, normalizedRole);
```

This eliminates the inconsistency: the same value is checked and stored.

**Defense-in-depth**

1. **Database CHECK constraint** — enforce valid roles at the storage layer regardless of what the application sends:
   ```sql
   ALTER TABLE users
     ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin'));
   ```
   This would have blocked the exploit even without the application-layer fix.

2. **Remove trim() from createUser** — `createUser` should store exactly what it receives; normalization belongs at the boundary (the route), not in the data layer. Trimming silently in the DB layer is what created the gap.

3. **Encode role in JWT from the normalized value** — the JWT payload currently mirrors whatever `createUser` returns. If normalization is applied before the DB write, the JWT will naturally carry the canonical role string.

---

## 8. Real-world grounding & resources

**Real-world example**
- HashiCorp Vault had multiple authentication/authorization flaws caused by exactly this class of discrepancy — different components handling the same input inconsistently (normalization/parsing mismatches between layers). Write-up: [Cracking the Vault: how we found zero-day flaws in authentication, identity, and authorization in HashiCorp Vault (Cyata)](https://cyata.ai/blog/cracking-the-vault-how-we-found-zero-day-flaws-in-authentication-identity-and-authorization-in-hashicorp-vault/).

**General guidance — other transformations that create the same gap**

The root cause isn't specific to whitespace trimming: any transformation applied *after* a security check, but *before* the value is actually used or stored, can produce this same check/use mismatch. Watch for:

- **Case folding** — checking `role !== 'admin'` but later lowercasing/uppercasing the value (or a case-insensitive downstream comparison, e.g. a case-insensitive DB collation).
- **Unicode normalization** — NFC/NFD normalization, full-width/half-width folding, or homoglyph collapsing performed after validation (e.g. a fullwidth "ａdmin" (U+FF41...) that normalizes to "admin" downstream).
- **URL/percent-decoding** — validating a raw path or parameter, then decoding it again later (double decoding), letting `%2561` etc. resolve into a disallowed value after the check.
- **Path canonicalization** — resolving `..`, symlinks, or redundant separators after an allow/deny check on the raw path (classic path traversal / CWE-647 territory).
- **Trimming/stripping control characters** — leading/trailing whitespace, null bytes, or non-printable characters stripped after validation.
- **Type coercion** — e.g. validating a string form of a value, then coercing to a different type (array, number) that a downstream layer interprets differently (common in loosely-typed languages/frameworks with parameter pollution).
- **Deduplication/collapsing** — collapsing repeated characters or delimiters (e.g. `admin//`, multiple slashes) after the check has already passed.

The general fix pattern is the same regardless of transformation type: **canonicalize/normalize first, validate the canonical form, and pass that same canonical value downstream** — never validate one representation and act on another.

**More resources**
- [CWE-179: Incorrect Behavior Order: Early Validation](https://cwe.mitre.org/data/definitions/179.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

