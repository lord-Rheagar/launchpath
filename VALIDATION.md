# Agent implementation validation

## Document retrieval and coverage, 31 October 2026

**113 automated tests pass.** Added checks cover unreadable/login/challenge pages; safe serialized document prose; original HTML surviving a failed Markdown alternative; optional Tavily extraction and independent search; HTTP 200 per-URL failures; unrelated/private destinations; cancellation, bounded responses, retries and shared request caps; official passage references, coverage recovery and visible unknowns; preservation of aliases when third-party leads are excluded from generation and review; explicit Composio context in claims and sections supported by Composio; small legacy-candidate repairs retaining earlier completed sections after a later failure; challenging new blocking findings before allowing them to rewrite correct instructions.

Public-page smoke checks retrieved usable Calendly (5,319 characters), Mailchimp (14,322), Deel (17,976), and Bexio (50,000, explicitly truncated) documentation. See `test-results/retrieval-smoke-2026-10-31.json`. Repeat with `node scripts/verify-retrieval.mjs`; this script makes no model or paid extraction calls.

Tavily is implemented and tested with controlled API responses. No Tavily key was present locally, so live Tavily access has not been verified. The existing OpenRouter search remains operational without that key. This increment retains the single-process file store; durable jobs and Postgres have not been migrated.

Release verification run `7b18741d-c3b1-45ed-8eb9-5244266b0f57` reuses the fresh Calendly source collection, preserves retrieval dates, and performs no new searches. Guide `/g/3b927235-4b35-413c-b32d-287a508d903d` has ten steps, passes the current code audit, and has a completed automated review with no blocking findings. The permissions section explicitly separates provider and Composio behavior. Token-request precision remains an advisory review note; automated review is not proof of correctness. The earlier fresh run and intermediate drafts exposed the authority/reviewer-order defects and are not counted as successful release runs. See `test-results/retrieval-coverage-implementation-2026-10-31.md` for scope and limitations.

## Post-fix rerun failures — 31 October 2026

The next supplied 49-app batch contained 27 walkthroughs, 21 evidence-only results and one no-source failure. Eleven missing walkthroughs shared a truncated factual-correction response. Repairs now update only affected claims and smaller section groups, preserving other claim IDs and revalidating/reviewing the merged result. Citation aliases are short in model requests and resolve to immutable hashed passages on disk. Repository redirects retain same-owner scope. Markdown readers ignore already visited alternative links; failed HTTP docs can retry HTTPS, and a bounded 10 MB body limit accommodates large API documentation while keeping extracted text capped.

Fixed false editorial vetoes and added a focused source-backed challenge of remaining vetoes. Unavailable correction rechecks retain prior material findings. Valid initial steps may survive a later disputed requirement only after downstream removal, audit and a fresh review. Research coverage summaries no longer supply factual claims to the writer. **85 tests pass.**

Live saved-evidence verification restored Attio `/g/791ee284-80ea-4ea9-811e-197ded899b5e` (9 steps), Discord `/g/bdc04230-c8ac-4403-83b2-41a8a786239f` (9 steps), and PowerPoint `/g/56c16fb2-e09e-490d-9b14-492806e5cb57` (12 steps). Each has completed automated review without blocking findings, with advisory/unknown notes retained. Real documentation retrieval succeeded for Calendly, Mailchimp, Deel and Bexio. Calendly's live guide still had a material review finding; MongoDB's conflicting instructions were not certified resolved. Epic's inspected documentation remained JavaScript-only. Full findings and limits are recorded in `test-results/launchpath-rerun-fixes-2026-10-31.md`; no new 49-app success rate is claimed.

## 49-app batch failures — 31 October 2026

Reviewed all original records: 35 failures with zero page reads, one premature Miro clarification, five evidence-only results, and eight walkthroughs with unknowns. Fixed early checkpoint acceptance, tool/checkpoint schema coupling, missing finalization on exhausted tool turns, scoped hosted-repository classification, www/parent-domain identity matching, source extraction/advertised Markdown alternatives, and misleading batch result counts. Foundation recovery placeholders no longer enter semantic correction. **73 tests pass**.

