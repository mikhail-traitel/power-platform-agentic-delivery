---
paths:
  - "**/Workflows/**/*.json"
  - "**/*.flow.json"
---

# Power Automate flows

Conventions for cloud flows. Sourced from public Microsoft Learn Power Automate guidance.

- **Name actions meaningfully.** "Compose 2" and "Condition 3" are unmaintainable. Name every action
  for what it does; run history and error messages reference these names.
- **Handle errors explicitly.** Use scopes (try / catch / finally) with `configure run after`, so a
  failure is caught and reported rather than leaving the process half-done.
- **Avoid unnecessary runs.** Add trigger conditions so a flow only fires when it actually should,
  instead of running on every change and exiting early.
- **Do not nest `Apply to each` when a query would do.** Filter with an OData `$filter` on the source
  (or a Dataverse FetchXML) rather than looping in memory. Nested loops are a performance cliff.
- **Paginate large reads.** Enable pagination (or page explicitly) on list actions, or you silently
  process only the first page.
- **Externalize configuration.** Use environment variables for URLs, IDs, and thresholds, not
  hardcoded literals, so the flow moves cleanly across environments.
- **Prefer synchronous enforcement in a plugin** when a rule must be guaranteed before a write; a flow
  is asynchronous and can lag. Use flows for orchestration, not for hard invariants.
