# OAuth Launch Guide — take-home product scope

Prepared for the Composio APM–Integrations assignment. Research date: 29 October 2026.

Product update, 31 October 2026: research now asks only for an app name and optional official website. The agent's default brief covers OAuth setup and approval, difficulty, hands-on effort, external waits, provider nuances, blocker recovery, and agent/human handoffs. Scope, audience and app-type differences appear as conditional guidance, not a prerequisite questionnaire. Explicit older scenarios remain readable.

**Recommendation:** Build a searchable library of three carefully investigated OAuth setup guides, plus a real, tool-using research agent that produces the same structured guide for an unfamiliar app. Each guide should answer: **Can I test now? What blocks launch? What should I do next?**

This document is a proposed scope, not a claim that the product or provider setups have been built or tested. The provider observations below were checked against public documentation. Console attempts, working connections, user testing, and deployment remain implementation work.

## 1. The problem and intended outcome

A developer is about to add “Connect your account” to an agent product. They need to decide whether they can ship a prototype today, what it will take to serve external customers, and who must unblock them. The information exists across developer documentation, registration consoles, distribution policies, and review requirements, but is difficult to assemble into an actionable launch plan.

The primary user is a technically capable developer or agent builder adding an integration to a product. They understand APIs but may be unfamiliar with this provider’s OAuth registration and review process. A secondary user is the teammate, administrator, or founder receiving the guide and taking responsibility for a prerequisite.

**Job to be done:** “When I choose an app integration, help me identify the shortest valid path to a test connection and a customer launch, with the work, dependencies, and uncertainty visible before I commit.”

The product outcome is a usable next action and a defensible plan. A successful lookup does not mean the provider has approved the app or that the integration is operational.

The working hypothesis is that conditional guidance with evidence will reduce uncertainty more than a generic OAuth tutorial. This assignment supplies the problem statement; the take-home should validate usefulness with a small task-based walkthrough, rather than claim demonstrated customer demand.

### Why this scope suits the role