Targeted live verification produced Asana `/g/a784252e-5819-4100-bb4b-ee50c979573d` (12 steps, seven sources), Miro `/g/b6bd9aa9-a8a1-4f96-b3cc-c42c2b4d712b` (10 steps, eight sources), and Basecamp `/g/16745238-c7b7-4706-8026-032b41b625c9` (10 steps, four reused sources). Each completed automated review with no blocking findings; advisory notes and unknowns remain. This does not claim all 49 fresh runs now succeed. See `test-results/launchpath-fixes.md` and `test-results/browser-check-audit.json` for the full diagnosis and verification limits.

## Automatic retry and backup recovery — 31 October 2026

Final checks: **63 tests passed**. Live simulated-outage run `b9b81eca-cdc8-42ad-801f-886d6f4a6c58` produced `/g/3d187691-8d44-425d-8fb0-a19a7cb43df0`, an 8-step, 13-claim partial draft attributed to Qwen3.6 Flash. Facts and overview passed immediately; setup recovered missing fallback fields once; launch passed. Its full local audit has no errors. API-reported backup cost was $0.06416475 for 297,140 prompt tokens and 7,512 completion tokens across six responses. Two DeepSeek failures were simulated locally and were not billed. This excludes new search costs because existing sources were reused, and is not a general per-guide cost estimate. Automated factual review remained incomplete, which is visibly disclosed; this is not counted as a factual-review pass or evidence of 99.8% reliability.

DeepSeek remains primary, with `qwen/qwen3.6-flash` as the default OpenRouter backup. The public model catalog confirms a 1M context window, tools, and structured outputs. Base prices checked live: $0.1875/M input and $1.125/M output; pricing increases above 256K input tokens per request. This is a configurable hosted model, not a locally deployed open-source model.

The adapter retries transient connection, 408, 429 and 5xx failures with bounded exponential backoff/jitter and Retry-After. Per-call timeout switches directly to backup, while overall abort/cancellation prevents additional requests. Missing/truncated or schema-invalid responses can switch models. Authentication, credit, forbidden and invalid-request failures do not. Backup selection stays active for the rest of a run. Defaults cap attempts at two per model per call, all network attempts at 32 per run, and backup attempts at 16. Local evidence/reference checks, correction and review are retained. Usage and guide provenance now report actual model IDs instead of always labeling output DeepSeek.

Controlled tests cover primary success without backup cost, transient recovery and sticky routing, timeouts, cancellation during backoff, Retry-After, schema preservation, malformed/truncated output, non-retryable errors, disabled/failed backups and shared request budgets. A full orchestration test simulates unavailable DeepSeek and verifies writing all four stages, factual review, guide persistence and backup model attribution. Live validation uses `scripts/verify-fallback.mjs`: primary requests fail locally with simulated 503s, while real backup calls regenerate from previously retrieved sources. These are explicitly simulated outages, not observations of a real DeepSeek outage.

The initial cheaper Qwen3.5 Flash candidate (`21e22e44-8725-4ad0-b00b-cd0c528f54bd`) did not produce a usable walkthrough and cost $0.03227 in API-reported backup usage. Qwen3.6's initial test (`268552b9-8d4a-4d95-b2bd-48a75d4c4beb`) exposed numeric internal step IDs and cost $0.08823; that result is also not counted as a successful walkthrough. Numeric step IDs now gain a deterministic `step_` prefix, updating dependencies consistently; duplicate IDs/collisions still fail the audit. Retry errors now include bounded schema paths so the model can correct missing fields. The writer schema excludes impossible observed timings. Earlier failed versions are retained.

## Strict schemas, source passages, and section recovery — 31 October 2026

The writer now requests strict JSON schemas in four stages (facts, overview, setup, launch). Research checkpoints, section repairs, factual corrections, and review also request schemas; OpenRouter requests require parameter support. Each stage is locally validated even when the endpoint accepts strict output. Unsupported endpoints do not silently downgrade to plain JSON.

New claims select passage IDs from an enum of the saved source passages. Code resolves IDs to exact original text, source ID, and content-hash-bound passage ID. Subsequent writing sections select from the already validated claim IDs. Existing literal-quotation guides remain compatible. A section gets one bounded recovery attempt, and unaffected completed sections remain intact. Non-foundation failures can publish independently valid sections with explicit unknowns; unresolved material factual review findings still withhold the walkthrough.

