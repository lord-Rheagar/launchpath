# Set up your own Google OAuth client with Composio

Connect Gmail, Google Drive, or Google Calendar under your product's identity, then follow the verification path required by your audience and permissions.

**Applies to:** user-consent OAuth for a web-based integration. Service accounts, domain-wide delegation, native/mobile clients, and Marketplace publishing are separate paths. **Sources checked:** 30 October 2026. **Validation:** documentation reviewed; no Cloud Console setup, consent, or live API execution performed.

## 1. Know what you are signing up for

**A test connection is usually a small setup task. Public launch can become a multi-week verification project. Choose scopes first.** “Google OAuth approved” is too broad a milestone: reading an inbox and accessing a user-selected Drive file have different review implications.

| Milestone | Hands-on planning estimate | External waiting |
| --- | --- | --- |
| First connection with an approved test user | 45–90 minutes | Normally no completed production verification needed for the development path |
| Prepare a production verification submission | Half a day to two days once the product, website, and data practices are ready | Depends on scope category |
| Brand verification, where required | Included in submission preparation | Google publishes 2–3 business days |
| Sensitive-scope verification | Additional feature explanations and demonstration | Google publishes about 10 business days |
| Restricted-scope verification | Additional policy and potentially security-assessment work | Google publishes about 6 weeks; remediation and assessment can add work |

Hands-on figures are editorial planning estimates, not observed timings, and exclude product development, legal drafting, domain procurement, and security remediation. Google's review figures are estimates, not guarantees. [Google verification FAQ](https://support.google.com/cloud/answer/13463817?hl=en).

**Cost checkpoint:** no paid assessment is needed merely to demonstrate this take-home's test connection. A public restricted-scope integration may require a third-party security assessment; obtain an actual quote rather than putting an invented fixed price in your launch plan. [Restricted-scope requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

**First action:** write the smallest useful feature, for example “Create a document in Drive” or “Read messages from a Gmail inbox.” Use the table below before touching the Cloud Console.

## 2. Choose your Google product and scope

Use complete scope URLs in configuration; the suffix alone is not the scope string.

| Feature | Scope | Practical consequence |
| --- | --- | --- |
| Create or work with files specifically shared with your app | `https://www.googleapis.com/auth/drive.file` | Non-sensitive; not access to every existing Drive file |
| Read/download all accessible Drive files | `https://www.googleapis.com/auth/drive.readonly` | Restricted, despite being read-only |
| Send Gmail messages without inbox reading | `https://www.googleapis.com/auth/gmail.send` | Sensitive |
| Read Gmail messages | `https://www.googleapis.com/auth/gmail.readonly` | Restricted |
| Read, send, and modify Gmail messages | `https://www.googleapis.com/auth/gmail.modify` | Restricted; broader than reading |
| View calendar events | `https://www.googleapis.com/auth/calendar.events.readonly` | Event access; confirm its displayed review category in Data Access |
| Create/change events on calendars the user owns | `https://www.googleapis.com/auth/calendar.events.owned` | Narrower than full Calendar administration; confirm the tool supports it |

Sources: [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth).

