---
paths:
  - "**/Entities/**"
  - "**/customizations.xml"
  - "**/*.dataverse.md"
---

# Dataverse data model

Conventions for tables, columns, and relationships. Sourced from public Microsoft Learn Dataverse
guidance.

- **Use a consistent publisher prefix** on every custom table and column (this repo's samples use
  `sample_`). Mixing prefixes or using the default fragments the schema.
- **Respect column length limits and truncation.** A single-line text column has a maximum length;
  writing beyond it truncates. Decide length deliberately per column - do not leave it at a default
  that silently cuts data.
- **Model relationships, do not flatten.** Use lookups and N:N relationships rather than stuffing
  related data into delimited text columns. The latter defeats querying and reporting.
- **Use alternate keys for upserts and integration.** A natural alternate key makes idempotent writes
  and external-system correlation reliable.
- **Design security at the model.** Ownership (user/team), business units, and field-level security
  are the enforcement layer. Least privilege on roles; do not grant broad access for convenience.
- **Avoid excessive columns on one table.** Very wide tables hurt performance and form usability;
  split concerns into related tables.
- **Name for clarity.** Schema names and display names should read plainly; downstream apps, flows,
  and reports all depend on them.