An intermediate Amplitude test (`1194bdf2-cda4-4e1f-839e-50b6c58950d2`, guide `/g/b0251053-884b-4288-acd6-af0b6ac9a856`) passed facts and overview but repeated an undiscovered destination URL in both setup attempts. It correctly retained other content and explicitly withheld setup. The final implementation additionally restricts step destinations to discovered public URLs (or an empty value with navigation instructions), and supplies the previous failed section to retries. This intermediate result is not counted as a completed walkthrough.

`npm run check`: **52 tests passed**. Added checks cover strict request bodies, no silent schema downgrade, exact passage reconstruction and stale/tampered-ID rejection, restricted claim references, schema-leaf isolation, recovery of a malformed setup section, preservation of setup when launch recovery is exhausted, conservative readiness when setup recovery fails, and regeneration without changing previous guide versions or repeating searches. The Windows sandbox blocks temporary-file atomic rename; the complete suite passed outside that sandbox.

Real OpenRouter probes accepted both the review schema and the research checkpoint schema combined with tools. The configured model remains `deepseek/deepseek-v4.1-flash-1017`. Direct DeepSeek strict-schema support has not been tested live.

AdRoll test run `a366830f-00f7-4d0a-95e6-3e6bf79a0e5a` regenerated all sections from the seven previously retrieved sources. It recovered a mistyped passage ID in the facts stage and an undiscovered destination in setup, without regenerating already valid sections. Guide `/g/46f4752e-d240-4a65-af32-a811a0977b8d` contains 8 steps and 26 claims; automated review completed with no blocking findings and three advisories. This run preceded the final dynamic passage/claim enum restriction, which specifically prevents the observed mistyped-ID class at supported endpoints. It used seven model responses, 395,122 prompt tokens and 17,732 completion tokens. Dates remain those of the saved sources; no fresh search or OAuth setup was performed. Review advisories include callback mechanics and PAT-versus-OAuth examples, so this remains a generated partial draft requiring human review.

Amplitude retest `d4d69c3d-cbd8-4061-bcee-d9c206b3cc16` exercised strict passage, claim, and destination allowlists against eight saved sources. Facts recovered from an output-limit failure; overview, setup and launch then validated on their first attempts. Guide `/g/23fefe7f-9ced-4bf7-b500-7a5baf541320` contains **10 steps and 40 claims**. All 77 evidence references resolve to saved passage IDs; the full local audit has no errors. Automated review completed with no blocking findings and six advisories, including inference/provenance questions that still need human review. It used six successful provider responses, 448,086 prompt tokens and 23,068 completion tokens. A final deterministic prompt adjustment hides application recovery placeholders from the initial facts stage; regression tests cover this adjustment.

After all live runs finished, the verified local server was restarted. The API served the new Amplitude report with intermediate drafts and raw source contents omitted. Browser checks reopened both new reports: AdRoll displayed 8 steps/26 claims, Amplitude displayed 10 steps/40 claims, and review notes remained visible. Original guide versions were preserved.

These checks demonstrate specific recovery behavior, not 99.8% reliability or guaranteed factual correctness. Multiple section calls repeat evidence context and can increase token usage and latency. Durable restart/resume, expanded search adapters, and a representative production reliability benchmark remain separate work. Automatic fallback is implemented in the later update above.

Checked locally on 30 October 2026. This report distinguishes application tests from live model research and provider setup.

## Current implementation

- DeepSeek through OpenRouter, with one-key Exa web search via the OpenRouter web plugin.
- Alternative direct DeepSeek Chat Completions, Search, and Fetch adapters.
- Actual tool-using research loop with configurable retrieval and time limits.
- Scenario-bound structured guide generation, one repair attempt, exact-quote/reference validation, and a separate semantic review.
- Saved sources, public-page inspection attempts, real progress events, immutable guide URLs, and Markdown export.
- Existing three documentation drafts remain labeled prepared drafts. No authenticated setup or connection is represented as tested.

## Automated verification

Command: `npm run check` (Node.js 22). Latest result on 31 October 2026: **42 tests passed, 0 failed**.

