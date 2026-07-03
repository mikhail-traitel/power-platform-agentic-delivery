---
paths:
  - "**/*.cs"
  - "**/Plugins/**"
---

# Dataverse plugins (C#)

Conventions for plugin and custom workflow assemblies. Sourced from public Microsoft Learn plugin
guidance.

- **Plugins must be stateless.** The platform caches and reuses instances across invocations and
  threads. Never store request state in instance fields; keep everything in local scope.
- **Respect the execution budget.** A synchronous plugin must finish well within the platform's
  2-minute limit. Offload long-running work to an async process; do not block the pipeline.
- **Register on the correct stage.** Pre-validation (outside the transaction) for cross-entity checks
  that must run before the DB transaction; pre-operation to modify the target before write;
  post-operation for follow-up. Choosing the wrong stage is a correctness bug, not a style choice.
- **Guard against recursion - but do NOT gate on `context.Depth`.** Microsoft Learn says to take
  no dependency on the Depth value: gating on `Depth > 1` silently skips legitimate executions that
  reach depth > 1 by another path (import, cascade, another plug-in). Instead, register the step with
  the narrowest filtering attributes so your own update does not re-trigger it, and use
  `SharedVariables` as a run-once guard when the same operation can re-enter. See
  `plugins-execution-depth` in `catalog/pp-constraint-catalog.yml`.
- **Retrieve only the columns you need.** Never `new ColumnSet(true)`; name the columns. Over-fetching
  is a real performance and locking cost at scale.
- **Fail with the right exception.** Throw `InvalidPluginExecutionException` with a clear message for
  user-facing validation failures; do not swallow exceptions silently.
- **Use the provided services** from the service provider (`IPluginExecutionContext`,
  `IOrganizationServiceFactory`, `ITracingService`). Trace generously - it is your only production
  diagnostic.
- **Do not hardcode configuration.** Use plugin step secure/unsecure config or environment variables,
  not literals.
