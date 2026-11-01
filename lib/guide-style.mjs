// Editorial patterns distilled from guides/slack.md, github.md and google.md.
// Placeholders intentionally avoid teaching another provider's requirements.
export const guideStyle = `HOUSE STYLE — match the prepared Slack, GitHub and Google guides.
Write a practical developer walkthrough with a clear narrative: what the developer is signing up for, which route fits, what to gather, what to configure, how to prove the connection works, what changes for customers, and how to recover from problems.
Lead each topic with its practical conclusion. Follow with the reason or condition that changes the decision. Use second person and concrete verbs. Explain a new term where it becomes useful. Keep paragraphs short, usually 2–4 sentences. Bold the key takeaway or console label sparingly; use backticks for literal field names, scope strings and identifiers. Inline formatting is supported; HTML is not.
Use exact menu paths and field labels only when retrieved evidence supplies them. Explain where a value comes from and what to do with it. Provide a short checkpoint describing the visible result. Distinguish completing a first test from being ready for public use.
Group permissions by the developer's intended feature. Explain what access enables and the practical consequence. Separate approval preparation from provider waiting time. Add a useful example only when clearly labeled as an example; select real scopes, fields and endpoints from this app's sources.
Write connected explanations rather than repeating the same cautions in every field. Number actions when they are genuinely sequential; a short paragraph is better for a single action. Keep alternate routes conditional and separate. End blockers with a concrete next action and the responsible person.
These are editorial examples ONLY. Square-bracket placeholders are illustrative, not facts or text to reproduce. The supplied app's retrieved evidence is the only factual basis. Never transfer Slack, GitHub or Google requirements, scopes, wait times, UI paths or example scenarios to another app.

Example pattern from Slack — practical takeaway followed by a decision:
"**A first test is manageable. Customer distribution needs additional preparation.** Start with [development environment] and the minimum permissions for your feature. For public use, prepare [documented submission materials] and account for [documented external approval]."
Maps to summary.testReadiness, summary.launchReadiness and effort. Replace every placeholder using the current app's evidence; express unavailable details as a specific confirmation task.

Example pattern from GitHub — explain the choice before giving instructions:
"Choose [app type] when you need [capability]. Use [alternative] for [different documented use case]. For the example below, [small illustrative feature] keeps the first test focused."
Maps to provider.appType, assumptions and permissions. An illustrative feature is an optional example, not a new intake requirement or an assumed customer scope set.

Example pattern from Google — precise action and value provenance:
"Open **[documented menu path]** and select **[documented client type]**. Enter your app name. Copy [callback value] from [documented configuration] into **[documented redirect field]**, then save."
"Checkpoint: [correct environment], [saved configuration] and [intended account] are visible."
Maps to steps.action and steps.expectedOutput. Put the checkpoint in expectedOutput, not in a duplicated paragraph. If the source lacks a menu path, link to the retrieved instructions and explain the available navigation.

Example acceptance test:
"Connect the intended test account, perform [small harmless operation supported by the selected permissions], and confirm [observable result]."
Maps to milestones.successCondition. This describes a test for the developer to perform, not an executed test.

Keep the existing structured output contract. The page turns permissions, effort, steps and blockers into readable sections. Supply concise, useful content for each field; do not reproduce an entire Markdown article inside one field. Style is guidance, never a publication gate.`;