The suite verifies:

1. OpenRouter request model, authentication, web plugin, and citation-annotation discovery.
2. Direct DeepSeek search/fetch endpoints and response parsing.
3. Authentication errors and incomplete model output.
4. Full application orchestration against controlled model/search/page fixtures.
5. Scenario and scope retention, source records, read-only attempts, stable saved guides, and reopen behavior.
6. Rejection of invented quotes, source references, undiscovered step destinations, timing observations, and dependency cycles.
7. Semantic review findings withhold disputed walkthroughs even when quotes exist.
8. Provider ambiguity, missing keys, search failure, timeout, and restart recovery.
9. Private-network URL variants, mixed DNS responses, connection pinning, and unsafe redirects.
10. Safe text extraction, safe Markdown follow-up links, and secret input rejection.
11. HTTP endpoints, library without credentials, public guide access, private-file exclusion, cross-origin rejection, and generation passwords.

Fixture model/search responses are test-only dependency injection. They are not live research results or a runtime fallback.

## Browser verification

The real local server was opened in the browser. Checked:

- Three prepared guides load, and library search filters to GitHub.
- GitHub Markdown headings, tables, links, and table of contents render.
- “Research my exact scenario” preserves the provider, audience, and capability in the form.
- A missing API key produces an actionable inline error and preserves entered values.
- Narrow, tablet, and desktop viewport overrides were inspected. Tables/navigation scroll inside their containers; the page did not overflow horizontally. Temporary viewport overrides were reset.
- An isolated, explicitly labeled test-fixture server renders all 13 generated-guide sections, claim anchors, supporting quotations, source metadata, and the setup-inspection boundary.

The fixture preview is separate from the production server and uses `test-results/browser-fixture`, not the real guide data directory.

## Real public-page retrieval

The actual `fetchPublicPage` adapter retrieved:

- Requested URL: `https://developers.notion.com/docs/authorization`
- Final URL: `https://developers.notion.com/guides/get-started/authorization`
- Title: “Authorization - Notion Docs”
- Extracted text: 23,444 characters; 56 safe links; not truncated.

This verifies public source retrieval and redirect handling. It does not verify model reasoning, OAuth registration, or a connection.

## Corrections made during implementation

- **Windows save race:** concurrent polling exposed transient file locks during atomic rename. The store now serializes snapshots and retries Windows lock errors, retaining the previous good file rather than deleting it.
- **Quote existence versus factual support:** exact quotes alone could allow a wrong interpretation. A separate semantic review now withholds a disputed walkthrough and preserves sources and the review findings.
- **Direct DeepSeek follow-up links:** Markdown fetch results now expose safe links, so the agent can follow registration and permission references rather than relying solely on search results.
- **Provider identity constraint:** `www` aliases are normalized, and a supplied website mismatch becomes unresolved instead of mixing provider guidance.

## Live OpenRouter verification

The locally configured OpenRouter key authenticated real requests. The active model is `deepseek/deepseek-v4.1-flash-1017`. Searches used OpenRouter's Exa web plugin; **Tavily is not implemented**. The direct DeepSeek alternative has adapter tests but was not authenticated with a separate DeepSeek key.

Live requests researched Notion and Linear, neither of which was a prepared library guide. The verified Linear scenario is external customers reading and creating issues in a customer workspace. Real search annotations led to retrieved Linear and Composio documentation, and a public registration-page inspection recorded an HTTP-only block. No login or OAuth consent was attempted.

The usable guide at `/g/1085a9e9-3394-44e9-9484-05752b6146f1` contains **9 setup steps, 26 tracked claims, and 7 saved sources**. Its local source audit passed and its automated factual review returned `{completed:true, issues:[]}`. It remains a **generated partial draft** because launch questions are unresolved. This guide was produced through a sequence of real research, saved-draft retries, and review, rather than one uninterrupted successful fresh run. Sources retain their original retrieval dates.

A later fresh Linear research run (`2dc61242-c030-4ded-8124-68b02c0e493c`) made four searches and saved seven sources, including Linear's third-party application approval documentation. Its drafting/review sequence exposed canonical-URL and repair-path problems. After fixes and saved-evidence retries, `/g/4f9704a9-1772-41eb-b392-15e003dca745` contains 9 steps and 18 claims, but its final semantic review was incomplete and it visibly requires human review. It is not reported as a review pass.

