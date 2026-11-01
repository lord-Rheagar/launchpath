# Set up your own Slack OAuth app with Composio

Create a Slack app, connect a workspace through Composio, and understand what changes when you offer it to customers.

**Applies to:** standard Slack workspaces and the OAuth v2 flow. GovSlack and Enterprise organization-wide deployment need additional configuration. **Sources checked:** 30 October 2026. **Validation:** documentation reviewed; no authenticated installation or API execution performed.

## 1. Know what you are signing up for

**An internal test is manageable. Commercial distribution is a separate launch project.** Decide which milestone you need before creating the app.

| Your goal | Hands-on planning estimate | External dependency |
| --- | --- | --- |
| Connect one development workspace | 30–60 minutes | Workspace installation approval if required |
| Pilot in other workspaces | Another 30–60 minutes to configure and test distribution | Each workspace's policy and available testers |
| Submit for Marketplace distribution | Several hours to prepare materials after the product works; estimate excludes building the product and recruiting testers | Slack currently requires 10 active workspace installations; preliminary feedback can take up to 10 business days and new-app functional review up to 10 weeks |

Hands-on times are editorial estimates, not measured timings. Slack's published review durations are estimates, not a launch guarantee; inspect the submission page's current queue estimate. [Marketplace prerequisites and timeline](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/).