**Drive nuance:** `drive.file` works for files created by your app or selected/shared through supported app flows such as Google Picker. Entering an arbitrary existing file ID does not automatically grant access. If your feature needs existing files, implement and test that selection flow; do not silently replace the scope with whole-Drive access. [Per-file access](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

**Gmail nuance:** draft management via `gmail.compose` is restricted. A “drafts only” feature does not necessarily have the same review path as send-only access. [Gmail scope categories](https://developers.google.com/workspace/gmail/api/auth/scopes).

**Concrete baseline:** demonstrate a Drive file created by the app using `drive.file`. For an inbox agent, use the Gmail branch and explicitly plan the restricted-scope path. Do not misrepresent the Drive example as evidence that Gmail production verification is solved.

## 3. Gather the prerequisites

- A Google account with permission to create/select a Cloud project, enable APIs, and manage its OAuth configuration. If a control is unavailable, ask the project administrator for the required access.
- A Composio project and the exact toolkit needed: for example Gmail, Google Drive, or Google Calendar.
- A test account with access to the data being tested.
- Your app name, monitored support email, and developer contact email.
- For external production: a real homepage, privacy policy, relevant terms, domain-ownership access, and an accurate description of data collection, storage, sharing, and deletion.

Choose **Internal** only for an eligible organization project whose users are within that Workspace organization. Choose **External** for consumer Google accounts or users outside that organization. Internal use can qualify for verification exceptions; Workspace admin policy can still restrict access. [Consent and audience configuration](https://developers.google.com/workspace/guides/configure-oauth-consent), [verification exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

## 4. Configure the project, consent screen, and client

### Step 1 — Enable the API you need

Open the [Google Cloud Console](https://console.cloud.google.com), choose or create your project, then open **APIs & Services → Library**. Search for **Google Drive API**, **Gmail API**, or **Google Calendar API**, open the result, and select **Enable**. Enable each API your actual feature uses. OAuth credentials alone do not enable the API. [API enablement](https://support.google.com/cloud/answer/13461325?hl=en).

### Step 2 — Configure consent

Open **Google Auth Platform → Branding**. If this is a new configuration, choose **Get Started**. Supply the app name, support email, audience, and developer contact. Complete the setup.

Under **Audience**, add your test account under **Test users** for an External testing app. Under **Data Access → Add or Remove Scopes**, add the minimum chosen scope URLs and save. Record their displayed sensitivity categories. [Consent-screen steps](https://developers.google.com/workspace/guides/configure-oauth-consent).

Suggested example values:

| Field | Example / source of value |
| --- | --- |
| App name | `Acme Assistant` |
| Support email | An address you monitor |
| Audience | External for the cross-organization example |
| Test user | The exact Google account used for the first connection |
| Data Access | `https://www.googleapis.com/auth/drive.file` for the baseline |
| Homepage / privacy / terms | Your real public pages before production submission |

**Checkpoint:** the correct project and audience are selected, the tester is listed where required, and no broad scopes were added accidentally.

### Step 3 — Obtain Composio's callback

Start a custom OAuth2 auth config for your selected Google toolkit in [Composio](https://dashboard.composio.dev). Copy the redirect URI shown there. This is where Google returns its authorization response; it is different from the page your product shows after connection. [Google-to-Composio setup](https://composio.dev/auth/googleapps).

### Step 4 — Create the OAuth client

Open **Google Auth Platform → Clients → Create Client**. Choose **Web application**. Name it `Acme Assistant — Development` and add the Composio URI under **Authorized redirect URIs**. Do not put it in **Authorized JavaScript origins**. Create the client. [Client creation](https://developers.google.com/workspace/guides/create-credentials).

The current Google instructions also describe an optional **Use this client for an AI-powered agent** setting, which cannot be changed after client creation. They advise separate clients for agent and ordinary user workflows. Its compatibility with the chosen Composio flow has not been tested here; record your choice and validate before production. [AI client setting](https://developers.google.com/workspace/guides/create-credentials).

### Step 5 — Configure Composio and connect

Enter the Google **Client ID** and **Client Secret** into the fields required by your Composio auth config, set its scopes to the chosen set, save it, and record its `ac_…` ID. Keep credentials out of your guide, source repository, browser code, and screenshots. [Composio Google credential guide](https://composio.dev/auth/googleapps).

**Documentation discrepancy:** Google's general credential guide currently says web applications do not use client secrets, while its server-side OAuth guide and Composio's credential guide use them. This guide follows the documented Composio confidential-client flow. If your newly created client has no secret, stop at this checkpoint and confirm client type and supported authentication method with Composio; do not insert a dummy value. [Google server-side flow](https://developers.google.com/identity/protocols/oauth2/web-server), [credential guide](https://developers.google.com/workspace/guides/create-credentials).

Bind each toolkit you use to its custom config ID in the session. Google services have individual toolkit slugs, such as `gmail`, `googledrive`, and `googlecalendar`; use the actual selected toolkit's slug. [Composio Google toolkit guidance](https://docs.composio.dev/kb/guide/toolkits-googledocs).

Start the connection and sign in with the listed test account. Inspect the app name and requested permissions before consent. Test warnings are not proof of production approval.

## 5. Prove the required feature works

Use your application's Composio connection. Choose the row matching your feature; a successful login alone is not the acceptance test.

| Feature | Proposed test | Pass condition |
| --- | --- | --- |
| Drive with `drive.file` | Create a harmless file named `oauth-setup-test.txt`, then read that file | Both operations succeed on the file created by this app |
| Drive existing-file access | Select a test file through the implemented picker, then read it | Access works for the selected file without whole-Drive scope |
| Gmail reading | Read one known message in a dedicated test inbox | Correct account and expected message returned |
| Gmail sending | With permission, send a clearly labeled test email to an address you control | Send succeeds and the recipient receives it |
| Calendar reading | Read a known event from an accessible test calendar | Expected event returned |
| Calendar writing | With permission, create and remove a test event on an owned calendar | Both operations succeed with the selected scope |

Then revoke the test grant and exercise reconnection. For unattended agents, run another operation after access-token expiry and confirm refresh works. Record date, toolkit, config ID, operation, granted scopes where available, and a redacted result. These tests have **not** been executed in preparing this guide.

## 6. Follow the right production verification path

**First classify the actual requested scopes, not just those listed in the console.** A toolkit requesting additional permissions can change the review path. An app using only non-sensitive scopes avoids sensitive/restricted scope review, but branding requirements may still apply. [Scope and consent requirements](https://developers.google.com/workspace/guides/configure-oauth-consent).

For an external production app, prepare:

1. A functioning product and publicly accessible homepage and privacy policy.
2. Verified ownership of the domains used for your app's public information.
3. A justification for each requested scope tied to a visible feature.
4. A demonstration showing authorization and the feature using each requested sensitive/restricted permission.
5. Current project contacts who can respond to Google's questions.

Use the console's verification workflow to submit the requested materials. Publishing the audience to production and completing verification are separate steps. [Submission instructions](https://support.google.com/cloud/answer/13461325?hl=en).

Suggested scope explanation:

> We request [full scope] so the user can [specific action]. The feature is shown at [demo timestamp]. We cannot use [narrower alternative] because [concrete limitation]. We store [data] for [duration] and delete it through [user-facing process].

Use this only with truthful product details. “Our agent needs it” is not a useful justification.

**For restricted scopes:** check whether your use qualifies for an exception. Otherwise, establish whether restricted data passes through your servers or third-party services, including Composio and model providers. Google's requirements describe an annual security assessment for applicable server-access cases. An integration intermediary does not establish an exemption for your product. [Restricted-scope verification and assessment](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

While review is pending, keep development within the permitted test setup and respond to the verification email thread. If rejected, correct the cited issue and resubmit the required materials; do not treat user warnings as a permanent production onboarding solution. [Verification FAQ](https://support.google.com/cloud/answer/13463817?hl=en).

## 7. If something fails

| Symptom | Next action | Owner |
| --- | --- | --- |
| `redirect_uri_mismatch` | Compare the URI in the request with this client's authorized redirect URI and Composio's configuration, including path and trailing slash | Developer |
| Tester cannot enter the app | Confirm the exact signed-in account is listed and that the audience allows it | Project maintainer / tester |
| `admin_policy_enforced` | Ask the customer's Workspace admin to review the client and scopes | Customer admin |
| API disabled / service not used | Enable the specific API in the project that owns this client | Project maintainer |
| Insufficient permissions | Compare actual granted scopes with the failing method, then request consent again if needed | Developer / user |
| Drive file missing with `drive.file` | Confirm it was created by or explicitly shared with this app; test the selection flow | Developer / user |
| `invalid_grant` on refresh | Check revocation, testing-mode expiry, and refresh-token lifecycle; reconnect when the grant is no longer valid | Developer / user |
| Verified app still shows warnings | Check whether the request includes scopes outside the approved set | Developer |

Sources: [server-flow errors](https://developers.google.com/identity/protocols/oauth2/web-server), [token lifecycle](https://developers.google.com/identity/protocols/oauth2), [verification FAQ](https://support.google.com/cloud/answer/13463817?hl=en).

## 8. Plan for continued access

External apps in **Testing** generally receive refresh tokens that expire after seven days. Google documents an exception when only basic identity scopes are requested. This makes a week-old broken test connection different from a randomly failing production refresh. Refresh tokens can also stop working for other reasons, including revocation. [Token expiration rules](https://developers.google.com/identity/protocols/oauth2).

Unattended access requires an appropriate offline authorization and refresh flow. Verify that the actual Composio connection retains and refreshes the needed grant; do not infer this from the first API response. [Offline access](https://developers.google.com/identity/protocols/oauth2/web-server).

Before customer launch, record:

- Audience and publishing status.
- Actual requested scopes and verification status for those scopes.
- Successful feature, refresh, revocation, and reconnect tests.
- Customer-admin requirements where applicable.
- Data deletion process, support owner, and any assessment renewal date.

**You are ready for the tested milestone when** the intended user can connect, the actual feature succeeds with the intended scope, and the requirements for your audience and release status are satisfied. A test-user connection does not establish public launch readiness.

## 9. Where an agent helps, and where you take over

An agent can research scope alternatives, draft field values, compare requested and declared permissions, prepare a verification evidence checklist, and run authorized tests with test data.

You sign in, complete MFA, choose the audience and data practices, enter credentials, approve consent and test writes, and submit accurate product claims. Domain owners verify domains, Workspace admins decide organizational access, and Google or its assessors make verification decisions.

**Evidence record:** Google scope, consent, client, token, and verification documentation cross-checked with Composio guidance. No Cloud project, OAuth client, test grant, assessment, or verification submission created. Client-secret documentation conflicts and the AI-client setting are explicitly unresolved integration checks. The guide does not claim an approved app or a passing refresh test.