The production server was restarted with the key loaded. The earlier reviewed guide reopened from disk in a fresh browser tab with all 13 sections, its scenario, source quotations, claim links, retrieval dates, and actual inspection limitations visible. This verifies persistence across restart and live guide rendering, alongside the automated endpoint tests.

## Live findings and limits

### Amplitude and AdRoll exports recovered, 31 October 2026

The reported exports were `b15eb269-e1ee-4908-8eca-ffd4921ad7d0` (Amplitude) and `4bd5e335-01bd-42a8-9029-9b1a25f1c2ae` (AdRoll). Both searches retrieved sources; failures occurred at validation/publication.

- Amplitude run `62f6141a-85d7-4551-8693-8362f8f00a2b` failed one quote check: `### What the MCP is for` versus the source's `## What the MCP is for`. Heading levels now count as presentation, and a short heading gains actual adjacent source context. Changed heading words remain invalid. Saved-candidate source validation now passes without inventing a quotation.
- AdRoll run `e89c42a8-0343-4f81-807f-9292fac3079c` corrected its initial factual findings, but the final free-text issues array contained “no error” and “not a blocking error” observations. The application incorrectly treated any string as a blocking finding. Review now uses schema-validated findings with explicit severity, message, existing claim IDs and source IDs. Only blocking findings gate the walkthrough; advisory observations remain visible in the UI and export. Regression tests verify both advisory retention and continued withholding for real blocking findings.

Live retries reused the saved evidence and retained retrieval dates; they made no new searches. Amplitude retry `f9efe927-2957-41fe-afbd-00b1100d37d5` produced `/g/80d65da7-7fe6-4e50-b09e-eff1b41dbd13` with 10 steps, 26 claims, 8 sources and a completed review with no blocking findings (four advisories). AdRoll retry `edce9be8-7225-42c7-964d-794df6395579` corrected one material finding and produced `/g/0c448cd3-e3a9-425c-9bca-76289bf9956a` with 10 steps, 19 claims, 7 sources and a completed final review with no blocking findings (five advisories).

Both remain generated partial drafts because provider requirements are unresolved. “No blocking findings” is an automated review outcome, not human certification or proof of OAuth setup. Original failed versions are retained.

### Provider-only research brief, 31 October 2026

The questionnaire now contains only an app name and optional official website. New requests default to `audience:general`. A shared system brief covers setup and approval, difficulty, hands-on effort, external waits, provider-specific nuances, blockers/recovery, and agent/developer/administrator responsibilities. It is passed through research, writing, correction and review. Audience/scope/app-type differences belong in conditional guidance; blank customization is not treated as missing research input. Older saved scenarios and explicit API/CLI scenario inputs retain their context.

Automated orchestration verifies that an app name alone reaches guide generation and review, that all stages receive the brief, and that local validation does not demand a missing-capability unknown. Browser verification confirmed the two-field form and started a real Supabase run with only its name (`0c8b30b3-f115-4e28-9bcb-6e412f3d5cfc`), which saved eight sources without asking follow-up questions.

That fresh run did not produce a publishable guide. It exposed formatting-only quote mismatches and unbounded expansion of a short quote after a long paragraph. Source-only comparison now also handles bold/code wrappers, preserving quote wording and rejecting fabricated quoted URLs; short-quote expansion is bounded. A resumed invalid draft now supplies its validation failures to the first repair call. Regression checks cover these cases.

Retry `2c0e17b2-97d9-476f-884f-41b87f688398` passed structure/source checks but still failed final factual review; `/g/5297af52-f8ee-4684-a82a-35a30b9f2833` correctly withholds its walkthrough. Findings included mismatched claim references, an undocumented publish procedure, and dependencies combining independent OAuth routes. The writing prompt now explicitly keeps managed, custom-app and identity-server paths separate, with ordered steps for the main provider-integration route. This final prompt refinement has automated checks but no additional live generation pass. Provider-only intake and prompt delivery are verified; consistently publishable model output remains a limitation.

### Supabase failure corrected, 31 October 2026