Unlisted distribution supports early customer pilots. Slack directs apps intended for commercial distribution toward Marketplace approval. An install link working in another workspace does not by itself establish commercial launch readiness. [Distribution guidance](https://docs.slack.dev/app-management/distribution/).

**First action:** decide whether the agent should act as a bot or as a user. This guide's main example is a bot that posts updates in an explicitly selected test channel.

## 2. Gather the prerequisites

- A development workspace and permission to create/install apps there.
- A Composio project where you can create an auth config.
- Your app name, support contact, and a test channel such as `#oauth-test`.
- A workspace admin contact if installation requires approval.
- For a customer pilot, a second workspace with an installer who can approve the requested permissions.

The **Slack app** is your product's identity. **Client ID and Client Secret** identify it during OAuth. Installation produces a **workspace/user authorization**. A bot token, user token, signing secret, and verification token serve different purposes; none should be substituted for the OAuth Client Secret.

## 3. Choose the identity and permissions

**Bot access** suits an assistant posting under its own name. **User access** is needed for certain methods that act with the installing user's permissions. Slack sends bot scopes in `scope` and user scopes in `user_scope`; selecting a permission in the wrong category will not produce the intended authorization. [OAuth identity and scope parameters](https://docs.slack.dev/authentication/installing-with-oauth/).

| Feature | Scope / token | What to expect |
| --- | --- | --- |
| Post as the bot to a channel it has joined | Bot: `chat:write` | Start here for the example |
| List public channels for a channel picker | Bot: `channels:read` | Optional if the channel ID is already known |
| Read public-channel history | Bot: `channels:history` | Access depends on conversation membership and method rules |
| Read private-channel history | Bot: `groups:history` | The app must have access to that private conversation |
| Use legacy workspace search methods | User: `search:read` | Not a bot permission; Slack now labels it legacy |

Sources: [posting](https://docs.slack.dev/reference/methods/chat.postMessage/), [listing conversations](https://docs.slack.dev/reference/methods/conversations.list/), [history access](https://docs.slack.dev/reference/methods/conversations.history/), [search scope](https://docs.slack.dev/reference/scopes/search.read/).

**Recommended starting set for the example:** `chat:write`; add `channels:read` only for channel discovery. Do not copy every available Slack scope into the app.

If search is the product's core action, first verify the exact Composio tool's token requirements. Slack recommends its newer granular Real-time Search scopes over `search:read`; compatibility with the selected Composio toolkit was not tested here. Do not claim a bot-posting connection proves search works.

## 4. Create the app and configure Composio

### Step 1 — Obtain the redirect URI

Start **Create Auth Config** in the [Composio dashboard](https://dashboard.composio.dev), select your Slack toolkit and custom OAuth2 credentials, and copy the displayed redirect URI. Keep the form open. [Custom auth configuration](https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app).

### Step 2 — Create a Slack app

At [Slack app management](https://api.slack.com/apps), choose **Create New App → From scratch**. Enter `Acme Assistant` or your product name, select the development workspace, then choose **Create App**.

Open **OAuth & Permissions → Redirect URLs → Add New Redirect URL**. Paste Composio's URI, click **Add**, then **Save URLs**. Under **Scopes → Bot Token Scopes**, add the permissions selected above. User permissions belong under **User Token Scopes**. [Composio's Slack setup walkthrough](https://composio.dev/auth/slack_custom).

**Checkpoint:** the intended workspace owns the development app, the redirect is saved, and the bot/user scope categories match your feature.

### Step 3 — Configure the credentials

Open **Basic Information → App Credentials**. Copy **Client ID** and **Client Secret** into the corresponding Composio fields. Set the requested scopes and create the auth config. Record its `ac_…` identifier. Composio's Slack guide separately mentions a Verification Token for triggers; treat any trigger setup as an additional configuration task. [Credential fields](https://composio.dev/auth/slack_custom).

The Slack guide contains an older callback example. Prefer the URI displayed by your Composio config; the current callback reference documents `/api/v3/toolkits/auth/callback` as well as legacy support. [Callback reference](https://docs.composio.dev/docs/auth-configuration/custom-auth-configs).

### Step 4 — Connect through your application's flow

Bind the chosen Slack toolkit slug to the custom `ac_…` ID in your Composio session. Use the exact slug from that toolkit rather than assuming a bot and user variant are interchangeable. Generate the connection from that session, choose the development workspace, review the app name and permissions, then authorize.

This matters even if you previously clicked **Install to Workspace** in Slack: test the flow your product uses to create its Composio connected account. [Composio connection walkthrough](https://composio.dev/auth/slack_custom).

**Checkpoint:** Composio has an active connection for the expected workspace, made through your custom app.

## 5. Prove the intended behavior works

The following are acceptance tests to run, not completed test results.

1. **Confirm identity.** Call the equivalent of Slack `auth.test` using the connection. Expect `ok: true` and the intended workspace identity. [Authentication test](https://docs.slack.dev/reference/methods/auth.test/).
2. **Prepare the channel.** Add the app to `#oauth-test` and record that channel's ID. Avoid using a live customer channel for your first test.
3. **Perform the actual action.** With the tester's permission, post `OAuth setup test — safe to delete` using the equivalent of `chat.postMessage`. Expect success, a message timestamp, and a visible message from your bot. [Posting requirements](https://docs.slack.dev/reference/methods/chat.postMessage/).
4. **Test another installation if distributing.** Repeat from a second workspace using a different installer. Confirm each connection resolves to its own workspace.
5. **Test removal.** Uninstall the test app and confirm your product stops using that authorization and supports reconnection.

Keep the workspace ID, operation, redacted response, and date in the test record. Do not publish tokens or customer messages.

For a read/search product, replace the posting test with the exact history/search action against a known test message. Record both token type and conversation access.

## 6. Move from your workspace to customer workspaces

### For a pilot

Open **Manage Distribution → Share Your App with Other Workspaces**. Complete Slack's checklist and choose **Activate Public Distribution**. Distributed app URLs must satisfy Slack's HTTPS requirements. Test installation from your product in another workspace. Customer admins may still require approval or allow only Marketplace-listed apps. [Enable distribution](https://docs.slack.dev/app-management/distribution/).

Suggested admin request:

> Please approve Acme Assistant for [workspace]. It posts [type of update] in [channel]. It requests [scopes], stores [data], and can be removed using [instructions]. Our support and privacy information is [URLs].

### For Marketplace submission

First meet the 10-active-workspace requirement; Slack defines active here as used within the past 28 days. Prepare a working external installation, scope justifications, listing information, and a demo of installation, use, and removal. Supply a dedicated test account for your own service when needed; Slack asks for a way to install the app, not credentials to your test Slack workspace. Submit from **Submit to the Slack Marketplace**, resolve automated findings, then respond to review feedback. [Submission process](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/).

**While waiting:** continue permitted pilot testing, maintain working reviewer access, and keep the submission's contact monitored. If review identifies an excessive permission, remove the underlying feature dependency or explain its necessity; do not simply change the justification text while retaining unrelated access.

## 7. If something fails

| Symptom | Next action | Owner |
| --- | --- | --- |
| Redirect mismatch | Compare the requested URI, Slack's saved redirect, and the Composio config; restart OAuth | Developer |
| Installation requires approval | Send the workspace admin the permission list and installation request | Installer / admin |
| `missing_scope` | Identify the failing method's required permission; correct the scope category and reauthorize | Developer / installer |
| `not_in_channel` | Add the app to the intended channel, then retry | Channel member with appropriate access |
| `channel_not_found` | Check the channel ID, workspace, and private-channel access | Developer / workspace member |
| `invalid_auth` or revoked authorization | Verify the correct connected account; reconnect if authorization was removed | Developer / installer |
| Search fails despite posting working | Inspect whether the search method requires a user token; a bot token is not interchangeable | Developer |
| HTTP 429 | Respect `Retry-After`, reduce concurrency, and check the method's applicable limits | Developer |

These are diagnostic starting points; retain the exact provider error. [Method errors](https://docs.slack.dev/reference/methods/chat.postMessage/), [rate-limit handling](https://docs.slack.dev/apis/web-api/rate-limits/).

## 8. Account for production behavior

**History-heavy agents need a rate-limit check before launch.** Slack documents tighter `conversations.history` and `conversations.replies` limits for affected commercially distributed apps outside the Marketplace: one request per minute and 15 messages per request. Check applicability to your app and installations; this is not a blanket limit on every Slack method or internal app. [Rate-limit change](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/).

**Token rotation needs its own test.** With rotation enabled, Slack access tokens expire after 12 hours. Slack says rotation cannot be turned off once enabled. Verify refresh support using your exact Composio configuration in development before enabling it in production. [Token rotation](https://docs.slack.dev/authentication/using-token-rotation/).

**Permission changes require care.** Reauthorization can add scopes to an existing grant; removing a scope from a later request does not remove it from an existing token. Plan revocation and a fresh authorization when reducing permissions. [OAuth scope behavior](https://docs.slack.dev/authentication/installing-with-oauth/).

**You are ready for the tested milestone when** the correct workspace connects, the intended bot/user action succeeds, uninstall/reconnect works, and that milestone's admin or distribution requirements are satisfied. Marketplace readiness and a successful internal installation are separate statuses.

## 9. Where an agent helps, and where you take over

An agent can map methods to scopes, draft app descriptions, compare redirects, prepare a submission checklist, and run authorized tests. It can record exactly which workspace/action was tested and draft an admin request.

You sign in, handle MFA, enter secrets, accept permissions, and approve test messages. Workspace admins approve restricted installations. Your team supplies real product, privacy, and support information; Slack reviews Marketplace submissions.

**Evidence record:** OAuth, scopes, distribution, review, token rotation, rate limits, and Composio documentation reviewed. No workspace installation, message, refresh cycle, or submission completed. User-token/Real-time Search compatibility with the selected Composio toolkit remains untested. The bot-posting path is the defined baseline.
