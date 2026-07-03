---
paths:
  - "**/WebResources/**/*.js"
  - "**/*.webresource.js"
---

# JavaScript web resources (model-driven apps)

Conventions for form and ribbon scripts. Sourced from public Microsoft Learn client-scripting
guidance.

- **Never use `Xrm.Page`.** It is deprecated. Get the form context from the execution context:
  `function onLoad(executionContext) { const formContext = executionContext.getFormContext(); ... }`.
  (Enforced by the `no-xrm-page` hook.)
- **Always accept `executionContext` as the first handler parameter** and pass it in the event
  registration. Do not rely on global page state.
- **Do not hardcode GUIDs, environment URLs, or org names.** Resolve them at runtime or read them
  from configuration. Hardcoded IDs break on deploy to another environment.
- **Namespace your functions** (e.g. `Contoso.Event.onLoad`) so multiple web resources do not collide
  in the global scope.
- **Use the platform dialogs**, not the browser's: `Xrm.Navigation.openAlertDialog` /
  `openConfirmDialog`, not `alert()` / `confirm()`.
- **Prefer async APIs and await them**: `formContext.data.save()` returns a promise; handle success
  and failure. Do not fire-and-forget saves.
- **Unregister what you register.** Handlers added dynamically should be removed to avoid leaks.
- **Keep DOM manipulation out.** Do not reach into the platform's DOM; use the supported client API.
  Direct DOM hacks break on every platform update.
