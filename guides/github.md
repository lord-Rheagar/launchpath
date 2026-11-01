# Set up your own GitHub OAuth app with Composio

Connect users' GitHub accounts under your app's identity, then verify access to the repositories your agent needs.

**Applies to:** GitHub.com OAuth Apps using Composio. GitHub Apps and GitHub Enterprise Server require different configuration. **Sources checked:** 30 October 2026. **Validation:** documentation reviewed; no authenticated setup or API execution performed.

## 1. Know what you are signing up for

**A straightforward setup for personal repositories. Organization access is the main dependency.** GitHub documents registration followed by user authorization without a general pre-launch OAuth approval submission. That does not guarantee access to a customer's organization. [Registration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), [authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

| Milestone | Plan for | What could hold it up |
| --- | --- | --- |
| First working connection | 25–45 minutes of hands-on work | Wrong callback, wrong credentials, or scopes that do not match the action |
| Access to an organization's private repository | Additional owner coordination | Organization restrictions, membership, or enterprise policy |
| Reliable background use | A separate refresh and reconnect test | An initial successful connection does not prove refresh works |

The hands-on range is an editorial estimate for someone with GitHub and Composio accounts already available: roughly 5–10 minutes choosing permissions, 10–15 configuring credentials, and 10–20 testing. It is not a measured setup time. No organization approval turnaround was found; ask the owner for a decision date before committing to a launch.

**First action:** choose one real operation and one test repository. Example: “Read issues from `acme/oauth-test`.” Keep that operation as your acceptance test throughout this guide.

## 2. Gather the prerequisites

- A GitHub account and permission to register the app under the intended owner. For a company product, choose an owner your team can maintain.
- Access to your Composio project and permission to create an auth config.
- A public-facing app name and homepage, such as `Acme Assistant` and `https://app.example.com`. Replace example values with your real details.
- A test user who already has access to the target repository.
- An organization owner contact if the repository belongs to an organization.