My interpretation of the [job description](https://jobs.ashbyhq.com/composio/64bda86f-f25f-42f3-9d1a-b6ad3d736ca2) is that a strong submission should demonstrate ownership of integration delivery and quality: investigate an unfamiliar provider, expose blockers, automate repeatable work, and leave an inspectable operating process. A small product with reliable guidance, an attempt log, and a correction log provides better evidence of that ability than breadth alone.

## 2. Get the OAuth model right

| Concept | Meaning in this experience |
| --- | --- |
| Provider | The service whose data or actions the developer wants to expose, such as Gmail or Slack. |
| Developer’s product | The agent application offering “Connect Gmail,” for example. |
| Provider OAuth app | A registration identifying the software asking for access. It defines configuration such as redirect URIs and may have credentials and review requirements. Follow the provider’s actual OAuth variant; do not assume every client uses a secret. |
| User connection | An individual authorization granting access under that OAuth app. Creating an OAuth app does not connect every user. |
| Scopes or permissions | The requested access. These can change eligibility, review requirements, and what the integration can do. |
| Provider review | Review of the app, branding, scopes, distribution, or other requirements. Distinct from a workspace administrator approving installation. |

In Composio, an auth config supplies the authentication blueprint, while connected accounts represent users’ individual connections. [Composio authentication documentation](https://docs.composio.dev/docs/authentication).

**First product decision: check whether registration is needed at all.** Composio can supply a managed OAuth app for supported methods. A developer may instead need or choose their own app because managed OAuth is unavailable, they require their own consent branding, or they need custom scopes or a separate quota. Check the toolkit and auth method; do not assume availability for an entire provider. [Managed OAuth directory](https://docs.composio.dev/toolkits/managed-auth).

Show two routes when applicable:

- **Use Composio-managed OAuth:** link to the applicable setup path and explain the remaining user authorization and permission requirements.
- **Bring your own OAuth app:** show registration, test, and launch guidance.

If availability cannot be checked, say “Managed OAuth availability not verified” and link to the directory. An unfamiliar provider can have OAuth without having a Composio toolkit. Keep those statuses separate. Managed OAuth also does not guarantee that every requested feature or distribution scenario is supported.

For custom auth, take the provider redirect URI from the relevant Composio auth-config instructions. Do not confuse it with the developer’s post-connection return URL. Credentials belong in the provider/Composio configuration, not this guide product. [Managed versus custom auth](https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app).

## 3. Scope boundaries

### Must ship

1. Three real provider guides using one reusable schema: GitHub, Slack, and Gmail.
2. Search by app name, with a clear path to research an unlisted app by name or website.
3. Minimal research input: app name and optional official website; setup and approval research is the default.
4. A guide showing test readiness, launch requirements, effort, external waits, prerequisites, ordered actions, blockers, and responsibility.
5. Genuine live research with search/fetch tools, visible progress, cited findings, and honest partial results.
6. A persistent, read-only share link that opens without login.
7. Claim-level source references and a separate record of actual setup attempts.
8. A small validation report showing checks, corrections, and unresolved questions.
9. A deployed experience and source repository with setup instructions and limitations.

### Optional, only after the essentials work

- Copy the guide as Markdown.
- A local checklist that remembers completed tasks on that browser.
- A fourth provider, chosen only if it adds a new challenge.
- A scenario-specific scope comparison for a second provider.

### Explicitly excluded

All 100 completed guides; accounts and team workspaces; real-time collaboration; automatic provider approval submissions; email sending; credential storage; a general OAuth client or token manager; paid assessment completion; a universal agent that configures every provider console; full integrations and tool execution for every app; automated policy-change monitoring; polished dashboards and complex difficulty scores.

The library should be structurally capable of holding 100 guides. Do not show unresearched placeholders as completed guides or imply that generation is equivalent to validation.

## 4. Choose providers for different failure modes

| Provider and scenario | What it should demonstrate | Important nuance to preserve |
| --- | --- | --- |
| GitHub OAuth app, initially for a personal test account | A comparatively direct registration path; exact setup actions and a test milestone | Organization access restrictions can introduce owner approval. Explain GitHub’s recommendation to consider a GitHub App when appropriate; do not silently substitute app types. |
| Slack app, first for a development workspace, then external commercial use | Workspace ownership, installation permissions, distribution, and review are separate gates | An unlisted pilot is not proof of commercial launch readiness. Surface applicable distribution requirements and any relevant capability-specific constraints. |
| Gmail, external app reading mailbox content | Scopes, verification exceptions, documentation preparation, and potentially substantial external dependencies | Read-only access can still be restricted. Data handling and applicable exceptions affect assessment requirements. Include a send-only contrast to show why capability changes the path. |

Sources: [GitHub registration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), [GitHub organization restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions), [Slack distribution](https://docs.slack.dev/app-management/distribution/), [Slack API terms](https://slack.com/terms-of-service/api), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Google restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

The matrix describes scenarios, not permanent “easy/medium/hard” labels for entire apps. Re-check these sources during implementation.

## 5. The core experience: three views

### A. Find an app and describe the use case

The first view has a prominent search input, three working example cards, and a short explanation of what a guide provides. Search supports names, common aliases, and domains. Do not fill the screen with a chatbot or a catalogue of unavailable apps.

On a match, show the existing guide immediately. On no match, offer “Research this app.” For ambiguous names, ask the user to choose the provider or enter its website before researching.

Ask only for the app name and optional official website. Do not ask what the developer's agent does, who will connect, exact scopes, or app type. These are choices to explain in the guide when they affect setup or approval. Cover first-test, internal-use and external-customer paths where applicable, keeping scope-dependent requirements conditional. Missing customization is not a blanket launch blocker or reason to withhold useful guidance. Existing saved guides retain their original labeled scenarios.

### B. Research progress

Show actual events, such as “Found official developer documentation,” “Checked distribution requirements,” or “Registration page requires login.” Include the source or observed outcome where helpful.

Use a bounded sequence: identify provider → locate OAuth documentation → inspect setup and launch requirements → inspect accessible registration surfaces → check evidence → prepare guide.

Do not animate invented tool calls, show a fake percentage, or reveal private model reasoning. If retrieval fails, report that failure. A cached result must be labeled with its research date rather than presented as new research.

### C. Guide and share view

Put the decision summary above the detailed walkthrough:

> **Gmail · External users · Read mailbox content**  
> Test route: conditional on account/project setup.  
> Public launch: verification requirements must be resolved.  
> Active effort: not measured yet; preparation dependencies listed below.  
> Provider wait: official guidance says restricted-scope verification can take several weeks; this is not a launch commitment.  
> Biggest dependency: applicable review and assessment requirements.  
> **Next action:** confirm whether mailbox reading is required and identify the exact minimum scopes.

This is an illustrative layout, not a completed guide or tested readiness determination. [Google verification timing and assessment guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

Then show:

1. Scenario and assumptions, including managed/custom route.
2. Prerequisites, ideally ordered by what can block all later work.
3. Separate milestones for registration, first test connection, and external launch.
4. Ordered setup tasks with direct destinations, expected results, and task owners.
5. Approval preparation and submission checklist, where applicable.
6. Blockers and ways to make progress while waiting.
7. What was attempted, what documentation supports, and what remains unknown.
8. Sources and research date.
9. Share action; optional Markdown export.

Use collapsible detail and a simple table of contents. The guide should read as a practical runbook, not a long unstructured answer.

## 6. Content contract for every guide

| Field | Required behavior |
| --- | --- |
| Provider identity | Name, canonical website, official developer docs, OAuth availability: supported / not established / unsupported according to a cited source. Failure to find docs is not proof of no OAuth. |
| Composio support | Toolkit and managed-method availability with evidence, or explicitly unverified. |
| Scenario | Audience, capability, requested scopes if known, app type, and assumptions. |
| Recommendation | Managed/custom route and a short reason; a concrete next action. |
| Test path | What is needed to reach a test connection and the limits of that test. |
| Launch path | Review, distribution, administrator, or policy gates applicable to the scenario. |
| Effort | Human work, prerequisites, and external waits as separate values. |
| Requirements | Accounts, permissions, domain/site/policy assets, callback configuration, and review evidence where applicable. |
| Steps | Action, destination, expected output, owner, dependency, evidence, and fallback when blocked. |
| Blockers | Trigger, symptom, responsible party, recovery step, and impact on testing or launch. |
| Handoff | Agent can do / developer must do / administrator or provider must do. |
| Evidence | Claim IDs mapped to sources or attempt records, plus explicit uncertainty. |
| Version | Guide ID, scenario, generated timestamp, reviewed timestamp if applicable, and validation status. |

### Difficulty and timing

Describe difficulty through concrete dimensions: registration work, approval dependency, account/admin dependency, and unresolved requirements. If a summary badge is useful, use “Self-service,” “Review-dependent,” “External dependency,” or “Not established,” with the reason beside it. Several badges can apply.

Do not combine hands-on work with elapsed provider waiting. Do not add parallel waits as though they were sequential. Show what work can happen while waiting. Do not show a total launch date when a critical dependency is unknown.

Each duration must be one of:

- **Observed:** elapsed time for a clearly bounded setup attempt, with the prerequisites and environment stated.
- **Provider-published:** the provider’s stated range and its applicability, linked to the source; not a guarantee.
- **Planning estimate:** an explicitly labeled assumption with the tasks it covers and excludes.
- **Unknown:** explain what information is missing and how to obtain it.

An unfamiliar app’s guide can still be useful when timing is unknown. It must not invent a plausible “2–3 days” to fill a required field. Assessment costs should likewise be sourced or marked unknown; completing paid work is outside the assignment.

### Useful blocker behavior

“Contact support” is insufficient on its own. A blocker should state who to contact through an official route, what evidence to include, and what can proceed independently.

Example: if a customer workspace requires administrator approval, identify the administrator as the owner, provide the requested permissions and purpose they need to review, and explain that the developer can continue testing in an authorized development workspace. Do not advise bypassing organization controls.

## 7. Agent workflow and human boundaries

Use **one research agent with tools and deterministic checks**. A multi-agent system is unnecessary for this time budget. Distinct research and checking stages can run in the same orchestration flow.

1. **Resolve identity.** Normalize the name/domain, disambiguate when needed, and establish official provider-owned sources.
2. **Find the applicable OAuth model.** Confirm that the provider supports third-party authorization; identify app type and distinguish API keys, service accounts, and personal tokens.
3. **Investigate.** Search and fetch official registration, permissions, review, distribution, and troubleshooting documentation. Follow relevant links rather than rely only on search snippets.
4. **Attempt accessible setup work.** Open public registration entry points, inspect available forms and requirements, and record where authentication or account permissions stop progress. During preparation, use an available developer account to advance further where practical.
5. **Extract evidence.** Bind material claims to retrieved passages or observed attempts. Preserve contradictions and scope conditions.
6. **Generate structured output.** Use the same schema as the library, including explicit unknowns.
7. **Check.** Validate the schema, references, required conditions, and absence of unsupported readiness claims. Repair malformed output once; otherwise publish an honest partial result.
8. **Persist and share.** Save the guide and its evidence under a stable link.

The runtime must use real tool retrieval for a new app. Prepared guides are allowed for the library, but hidden hardcoded templates for the supposedly unfamiliar provider are not a live generation flow.

### Agent actions versus human actions

| Agent can handle | Developer must handle | Admin/provider/assessor handles |
| --- | --- | --- |
| Research; inspect accessible setup pages; extract requirements; propose minimum permissions; draft checklists and scope justifications | Log in; choose project/workspace; confirm permissions and app purpose; provide real product/domain/policy details; configure credentials; perform consent | Grant organization permissions; review the submission; make approval decisions; conduct applicable assessments |

Drafting a form or review explanation is different from submitting it. Record the exact point reached. A login wall is a valid observation; it is not evidence that the remaining setup works. Public research must continue where possible even if the console is inaccessible.

For the demo, aim for actual agent-led inspection of all three registration entry points and at least one deeper setup attempt where an appropriate free account is available. This is a target, not a reason to buy access or fabricate an attempt. A meaningful stop record includes the reached page, action tried, observed blocker, timestamp, and the next human action.

### Practical runtime limits

Start with a small configurable retrieval budget, such as two search rounds and up to eight relevant pages. Treat that as a cost/latency guardrail, not proof that research is complete. Prefer source quality over filling a page quota.

Target an initial status within five seconds and a usable result within roughly two minutes in the chosen deployment environment. Measure this during testing. When the budget expires, return confirmed findings, missing questions, and the next action rather than fail silently or claim completion. Check hosting execution limits early.

If browser tooling is already available, use it for accessible setup surfaces. Do not spend the assignment building a general browser automation framework. If runtime investigation is limited to search/fetch, disclose that and show richer build-time setup attempts separately.

## 8. Trust and evidence are part of the product

Use separate labels for support and review:

- **Observed in setup:** backed by a specific attempted action and result.
- **Supported by official documentation:** backed by a retrieved, relevant passage.
- **Inferred:** a reasoned recommendation, with its assumptions visible.
- **Unknown or conflicting:** not established, inaccessible, or unresolved between sources.

Separately label a guide as **generated draft** or **sample-checked**. A recent generation timestamp does not make every claim current or verified. A human-checked guide can still contain explicitly unresolved fields.

Every material claim about eligibility, scopes, review, timelines, or approval must point to its evidence. Step-specific UI labels require either a matching current document or an observed console view. A bibliography alone is insufficient. Avoid unsupported numerical confidence scores.

When sources conflict, check dates, scenario, app type, and provider policy. Prefer the current authoritative source applicable to the claim and show unresolved ambiguity where necessary. Never silently merge a pilot instruction with commercial launch guidance.

For unfamiliar names or websites, restrict fetching to public HTTP(S) destinations, block private/local network addresses and unsafe redirects, and treat fetched page content as untrusted data. Keep API keys server-side, escape generated output, and prevent the agent from following instructions embedded in a source page. Do not accept or save client secrets, access tokens, login cookies, or private setup screenshots in shared guides.

## 9. Minimal implementation shape

Use a familiar web stack rather than learn infrastructure during the take-home. A TypeScript web app with server-side research orchestration, one search/fetch provider, one model, and a small durable store is sufficient. Use hosted storage if the deployment environment has ephemeral local files.

```text
Search or provider website
        ↓
Existing provider + scenario? → Stored library guide
        ↓ no
Research request → Search/fetch tools → Evidence records
        ↓
Structured guide → Validation → Durable storage
        ↓
Public guide URL with sources and attempt records
```

Conceptual data records:

- `Provider`: identity, domain, aliases, toolkit/method status and supporting evidence.
- `GuideVersion`: provider, scenario, recommendations, milestones, requirements, steps, blockers, timestamps, status.
- `Evidence`: source URL, title, retrieval timestamp, short supporting excerpt, claim IDs; retain source publication/update dates when available.
- `Attempt`: guide/provider, environment, action, outcome, reached boundary, timestamp, sanitized evidence reference.
- `ResearchRun`: input, actual progress events, terminal status, duration, error and resulting guide ID.

Keep public guide content separate from private operational errors and any per-browser checklist state. Store a version with each shared link so a recipient sees the assumptions the sender used. A regenerated guide can receive a new version/link; version comparison UI is unnecessary.

Avoid account creation for readers. Research requests can run while the page remains open, provided results are persisted and failures are explicit; a durable background-worker system is not essential. If a request is interrupted, do not leave an endless “researching” screen.

## 10. Acceptance criteria

| Requirement | Passing behavior |
| --- | --- |
| Search | A developer can find each prepared provider by name; an unknown name has an obvious research action. Ambiguous identity is clarified. |
| Conditional guidance | Provider-only research covers setup and approval without a questionnaire. Relevant audience, scope and app-type differences have clear branches; a scope-dependent review is not presented as universal. Older scenario-specific guides retain their original context. |
| Decision summary | The reader can identify test restrictions, launch gates, dependencies, and a next action without reading the entire guide. |
| Actionability | Each major task has a destination and expected output; each critical blocker has an owner and a recovery action. |
| Live generation | A provider absent from the seed data causes real retrieval and produces a new persisted guide or a useful evidence-backed partial result. |
| Evidence | No material claim in the audited sample lacks support or an explicit uncertainty label. No failed setup action is described as successful. |
| Timing | Human effort and external waits are separate; unsupported durations remain unknown. |
| Sharing | A copied guide URL opens in a fresh browser session without login and retains scenario, findings, citations, and limitations. |
| Failure | Missing docs, unavailable tools, malformed output, and timeouts have understandable outcomes; no fake successful guide is substituted. |
| Submission | The deployed link works, repo is accessible to reviewers, setup instructions reproduce the app, and secrets are absent. |

## 11. Validation and the learning record

Audit at least twelve consequential claims across the three guides, prioritizing app type, permissions, review conditions, distribution requirements, time estimates, and handoff boundaries. Log the exact claim, check method, source or attempt, outcome, correction, and remaining uncertainty.

Use documentation checks and setup attempts as distinct evidence types. Where an appropriate account is available, continue one provider through registration or a test authorization; otherwise record the reached boundary without claiming end-to-end verification. Never count a documentation read as a tested connection.

Test these cases:

1. Each prepared provider opens and renders the required sections.
2. One genuinely unseeded OAuth provider generates a usable guide live.
3. An ambiguous app name requests identity clarification.
4. A provider with no established public OAuth docs returns an unresolved result, not fabricated registration instructions.
5. Retrieval failure or timeout preserves available findings and a clear next step.
6. Scenario changes do not reuse incompatible review conclusions.
7. A fresh-session share link works.
8. Generated content cannot inject rendered scripts; private-network URLs are rejected.

If possible, ask one developer unfamiliar with the project to answer four questions from a guide: “Can I test?”, “What blocks launch?”, “Who owns that?”, and “What do I do next?” Record confusion and one resulting change. A tiny convenience sample is usability feedback, not proof of product-market fit.

### Findings already supported by this scoping research

These are documentation findings, not console discoveries:

- **A provider-wide Gmail rating would be misleading.** `gmail.send` is sensitive, while `gmail.readonly` is restricted. Therefore the guide must preserve capability and scope assumptions. [Gmail scope reference](https://developers.google.com/workspace/gmail/api/auth/scopes).
- **Restricted scopes do not justify one blanket assessment claim.** Google describes verification exceptions and assessment conditions involving server access or handling. Therefore the guide must ask or state the relevant data-flow assumptions and avoid assuming every scenario has the same review path. [Restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
- **Slack pilot access is not commercial launch readiness.** Its distribution guide and current API terms must be read together; applicable commercial authorization requirements belong in the launch milestone. [Distribution guide](https://docs.slack.dev/app-management/distribution/), [current API terms](https://slack.com/terms-of-service/api).
- **GitHub registration is not universal organization access.** A completed app registration does not eliminate organization owner approval where access restrictions apply. [Organization access restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions).

Do not present these as corrections made to an implemented product. During the build, maintain an actual before/check/after log, including any guidance changed because a setup attempt contradicted it.

## 12. Metrics appropriate to this assignment

The immediate quality bar is whether the user can act and whether the evidence warrants the answer.

| Metric | How to use it |
| --- | --- |
| Next-action comprehension | Proposed target: a walkthrough participant identifies a valid next action and owner within one minute. Report observations and sample size. |
| Audited claim support | Proposed gate: all twelve sampled material claims are supported, corrected, or visibly unresolved; zero invented approval/timing assertions. |
| Unfamiliar-provider result | Record whether a new provider produced a usable result or a justified partial result, including source coverage and latency. |
| Agent progress | Record the useful actions completed before human handoff, not the number of tool calls. |
| Guide latency | Measure actual time to initial status and final/partial guide. Treat the two-minute goal as a target, not a verified capability. |

For a future 100-guide operation, track validated coverage, critical unknowns, source freshness, and guide defects. Approval conversion and time-to-first-successful-connection become useful only when the product can actually observe those outcomes.

## 13. Eight-hour execution plan

| Elapsed time | Work and exit condition |
| --- | --- |
| 0:00–0:30 | Lock the scenario model and schema; confirm model/search access and deployment constraints. |
| 0:30–1:30 | Run agent-led provider investigation and accessible setup attempts; collect evidence and create three structured guide drafts. Record deeper setup boundaries if reached. |
| 1:30–2:45 | Build the search and guide UI using those records; get a basic deployment online early. |
| 2:45–4:15 | Implement tool-using live research, output validation, real progress events, and honest failure states. Test an unseeded provider immediately. |
| 4:15–5:00 | Add durable guide storage and public share URLs; confirm fresh-session access. |
| 5:00–6:00 | Audit claims and scenario behavior; fix consequential errors; finish the validation/correction log. |
| 6:00–6:45 | Verify deployment, mobile readability, timeouts, and secret handling. Conduct a quick reader walkthrough if someone is available. |
| 6:45–7:30 | Write README, document limitations, prepare the demo and submission links. |
| 7:30–8:00 | Buffer for broken research, source gaps, or deployment issues. |

This assumes basic development tooling and account access already exist. Deeper provider setup is timeboxed; record a useful stopping point if it would consume the implementation budget.

**Six-hour cut:** omit Markdown export, saved checklists, elaborate animations, secondary comparison UI, and the optional fourth provider. Keep three credible guides, live unfamiliar-app research, evidence, setup-attempt records, share links, deployment, and README. If the agent still fails on unfamiliar apps, fix that before visual polish.

## 14. Scaling to 100 without building 100 now

Use the same pipeline: provider intake → generated draft → critical-claim review → published library entry → refresh when reviewed evidence is stale or challenged.

Batch generation later can reuse the schema, but a generated guide remains a draft until it meets the publication bar. Keep unresolved apps visible as incomplete only if that status is useful; do not count them as ready-to-use coverage. Source timestamps, provider-specific conditions, and attempt records are the foundations for maintenance.

Manual or scripted refresh is enough for the take-home. Automatic change detection, review queues, and staffing models are future work.

## 15. Demo and submission

Use a five-minute demo:

1. Open GitHub and explain the test milestone and a possible organization-level handoff.
2. Open Slack and show why a development install does not settle commercial distribution.
3. Open Gmail and show how mailbox access changes review requirements compared with send-only capability.
4. Accept an unfamiliar app from the reviewer and trigger genuine live research. Point to real sources, uncertainty, and the next action.
5. Open the resulting share link in a fresh session; show one setup attempt and one actual correction or unresolved finding from the validation log.

Keep a labeled saved result available if the external retrieval service fails during the demo. Explain that failure and show the saved result as a previous run; never pass it off as live.

The README should contain:

- Working URL, repository link, and a one-sentence product description.
- Local setup, environment-variable names, and model/search provider requirements; placeholder values only in `.env.example`.
- Architecture, seeded examples, and instructions to run a genuinely new research request.
- Why these providers and which scope cuts were intentional.
- Evidence-label definitions, setup attempts, validation results, and actual corrections.
- Known limitations: conditional guidance, incomplete console testing, external-tool failures, unverified timings, and no guarantee of provider approval.

**Definition of done:** A reviewer can find a prepared app, understand a scenario-specific path, watch a new app researched with real tools, inspect the evidence and attempted work, identify the next human action, and share the result without needing the author to explain it.
