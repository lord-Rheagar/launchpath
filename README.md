# Launchpath

OAuth launch guidance for developers integrating apps through Composio. Search the prepared GitHub, Slack, and Google/Gmail guides, or research an unfamiliar provider with a DeepSeek agent. Enter an app name and, optionally, its official website. Every research run defaults to a practical OAuth setup and approval guide: difficulty, first test, public launch, effort, waits, requirements, blockers, and agent/human handoffs. Scope- and audience-dependent differences are explained as branches in the guide rather than asked in a questionnaire. New guides retain claim-level source passages, read-only setup-inspection records, and unresolved questions under a stable URL.

## Run locally

Requires Node.js 22 or newer. There are no runtime packages to install.

```powershell
Copy-Item .env.example .env
# Edit .env locally. Do not paste your API key into chat or the research form.
npm start
```

Open http://127.0.0.1:3000. Restart after changing `.env`.

### OpenRouter (one key)

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_private_key
OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash-1017
OPENROUTER_SEARCH_ENGINE=exa
```

The model uses OpenRouter Chat Completions. Without a Tavily key, discovery searches use OpenRouter's web plugin, paid from the same account. Only returned `url_citation` annotations count as search discoveries; model-written links are not accepted as search results. The server then retrieves public source pages directly and extracts text. No second search key is needed. OpenRouter model availability and search charges depend on your account and provider.

### Optional Tavily search and document extraction

Set `TAVILY_API_KEY` in the server's local `.env` to enable independent Tavily search and advanced extraction. `SEARCH_PROVIDER=auto` (default) uses Tavily when configured and the existing model search otherwise. `SEARCH_PROVIDER=model` keeps model search but permits Tavily extraction for unreadable public documents. Tavily search errors or empty results fall back to model search. This does not change the drafting model.

The reader tries direct HTML/Markdown first. It can read serialized document prose from JSON without executing scripts, preserves readable HTML when an advertised Markdown alternative fails, and rejects sign-in screens, access challenges, empty application shells and obvious navigation-only pages as evidence. An optional Tavily advanced extraction is attempted for unreadable documents; only returned page content counts as evidence, never generated search answers. Login-only entry points can still be recorded as setup inspections. Compiled JavaScript/MDX is never executed locally. There is no local browser-rendering worker or PDF parser; Tavily is an external extraction fallback and does not guarantee those pages can be read.

`MAX_TAVILY_REQUESTS=6` caps paid search/extraction requests per run, including at most one transient retry. Long Retry-After values trigger fallback instead of an early retry. Authentication/credit failures disable further Tavily calls in that run. `RETRIEVAL_TIMEOUT_MS=35000` bounds each Tavily request. URLs are screened before remote extraction and returned results must match the requested public URL. The external service performs its own network retrieval; local DNS pinning applies to our direct reader. Retrieval events record outcomes and returned credits without keys or upstream error bodies. Reported credits may omit upstream work after a timeout; this cap is not a dollar budget.

### Evidence coverage before writing

Fresh runs check eight topics: authentication route, registration, permissions, testing, public approval, documented timing, recovery, and Composio support. Each topic is `supported`, `unknown`, `conflicting`, or `not_applicable`. Positive assessments require actual saved passage IDs from the appropriate authority. Missing documentation never proves that OAuth is unsupported or approval unnecessary. Assessments remain automated judgments and final claim review is still required.

Targeted coverage queries use known official scopes; third-party results do not consume the reserved policy-document reads. First-test link selection favors access-token and authorization-code instructions over token revocation. Unclassified discovery leads remain in the audit trail but their raw text and passage IDs are excluded from writing and factual-review contexts. Aliases retain their original mapping when these sources are filtered. A third-party guide cannot establish a provider-policy conflict.

Documented claims supported only by Composio must explicitly name Composio. Sections citing those claims must also name the Composio context, and factual review checks that the wording preserves that limitation. This makes source context explicit; semantic applicability still needs review. Legacy candidate repairs use small section groups with saved progress so that enforcing these checks cannot trigger an oversized whole-guide rewrite.

New blocking review findings receive a focused source check before factual correction, as well as after unresolved correction attempts. A false veto must not rewrite a correct instruction first. Dismissal still requires a real saved passage, and uncertain findings remain blocking.

By default, two searches and three page attempts are reserved **within** the existing four-search/eight-page limits (`COVERAGE_SEARCHES`, `COVERAGE_PAGES`). The checklist directs these reads toward relevant discovered official links and targeted searches. It is assessed at most twice for a fresh run, with a 45-second allowance per assessment and the existing overall model/time caps. An unavailable assessment preserves unknowns and does not itself prevent supported guide sections from being written. Remaining gaps appear in the guide, its research-coverage checklist and Markdown export. Saved-source resumes never run fresh coverage searches; new coverage metadata is retained with the original source dates.

### Direct DeepSeek (alternative)

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_private_key
DEEPSEEK_MODEL=deepseek-flash
```

