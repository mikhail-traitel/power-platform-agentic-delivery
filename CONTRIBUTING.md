# Contributing

Thanks for your interest. This is a reference implementation, so the most useful contributions are
patterns, corrections, and generalizations that help others apply agentic delivery to Power Platform.

## Ground rules

- **Keep it generic and public.** Everything here must be sourced from public Microsoft Learn
  documentation or general Power Platform practice. Do not add anything specific to a client, an
  employer, or a private tenant - no proprietary rules, schemas, entity names, or screenshots.
- **Cite the source** for a new rule (a Microsoft Learn URL or a documented platform behavior).
  A rule earns its place only if violating it causes a real problem (a runtime error, a silent
  wrong result, a broken deployment, or a security gap) - not merely a style preference.
- **Sample schema uses the `sample_` prefix.** Never use a real publisher prefix.

## How to contribute

1. Open an issue describing the pattern, rule, or fix.
2. For a new rule, say which file type it scopes to and what failure it prevents.
3. For a new agent or skill, keep the prompt focused on a single SDLC stage or concern.
4. Keep hooks dependency-light where possible; if an AST check needs a parser, note it in the PR.

## Style

- Markdown, plain hyphens (no em-dashes), English.
- Keep documents scannable: short sections, concrete examples.
