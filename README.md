# The Case File — AI Investment Research Agent

An agent that takes a company name, researches it live on the web, and hands back a stamped
**INVEST** / **PASS** verdict with the reasoning behind it — styled as an analyst's case file.

---

## 1. Overview

You type a company name into "The Case File". The agent:

1. Fires five targeted live web searches about the company (business model, recent news,
   funding/valuation, competitors, risks/controversies) via the **Tavily Search API**.
2. Compiles the results into a single research dossier.
3. Sends that dossier to an LLM (**Google Gemini 2.0 Flash**, via **LangChain.js**) with a strict
   analyst system prompt and a structured-output schema.
4. Gets back a JSON verdict — `INVEST` or `PASS`, a confidence score, an executive summary,
   bullet-pointed positives/risks, and a reasoning paragraph — and renders it as a "stamped" memo,
   with the sources it used listed at the bottom.

---

## 2. How to run it

### Requirements
- Node.js 18.18+
- A **free** Google AI Studio API key: https://aistudio.google.com/app/apikey
- A **free** Tavily API key (1,000 searches/month free tier): https://tavily.com

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your keys
cp .env.example .env.local
# then edit .env.local and paste in GOOGLE_API_KEY and TAVILY_API_KEY

# 3. Run it
npm run dev
```

Open http://localhost:3000, type a company name, click **Open case file**.

### Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | https://aistudio.google.com/app/apikey (free tier) |
| `TAVILY_API_KEY` | Yes | https://tavily.com (free tier, 1,000 searches/mo) |

### Deploying (e.g. Vercel)
Push this repo to GitHub, import it in Vercel, add the two environment variables in the Vercel
project settings, and deploy. No other configuration is needed — it's a standard Next.js app.

---

## 3. How it works — approach & architecture

```
User enters "Zomato"
        │
        ▼
POST /api/research  (Next.js Route Handler)
        │
        ▼
lib/agent.ts  → runResearchAgent(companyName)
        │
        ├─ 1. lib/tavily.ts → runResearchQueries()
        │      Fires 5 parallel Tavily searches:
        │        "{company} business model overview revenue"
        │        "{company} latest news 2026"
        │        "{company} funding valuation investors"
        │        "{company} competitors market position"
        │        "{company} risks controversies lawsuit challenges"
        │
        ├─ 2. compileContext()
        │      Merges all hits into one dossier string + a deduped source list
        │
        ├─ 3. LangChain.js pipeline (single call)
        │      ChatPromptTemplate (system + user)
        │        → ChatGoogleGenerativeAI (gemini-2.0-flash)
        │        → .withStructuredOutput(zodSchema)
        │      One model call returns strongly-typed JSON:
        │        { verdict, confidenceScore, executiveSummary,
        │          positives[], risks[], reasoning }
        │
        └─ 4. Verdict + sources returned to the client
               │
               ▼
      Rendered as a stamped case-file memo (React)