Your **OAuth app** identifies your integration. Its **Client ID and Client Secret** configure Composio. Each user then authorizes a separate **connected account**. Registering the app does not connect every user or grant organization access. [Composio authentication](https://docs.composio.dev/docs/authentication).

**App-type checkpoint:** this guide deliberately uses an OAuth App. If your product requires selection of individual repositories or finely limited permissions, evaluate a GitHub App before proceeding. Do not paste GitHub App credentials into an OAuth App configuration. [GitHub app-type guidance](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).

## 3. Select permissions before creating the connection

| Your agent needs to… | OAuth scope to consider | Important consequence |
| --- | --- | --- |
| Read public repository information | No additional scope where the endpoint permits | Do not add write access just to read public data |
| Modify public repositories | `public_repo` | Includes public-repository write capabilities |
| Work with private repositories | `repo` | Broad access, including writes; not a private-repository read-only permission |
| Read user profile information | `read:user` | Add only if your feature requires it |
| Read the user's email addresses | `user:email` | Separate from repository access |
| Read organization membership | `read:org` | Does not replace repository permissions or owner approval |
| Update workflow files | `workflow`, with applicable repository access | Exclude from ordinary issue-reading workflows |

Scopes cannot give a user permissions they do not already hold. Match the scope to the actual API operation, not just the feature's name. [GitHub scope reference](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

**Example decision:** a private-repository issue reader may require `repo` even though the product only reads issues. Record that mismatch in your customer-facing permission explanation; do not describe the grant as read-only.

## 4. Register the app and connect it to Composio

### Step 1 — Obtain the callback

Open the [Composio dashboard](https://dashboard.composio.dev), start **Create Auth Config**, select **GitHub**, and choose **OAuth2 with your own developer credentials**. Copy the redirect URI displayed in that configuration. Keep this form open. [Composio setup](https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app).

The current documented default is `https://backend.composio.dev/api/v3/toolkits/auth/callback`. Use the value displayed for your configuration. The older `/api/v1/auth-apps/add` URI also appears in existing guides; do not mix the two. Your provider callback must match the config's `oauth_redirect_uri`. [Callback reference](https://docs.composio.dev/docs/auth-configuration/custom-auth-configs).

### Step 2 — Register in GitHub

Open [GitHub developer settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**. On a first registration, the button may say **Register a new application**.

| Field | Enter |
| --- | --- |
| Application name | `Acme Assistant` — your actual product name |
| Homepage URL | Your real product homepage |
| Application description | `Connect GitHub to let Acme Assistant read issues you can access.` Adjust to your actual behavior |
| Authorization callback URL | The URI copied from Composio |
| Enable Device Flow | Leave off for this browser-based connection flow |

Click **Register application**. GitHub currently supports up to 10 callback URLs, but separate development and production apps are a sensible operational choice. **Expire user access tokens** is enabled by default. Leave the setting visible in your test record; verify compatibility before production. [Registration fields and settings](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).

**Checkpoint:** the app exists under the intended owner, and its callback matches the Composio configuration.

### Step 3 — Save credentials and permissions

In the GitHub app settings, copy the **Client ID** and generate a **Client Secret**. Enter these into Composio's corresponding fields, configure the selected scopes, create the auth config, and record its `ac_…` ID. Store the secret only in the credential field or your approved secret store. [GitHub-to-Composio walkthrough](https://composio.dev/auth/github).

### Step 4 — Explicitly use that configuration

When creating your Composio session, bind the `github` toolkit to this auth config ID. The essential mapping is:

```json
{ "github": "ac_YOUR_GITHUB_CONFIG_ID" }
```

This is configuration data, not a complete SDK example. Use the session-creation syntax for your installed SDK. Creating the config alone does not make a session use it. [Custom auth session configuration](https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app).

Start the GitHub connection from that session, sign in as the test user, and review the app name and permissions before authorizing. The consent screen should identify your app. A connected status is the first checkpoint; the resource test below is the second.

## 5. Prove the connection works

Run these checks through your application's Composio connection. The API paths identify what to test; they are not instructions to expose an access token in a browser.

| Check | Action | Pass condition |
| --- | --- | --- |
| Identity | Retrieve the authenticated user, equivalent to `GET /user` | The login matches your test account |
| Required resource | Read the target repository and list its issues, equivalent to `GET /repos/{owner}/{repo}/issues` | The expected repository and a known test issue are returned |
| Organization access | Repeat against an organization repository if that is your launch use case | It works for a representative non-owner customer account |
| Permission boundary | Attempt a read of a separate private repository the user cannot access | Access is denied |
| Reconnect | Revoke the test authorization, then reconnect | The app stops using the revoked connection and offers a working reconnect path |
| Background access | Repeat the read after the configured access-token lifetime | Refresh succeeds without another interactive sign-in |

These are proposed acceptance tests, not tests already passed. Save the operation, timestamp, connected-account identifier, and redacted result. A successful public-repository read alone is insufficient evidence for private-repository access. Endpoint references: [authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user), [repository issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues).

## 6. Handle organization approval

Organization restrictions can block an authorized OAuth app from organization resources. This is a decision by the customer's organization, separate from ordinary user consent. [Organization restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions).

The connecting user should open **GitHub Settings → Applications → Authorized OAuth Apps → your app**, locate the organization, and request access where available. Outside collaborators can request approval only if the organization permits those requests. [Request approval](https://docs.github.com/en/account-and-profile/how-tos/organization-membership/requesting-organization-approval-for-oauth-apps).

Send the owner a concrete request:

> Please approve Acme Assistant for [organization]. We need [operation] on [repository]. The OAuth grant requests [scopes]. In particular, `repo` grants broader access than our read-only product feature. Our data handling information is [URL]. The requesting GitHub user is [login].

While waiting, complete tests on a repository you control. Keep the customer organization marked **Waiting for owner approval**. After approval, rerun the exact blocked operation; do not infer success from the approval email alone.

## 7. If something fails

| Symptom | Check and next action | Who acts |
| --- | --- | --- |
| Callback error | Compare the provider callback with the Composio config character for character; restart the connection | Developer |
| Wrong app name on consent | Confirm the session points to the intended auth config and that its Client ID belongs to your app | Developer |
| Profile works, private repo returns 404/403 | Verify repository spelling, user's access, granted scopes, then organization approval | Developer, user, possibly owner |
| Scope added but action still fails | Reauthorize the connection with the required scope and retest; changing a config is not evidence of new consent | User |
| Organization missing from approval controls | Check membership and whether outside-collaborator requests are allowed | Organization owner |
| Connection stops after several hours | Inspect refresh errors and app token-expiry setting; reproduce on a development connection | Developer / Composio support |

For scope debugging, GitHub's response headers can expose `X-OAuth-Scopes` and `X-Accepted-OAuth-Scopes`. Capture those headers where available, without token values. [Scope diagnostics](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

## 8. Before customer launch

GitHub documents eight-hour expiring access tokens and refresh tokens that expire after six months of non-use. Refresh rotates the credentials. Composio's general refresh support is not proof that this exact configuration has passed a refresh cycle. **Outstanding validation: verify GitHub expiring-token behavior in the selected Composio toolkit.** [GitHub token lifecycle](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

- Record the app owner, config ID, scope rationale, support contact, and secret-rotation owner.
- Confirm organization access with the kind of user who will actually connect.
- Treat revoked access as a reconnect condition, not an endless retry.
- Reassess consent whenever a feature adds permissions.
- Keep webhook or polling setup separate: OAuth success does not prove a trigger is configured.

**You are ready for the tested use case when** the correct user connects under your app name, the target operation succeeds, organization approval is resolved where needed, and refresh/reconnect behavior has been exercised.

## 9. Where an agent helps, and where you take over

An agent can research permissions, draft field values, compare callback/config values, prepare the owner request, and run authorized tests. With an authenticated browser it can assist with form entry.

You choose the app owner and acceptable permissions, sign in, complete MFA and consent, and handle secret entry. The organization owner grants organization access. The agent cannot promise their approval.

**Evidence record:** official registration, scope, authorization, organization-access, and Composio documentation reviewed. No app registered, secret generated, organization request sent, or live connection tested in preparing this guide. The token-refresh check remains a specific follow-up, not an implied success.