The user supplied export `launchpath-938942f3-40b0-4bd2-9fb3-3cfde0133dff.md`. Its run `c68c718a-459a-4a26-9bac-07a5fdbac0cf` retrieved eight sources and generated nine steps, but both draft attempts failed one check: claim c1 omitted the Markdown link destination around “OAuth Apps” in Supabase's integration instructions. The sentence's words were present. This was a validator false rejection, not an API-key or search failure.

The validator now also checks the source with HTTP(S) Markdown link wrappers removed. It leaves the submitted quote unchanged and continues to reject changed words and fabricated quoted link URLs. A regression test failed before the fix and passed afterward. Both original saved candidates now pass source validation without editing their wording.

Retry run `d3e396c5-b630-49da-ae12-fa8805fc44aa` reused the same eight sources and their dates, made no fresh searches or draft-generation calls, and passed a real OpenRouter factual review (`completed:true`, empty issues). The new immutable guide is `/g/e76e8c84-3028-4c70-bb13-b5bc4d9b65b7`: nine steps, 26 claims. Its partial status reflects unresolved capability/scope and launch questions. The user's capability field was blank; this was not the cause of the validation failure. The original failed guide remains intact.

- Live testing exposed output truncation, overly short call deadlines, Markdown front-matter destination aliases, short exact quotations, and invalid correction paths. The agent now handles these cases without inventing sources or repeating completed searches when resuming evidence.
- Hosted-model latency varied and some generations timed out. Current defaults permit ten minutes overall and five minutes per model call. The original two-minute target has not been demonstrated; no reliable per-guide cost or latency benchmark is claimed.
- Automated review is fallible. Manual spot checks found editorial/provenance problems even in the review-passed draft: claim c23 attributes Linear's manifest to Composio, and c26 treats a possible browser/login requirement as established by documentation. The actual inspection record says only that usable text was unavailable. Existing saved guide versions remain immutable and visibly marked for human review.
- Testing did not establish that every generated claim is correct, that the agent exhaustively researches a provider, or that a single fresh request reliably produces a publishable guide. The implementation is a working research-and-drafting prototype.

Authenticated provider registration/consent/API tests, public deployment, and the assignment's user walkthrough remain separate work. HTTP inspection cannot establish a working integration. The app currently requires a single Node server with a persistent disk; it is not a horizontally scaled or ephemeral serverless deployment.


## Local background job recovery

115 automated tests pass. A child process acquires a job lock, saves a validated facts checkpoint and exits immediately with code 23. A fresh worker reclaims the dead owner's lock, resumes the same run ID and creates one guide with only three remaining writing calls. Another test verifies that a live lock excludes a duplicate worker and release permits a new claim. No Postgres configuration is needed. The optional Postgres implementation was removed following the user's decision to skip its setup.

The local worker scans persistent queued/running records on startup. Model responses and validated sections are checkpointed, request counters survive restart, and publication reserves a stable guide ID. In-flight external calls can repeat after a crash, and incomplete lock metadata requires inspection. This verification uses controlled model responses and a real process crash, not another paid research benchmark.


## Guide readability update

115 regression tests pass. Browser checks of the existing Calendly guide preserved its 12 steps and 32 evidence entries, with no horizontal overflow at widths 375, 768 and 1280. Evidence is collapsed by default. A saved-source regeneration (run 515d0d72-a879-4d06-b342-0eb0cc648383, guide 0115773b-8a25-4f23-ad1c-e5bb1825fc09) produced ten steps with numbered actions; summary fields are 51, 46 and 33 words. Automated review completed. This is a formatting/writing verification using reused sources, not a new research benchmark or authenticated setup test.


## Prepared-guide writing style

115 tests pass after adding the shared editorial examples in lib/guide-style.mjs. A saved-source Calendly regeneration (run 0a3dabef-16b8-4e19-a047-5e72e56a4cc8, guide 138bd195-ef66-404b-b77e-52e7fb9539d2) produced ten steps using connected explanatory paragraphs, bold console labels, code identifiers and observable checkpoints. The examples are editorial patterns with placeholders rather than another provider's requirements. This checks writing delivery and an actual model output; it is not a fresh research or factual-accuracy benchmark.