```

**Stack used:** Next.js 14 (App Router) for both frontend and the API route, LangChain.js
(`ChatPromptTemplate`, `ChatGoogleGenerativeAI`, `.withStructuredOutput`) for the AI orchestration,
Zod for the output schema, Tailwind CSS for styling.

**Why this shape:**
- The frontend calls one API route, which does all the work server-side — API keys never reach
  the browser.
- The research and the decision are deliberately separated: a plain data-gathering step (Tavily),
  then a single, tightly-scoped LLM call that is *forced* to reason only from that gathered
  context (via the system prompt's "base every claim only on the provided research context" rule)
  rather than from the model's own possibly-stale training data about the company.
- Structured output (Zod schema + `withStructuredOutput`) is used instead of asking the model to
  "return JSON" in prose, so the response is reliably parseable and directly typed in
  `lib/types.ts` — no regex/JSON-fence stripping needed.

---

## 4. Key decisions & trade-offs

| Decision | Why | Trade-off / what's left out |
|---|---|---|
| **Single LLM call**, not a multi-node LangGraph agent | Keeps the pipeline fast, cheap, and easy to reason about/debug for a 7-day scope | No iterative re-searching if the first pass of context is thin; no self-critique loop |
| **Gemini 2.0 Flash** (free tier) | Genuinely free API tier, fast, supports structured output well through LangChain.js | Reasoning depth is a notch below a top-tier reasoning model; no financial-statement-level numeric precision |
| **Tavily called via direct `fetch`**, not the LangChain community `TavilySearchResults` tool wrapper | Keeps the request/response shape fully visible for debugging and avoids an extra dependency surface | Loses the "drop-in LangChain Tool" abstraction — acceptable since the search step is data-gathering, not agentic tool-calling |
| **5 fixed, hand-picked search queries** run in parallel, instead of letting the LLM decide what to search | Predictable, fast (one round-trip), and cheap; guarantees baseline coverage (business model, news, funding, competitors, risk) | Not adaptive — for a very obscure company the same 5 angles may return thin results; a smarter agent would decide follow-up queries based on what it finds |
| **No financial data API** (e.g. stock price/fundamentals feed) | Kept the free-tier footprint to two keys only, per the "free" requirement | The verdict currently reasons from qualitative web content, not hard financial ratios — noted as the top improvement below |
| **`Promise.allSettled`** for search queries | One failed query (e.g. a rate limit) doesn't fail the whole request | Silent partial data — the dossier may look complete even if 1-2 angles returned nothing |
| **Case-file / dossier visual design** instead of a generic dashboard | Reinforces "this is a written judgment with reasoning," not just a score | More illustration-heavy CSS (SVG stamp filter) than a plain data table would need |

**Ambiguities I resolved on my own call (per the assignment's ground rules):**
- The assignment leaves "how it decides" fully open — I chose a binary INVEST/PASS with a
  confidence score, rather than e.g. a 1–5 rating, because the brief explicitly asks for "whether
  to invest or pass."
- "What it researches" was also open — I picked five angles (fundamentals, news, funding,
  competitors, risk) as a reasonable minimum spread for any company type (public, private, or
  startup).

---

## 5. Example runs

> To generate these for submission: run the app locally with your own free API keys (Section 2),
> try it on a few companies, and paste the rendered output/screenshots here. Below is the exact
> shape of what the agent returns, from a real invocation shape (JSON returned by `/api/research`):

```json
{
  "companyName": "Zomato",
  "verdict": "INVEST",
  "confidenceScore": 68,
  "executiveSummary": "Zomato has scaled its food-delivery and quick-commerce (Blinkit) business into consistent profitability, with strong revenue growth offsetting thin restaurant-delivery margins.",
  "positives": [
    "Reported multiple consecutive profitable quarters after years of losses",
    "Blinkit quick-commerce arm is growing revenue faster than the core food-delivery business",
    "Dominant market share alongside Swiggy in India's food-delivery duopoly",
    "Diversified into events/ticketing (District) and B2B supply, reducing single-segment risk"
  ],
  "risks": [
    "Quick-commerce is capital-intensive and competitive (Swiggy Instamart, Zepto, BigBasket)",
    "Regulatory scrutiny on gig-worker classification and commissions could raise costs",
    "Valuation already prices in continued high growth, leaving little room for a slowdown",
    "Dependent on discretionary urban consumer spending"
  ],
  "reasoning": "The dossier shows a company that has crossed into sustained profitability while its newest bet (quick commerce) is growing fastest, which is the strongest signal for a consumer-internet business at this stage. The main counterweight is that quick commerce is a capital-intensive, multi-player race, so today's growth doesn't guarantee tomorrow's margins. On balance, the fundamentals and diversification outweigh the competitive and regulatory risk, supporting a cautious INVEST rather than a high-conviction one — hence the confidence sits at 68, not 90+.",
  "sources": [
    { "title": "Zomato Q3 results...", "url": "https://..." }
  ]
}
```

*(This document intentionally does not fabricate live search results — the numbers/claims above
illustrate the response shape only. Real example runs with live citations should be captured by
running the app and are expected to be added here before final submission.)*

---

## 6. What I would improve with more time

- **Adaptive/multi-step research** (LangGraph): let the agent read the first batch of search
  results and decide what to search next (e.g. dig into a specific lawsuit it just found), instead
  of five fixed queries.
- **A real financial data source** (e.g. a free stock/fundamentals API) for public companies, so
  the verdict can cite hard numbers (P/E, revenue growth, margins) instead of only qualitative
  news/web content.
- **Self-critique pass**: a second, cheap LLM call that checks the first verdict for
  unsupported claims before returning it.
- **Caching**: store recent (company → verdict) results for a few hours to avoid re-spending
  Tavily/Gemini quota on repeat lookups.
- **Streaming the verdict** token-by-token instead of waiting for the full structured response, so
  the "researching…" wait feels shorter.
- **Source-linked claims**: number each positive/risk bullet with the exact source index it came
  from, rather than one shared source list at the bottom.

---

## 7. LLM chat session transcript

*(Bonus section — paste or attach the full chat transcript with the AI you used while building
this, per the assignment's bonus instructions.)*
