#!/usr/bin/env node
'use strict';
// PreToolUse hook: inject the path-scoped rule file for the file being edited, as extra context.
//
// Path-scoped rules in .claude/rules/ auto-load when Claude READS a matching file, but not always
// when it WRITES/EDITS a brand-new file it never read. This hook closes that gap deterministically:
// on an edit to a scoped path it streams the matching rule file into the model via
// `additionalContext`, with the YAML frontmatter stripped and a hard character cap.
//
// It never blocks - it only adds context (exit 0 with JSON on stdout).
const fs = require('fs');
const path = require('path');
const { readStdinJson, getFilePath } = require('./lib/hook-io');

const HARD_CAP = 9500; // stay under the additionalContext size limit

// Map an edited-file path to the rule file that should ride along. One entry per rule file in
// .claude/rules/, mirroring each rule's `paths:` frontmatter. First match wins.
const RULES_DIR = path.join(__dirname, '..', 'rules');
const MAP = [
  { test: /\.js$/i, rule: 'javascript.md' },
  { test: /\.cs$|[\\/]Plugins[\\/]/i, rule: 'csharp-plugins.md' },
  { test: /\.(fx|pa)\.ya?ml$|[\\/]CanvasApps[\\/]/i, rule: 'canvas.md' },
  { test: /\.flow\.json$|[\\/]Workflows[\\/].*\.json$/i, rule: 'power-automate.md' },
  { test: /customizations\.xml$|\.dataverse\.md$|[\\/]Entities[\\/]/i, rule: 'dataverse.md' },
];

function stripFrontmatter(md) {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function emit(context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context },
  }));
  process.exit(0);
}

const payload = readStdinJson();
if (!payload) process.exit(0);
const file = getFilePath(payload.tool_input || {});
if (!file) process.exit(0);

const hit = MAP.find((m) => m.test.test(file));
if (!hit) process.exit(0);

let body;
try {
  body = stripFrontmatter(fs.readFileSync(path.join(RULES_DIR, hit.rule), 'utf8'));
} catch {
  process.exit(0);
}
if (body.length > HARD_CAP) body = body.slice(0, HARD_CAP) + '\n...[truncated]';

emit('Conventions for the file you are about to edit (' + hit.rule + '):\n\n' + body);