Uses DeepSeek Chat Completions and its separate `/v1/tools/search` and `/v1/tools/fetch` APIs. Structured calls now request strict JSON schemas and always perform local validation. The configured OpenRouter route has been checked live; direct DeepSeek strict-schema compatibility has not been verified. Unsupported endpoints fail explicitly rather than silently downgrading to ordinary JSON. A valid structure does not prove accuracy.

Official integration references checked 30 October 2026:

- [DeepSeek tool calls](https://api-docs.deepseek.com/guides/tool_calls/)
- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek Search & Fetch](https://api-docs.deepseek.com/guides/search/)
- [OpenRouter web plugin and citation annotations](https://openrouter.ai/docs/guides/features/plugins/web-search)
- [OpenRouter DeepSeek V4.1 Flash October update](https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017)

## Research from the terminal

```powershell
npm run research -- "Notion" --website https://www.notion.com
```

The default research brief is included in the research, writing, correction, and review system prompts in `lib/prompts.mjs` and `lib/agent.mjs`. An ambiguous provider name can still require its official website. Legacy API/CLI requests may supply `audience` (`personal`, `internal`, or `external`), `capability`, `scopes`, and `appType`; existing saved scenarios remain readable. New form submissions use the general setup-and-approval brief without those fields.

To retry drafting from a saved source collection without repeating searches:

```powershell
npm run research -- --from-run RUN_ID
# Force all four writing sections to regenerate while reusing the saved sources:
npm run research -- --from-run RUN_ID --regenerate true
```

The new run preserves the scenario and source retrieval dates, records its parent run, and labels the reused evidence. A saved candidate is revalidated before factual review. It never presents cached research as a new web search, and it creates a new guide version/link.

## Architecture

`server.mjs` serves the existing plain HTML/CSS style, API, and read-only share views. `lib/agent.mjs` owns a single tool-using research loop:

1. Validate scenario and search for provider identity.
2. Let DeepSeek search, read discovered pages, follow retrieved links, and inspect a public registration entry point over HTTP.
3. Record each retrieved source and inspection as it happens.
   Two discovered pages are read before model investigation. Tool investigation uses ordinary tool responses; final checkpoints are locally validated, with a separate strict-schema finalization call if tool turns run out. Official source scopes support provider subdomains and path-scoped hosted repositories; unrelated domain changes require retrieved redirect/link evidence. Article text and advertised Markdown alternatives reduce navigation-heavy/browser-shell retrieval failures.
4. Index saved source text into bounded passages with stable IDs tied to its content hash. Build the guide in four stages: facts/claims, overview, setup, and launch. Each stage requests a strict JSON schema. OpenRouter routing requires parameter support. Evidence IDs are restricted to actual passages; later sections select existing claim IDs. Step destinations select discovered public URLs or remain empty with human navigation instructions.
5. Attach quotations in code from the selected passages. Validate each stage's structure, claim references, supporting passages, step dependencies, destination provenance, and timing labels. Retry only the failed stage once, retaining prior validated sections. If a non-foundation stage still fails, retain independent content and show explicit recovery unknowns. Invalid foundational claims cannot become a factual walkthrough. Legacy guides with literal quotations remain readable and use the existing conservative quotation checks.
6. Review factual support with a separate schema-constrained call to the same model. Findings have explicit blocking/advisory severity and existing claim/source references. Advisory notes appear in the guide and Markdown export. Blocking findings trigger one repair of affected sections and shared claims, a full merged-content audit, then a fresh review. Material factual errors that remain unresolved still withhold the walkthrough; section recovery never treats them as formatting issues.
7. Persist an immutable guide version and link under `/g/:id`.

Saved results expose `resultType:walkthrough` or `resultType:evidence_only`. Evidence-only results are labeled incomplete research and must not count as completed walkthroughs. To audit saved batch observations without paid calls, run `node scripts/audit-browser-check.mjs`; `node scripts/summarize-browser-check.mjs` produces a corrected summary and a separate enriched JSONL while preserving raw observations.

Later walkthrough-reliability fixes use short citation aliases in model requests, resolving to canonical hashed source passages on disk. Factual correction updates affected claims and small section groups instead of rewriting an entire guide. Editorial findings cannot block publication; remaining factual vetoes may receive a focused evidence challenge, with uncertainty preserving the veto. Failed rechecks never silently clear earlier material findings. If only a later requirement remains disputed, a freshly reviewed initial sequence may be saved with `walkthroughExtent:initial_steps_only`, explicitly stopping before that requirement and all downstream instructions. The reader handles self-referencing Markdown alternatives, same-owner repository renames, and failed HTTP-to-HTTPS recovery; page bodies remain bounded at 10 MB and extracted source text at 50,000 characters. No embedded scripts are executed.

Run progress is polled from `/api/runs/:id`. Refreshing `/r/:id` reconnects to the same run. Server restart marks unfinished runs interrupted, preserving evidence. Timeouts save a partial result when sources exist; retrieval failures never produce a fake successful guide.

Data records: `ResearchRun`, `GuideVersion`, `Source`, `Claim`, and `Attempt`. New requests default to `audience:general`, with no invented capability, scopes, or app type. Conditional requirements belong in the guide. Explicit legacy scenario details remain preserved, and new research never overwrites saved versions. Raw source text is stored for auditing but omitted from public API responses; short claim quotations and source metadata are public.

## Evidence and boundaries

- **Documented:** a claimed fact with a retrieved passage. Code checks the passage exists; semantic support still needs review.
- **Inferred:** a recommendation with explicit assumptions.
- **Unknown/conflicting:** evidence is missing or incompatible. Shown prominently in the guide.
- **Generated draft:** never equivalent to a human-reviewed or tested integration.
- **Attempt:** actual read-only HTTP inspection and its outcome. Never an authenticated setup, submitted form, successful connection, or observed setup duration.

The prepared Markdown documents are documentation drafts from the existing project. They cover multiple scenarios and have not been converted into new live-research evidence. The Google document includes Drive and Calendar branches. Use “Research current setup & approval” to create a new general guide with current sources.

## Budgets and failures

### Automatic retries and backup model

DeepSeek remains primary. For OpenRouter runs, the default backup is `qwen/qwen3.6-flash`, using the same key. Temporary connection failures, HTTP 408/429 and server errors get at most two attempts per model, with exponential delay/jitter and Retry-After handling. A wait longer than ten seconds switches to backup rather than retrying early. Per-call timeouts switch immediately; cancelled or expired runs stop. A timeout can still be billed upstream.

After primary recovery fails, missing/truncated output, malformed schema output, model refusal or a missing model can also trigger backup. Local section validation failures use backup for the existing bounded section repair; material factual findings use it for correction. Strict schemas, source audits and final review remain required. Invalid API keys, insufficient credits, forbidden access and invalid requests do not trigger fallback. Once switched, the run stays on backup, so later sections avoid repeating a known failure; the next run starts on DeepSeek again. Search synthesis and research tool calls share this recovery path. Direct DeepSeek configurations receive bounded transport retries but need OpenRouter for the cross-model backup.

Defaults: `MODEL_MAX_ATTEMPTS=2` (maximum 3), `MAX_MODEL_REQUESTS=32` (maximum 64), and `MAX_FALLBACK_REQUESTS=16` (maximum 32), all shared across a run's calls and retries. These are request caps, not dollar spending caps. `OPENROUTER_FALLBACK_MODEL` overrides the backup; `none` disables it. Successful responses record actual model IDs, per-model tokens and API-reported cost when supplied. Recovery events appear in progress, and guide metadata lists the models actually used. Search charges and work billed after a timeout may not appear in reported costs.

To explicitly verify a simulated primary outage using a real paid backup and saved sources:

```powershell
node --env-file-if-exists=.env scripts/verify-fallback.mjs SAVED_RUN_ID
```

This creates a new immutable run/guide, labels the simulated outage, never sends the simulated primary requests to DeepSeek, and bills real backup calls. It does not perform new web searches.

Default: 4 searches, 8 page attempts, 8 agent turns, 10-minute overall timeout, 5-minute model-call timeout, four writing stages with one retry each, and one targeted factual correction. Legacy invalid saved candidates get at most two section-repair attempts. Set `RESEARCH_TIMEOUT_MS` and `MODEL_TIMEOUT_MS` to tune time limits. Section generation adds calls and repeats evidence context, so cost and latency must be measured; the original two-minute product target has not been established. Search, structured drafting, and factual review disable unnecessary reasoning; research uses low reasoning effort. These are limits, not a completeness or 99.8% reliability guarantee. Generation stages never retry an already-aborted run. A per-call timeout may trigger one switch to backup while the overall budget remains; a timed-out provider request may still be billed. Usage reports include input/output tokens returned by successful provider responses. Search charges are additional; no invented per-guide cost is displayed.

HTTP fetching blocks private/reserved addresses, unsafe URL schemes and ports, credentials in URLs, and redirects to unsafe destinations. Direct connections pin the vetted DNS address. Retrieved content is treated as untrusted data and rendered as text; no raw generated HTML is executed. HTTP-only inspection does not support interactive consoles, authenticated pages, PDF extraction, or full JavaScript rendering. Those gaps are reported for human follow-up.

## Deployment and public sharing

Run `npm start` on a Node.js 22+ host with **one instance and a persistent disk**. Set `HOST=0.0.0.0`, `PORT` as required by the host, and `DATA_DIR` to the mounted persistent directory. Leave `RESEARCH_PASSWORD` unset for password-free research; optionally set it to restrict generation. Reader links `/g/:id` remain public without login. Reverse-proxy HTTPS is recommended. Never expose `.env` or the data directory as static files.

Local share links only work on the machine running the server. A public URL requires deployment; no deployment or authenticated provider setup is implied by the local app. Ephemeral serverless filesystems are not supported by this file-store implementation. Move the Store interface to hosted Postgres before horizontal scaling.

## Verify

```powershell
npm run check
```

Tests cover real application orchestration against controlled model/search/page fixtures, API adapters, evidence failures, ambiguity, interrupted/timeout results, persistence, public endpoints, and URL safeguards. Fixtures are test-only dependency injection, never a production fallback. A live provider run additionally requires a valid, funded API key and network access.

See `VALIDATION.md` for verification evidence and remaining work, and `PRODUCT_SCOPE.md` for the broader assignment deliverables.


## Automatic recovery using local storage

No Postgres setup is required. Research submissions are saved to the persistent data directory before a background worker starts them. The worker automatically picks up queued and unfinished runs when the server starts, preserving the original run URL. Up to two runs execute at once. Keep DATA_DIR on a persistent local disk; this mode is intended for one machine, not a shared network filesystem or horizontal scaling.

Completed research checkpoints, source pages, validated writing sections and model responses are reused. Model requests are counted on disk before transmission, so recovery retains the request caps. An interrupted in-flight request can still run or be billed upstream and may need repeating: recovery is not an exactly-once guarantee for external APIs. Recovery stops after five worker attempts. Existing terminal interrupted records from older versions are not automatically revived.

Per-run filesystem locks exclude duplicate workers and detect a dead owner after a process crash. Released and reclaimed lock directories are retained as small ownership records. An incomplete or unreadable lock record is handled conservatively and needs operator inspection; do not delete a live worker's lock. Local JSON checkpoints use atomic replacement. A disk failure or deletion of DATA_DIR cannot be recovered from these files alone; retain backups.

New run records also reserve a stable output guide ID before publication. If a crash happens after the guide is saved, recovery attaches that same guide to its run. Public run responses omit saved model responses and private drafts. No database credentials or runtime packages are required.


## Guide publication policy

The default policy prioritizes writing a guide when readable information is available. Factual review runs once with a 30-second allowance and is advisory: concerns are displayed as notes, never used to discard instructions, trigger repeated factual rewrites or shorten the walkthrough. Unverified citation support is marked unknown. Provider identity and official-source gaps are disclosed rather than vetoing a guide based on readable pages. Source roles remain visible and third-party information is attributed.

Structural repair remains bounded. If the model cannot produce a structured guide, the saved report includes a clearly labeled source guide with retrieved excerpts and links (`resultType:source_guide`, `guideMode:source_digest`). This is distinct from a generated setup walkthrough. No information or successful setup is invented. An unavailable reviewer or a deadline cannot erase an already-written draft. Unsafe URLs are removed, source quotations are checked, and retrieved text remains rendered as text.

This policy supersedes earlier descriptions of blocking factual review, mandatory source ownership gates and withholding disputed instructions. Older saved versions retain their original behavior and labels; reruns create new guide versions.


## Guide readability

Generated guides start with concise answers about difficulty, launch requirements and the next action, followed by connection routes, effort, prerequisites, permissions, ordered setup, completion checks and troubleshooting. Writing instructions request short paragraphs, brief explanations of unfamiliar terms and numbered actions within each step. These are style preferences, not publication gates.

Existing saved guides receive the improved page layout immediately: overview context can expand, step dependencies use titles instead of internal IDs, success conditions and recovery actions are distinct, and evidence quotes are collapsed until requested. Clicking a citation opens its evidence entry. The layout supports narrow screens and uses text rendering rather than generated HTML. New writing style applies to new or regenerated drafts; old saved content is preserved. Markdown exports include numbered step headings and clearly labeled completion checks and fallbacks.


## Direct guide presentation

Guide pages and Markdown exports omit the generated-draft/human-review banner, inline claim links, and the source/evidence/research audit appendices. Internal source records remain available to the workflow. Setup destinations remain actionable links. Writing instructions favor short positive actions, concise answers, and next steps for unresolved requirements, while preserving the meaning of factual restrictions. Updated writing applies to new drafts and regenerations; presentation changes also apply to existing generated guides.


## Prepared-guide house style

The shared writing system prompt now includes editorial patterns distilled from the prepared Slack, GitHub and Google guides (`lib/guide-style.mjs`). New and regenerated drafts lead with practical takeaways, explain route decisions, use precise setup instructions and visible checkpoints, and separate first-test readiness from customer launch. Sparse bold labels and code identifiers help scanning. The examples use placeholders, so another provider's scopes, menu paths and timelines are not presented as evidence for the researched app. The existing JSON contract, hidden citations and advisory publication policy remain in force. Writing and repair calls share the same style instructions.
