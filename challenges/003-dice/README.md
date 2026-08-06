# Secure Code Review Challenge #3: Dice

**Dice** is a small dice-roller and random-word-selector web app. Your task is to review it the way
you would review a real service handed to you before launch: build a mental model of what it does and
what it should protect, then find the one flaw that breaks that model.

**Date Posted**: 06-Aug-2026

**Solution Will be Posted**: 20-Aug-2026

---

## The application

Dice is a tiny, single-page utility:

- **Roll a single die** or **roll multiple dice** (1–10) and see the results.
- **Random word selector**: submit a list of words (comma- or newline-separated, or via a `?words=`
  URL parameter) and get one picked at random, along with the full list echoed back.
- There is **no authentication and no database** — every request is self-contained.
- The API is an **Express.js** (Node) app; user-supplied words are run through **DOMPurify**
  (backed by **jsdom**) and **Unicode normalization** (`unorm`) before being returned.
- Packaged with **Docker Compose**.

The full source is in this directory. It is a complete, working application — not a snippet. Read all
of it, including its dependencies.

The application has both a static, browser-based UI (`views/index.html`, served by Express, calling
the same JSON API with `fetch`) and the JSON API itself — they're the same backend routes, so review
both surfaces.

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
cd challenges/003-dice
docker-compose up --build
```

- Web UI: <http://localhost:3000/> — open in a browser to roll dice and select a random word
- API: <http://localhost:3000> (used by the examples below)

Stop it with:

```bash
docker-compose down
```

> ⚠️ This app is **deliberately vulnerable**. Run it locally only — never expose it to a network you
> don't fully control.

## Using the API (normal usage)

#### Roll a single die

```bash
curl -s http://localhost:3000/api/roll-dice | jq
# → { "result": 4 }
```

#### Roll multiple dice

```bash
curl -s -X POST http://localhost:3000/api/roll-dices \
  -H "Content-Type: application/json" \
  -d '{"count": 3}' | jq
# → { "results": [2, 5, 1], "count": 3 }
```

#### Select a random word

```bash
# POST (JSON body)
curl -s -X POST http://localhost:3000/api/random-word \
  -H "Content-Type: application/json" \
  -d '{"words": ["apple", "banana", "cherry", "date"]}' | jq

# GET (query parameter)
curl -s "http://localhost:3000/api/random-word?words=apple,banana,cherry,date" | jq
```

```json
{
  "selectedWord": "banana",
  "allWords": ["apple", "banana", "cherry", "date"],
  "originalCount": 4
}
```

You can also drive the word selector straight from the browser, which auto-runs on page load:

```
http://localhost:3000/?words=apple,banana,cherry,date
```

## API reference

- `GET /` — the web UI
- `GET /api/roll-dice` — roll one six-sided die
- `POST /api/roll-dices` — roll `count` dice *(body: `{ "count": N }`)*
- `GET /api/random-word?words=a,b,c` — pick a random word from a comma-separated list
- `POST /api/random-word` — pick a random word *(body: `{ "words": ["a", "b", "c"] }`)*

## Record your solution

Work through the challenge using the [suggested methodology](../../README.md#suggested-methodology),
and record your findings in your own copy of the
[**solution template**](../../SOLUTION_TEMPLATE.md) — copy it into your private notes and fill it in
as you go.

### Please keep it private (no spoilers)

**Do not post the vulnerability, exploit, or fix in GitHub Issues or Discussions until the solution
is published.** Keep your write-up in your own notes so early answers don't spoil the challenge for
others. Post-reveal discussion is very welcome once the solution drops.
