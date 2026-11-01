# Custom OAuth guide library

These guides cover developer-owned provider apps connected through Composio:

- [GitHub](github.md): personal and organization repository access.
- [Slack](slack.md): bot setup, workspace pilots, and Marketplace distribution.
- [Google](google.md): shared client setup with Gmail, Drive, and Calendar scope branches.

Each follows the same user journey: assess the work → gather prerequisites → choose permissions → configure the app → prove the feature works → handle approval → recover from blockers → maintain access. The baseline feature is explicit so a passing test has a clear meaning.

## Research and validation

Official documentation was reviewed on 30 October 2026. Inline links support provider-specific claims. Hands-on time ranges are editorial planning estimates, not measurements; provider wait estimates are identified separately. All acceptance tests are proposed, not executed. No credentials were collected or accounts modified.

Treg was requested and attempted. Its public catalog returned a search endpoint priced at $0.005 per request, but the account check and search call returned an invalid/expired-token error. No successful Treg search result was used. Research continued through the available web tool against official provider and Composio sources. To restore Treg, reauthenticate with `treg login` and refresh its MCP configuration with `treg mcp install`, as instructed by the service. No claim of completed Treg deeper research is made.

## Corrections and important findings

- GitHub's current registration documentation supports multiple callbacks and enables expiring user tokens by default. Older assumptions about one callback or perpetual OAuth access tokens are not used.
- GitHub organization approval is separate from user consent; broad `repo` access is not described as read-only.
- Slack distinguishes bot and user scopes. Its current `search:read` page marks that scope legacy.
- Slack's current submission guide specifies 10 active workspaces, preliminary feedback up to 10 business days, and a new-app functional review up to 10 weeks. These are launch dependencies, not app-registration steps.
- Google review depends on scopes and audience. Read-only Gmail and broad Drive scopes can still be restricted.
- Google's general client-creation documentation conflicts with its server-flow and Composio documentation on client secrets. The guide exposes this discrepancy and gives a stop condition instead of inventing a working setup.
- Provider-specific Composio walkthroughs include legacy callback examples. The guides use the config's displayed URI as the authoritative value for that configuration.

## What should be validated next

1. Perform each baseline setup in a development account, recording field labels and elapsed active time.
2. Verify the selected Composio toolkit's scope and token-type behavior.
3. Execute the feature and permission-boundary checks with test data.
4. Test refresh and revoked-grant reconnection separately from first connection.
5. Update the evidence record with exact attempts, corrections, redacted results, and remaining blockers.

The documents are complete walkthrough drafts backed by documentation, not claims that authenticated setup attempts have already passed. They do not replace the assignment's working experience or live-generation demonstration.
