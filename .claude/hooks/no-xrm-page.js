#!/usr/bin/env node
'use strict';
// PreToolUse hook: block the deprecated `Xrm.Page` API in JavaScript web resources.
//
// Diff-aware: it blocks the INTRODUCTION of `Xrm.Page`, not its mere presence. An edit that
// removes or reduces `Xrm.Page` (a cleanup) is allowed even though the string still appears
// in old_string. For a Write (full-file rewrite) the hook reads the CURRENT file and compares
// occurrence counts, so a rewrite that keeps or reduces pre-existing matches is a cleanup,
// not an introduction. Naive hooks that block on any match punish the very refactors you want.
//
// Exit 2 blocks (stderr shown to the model); exit 0 allows. Fails open.
const fs = require('fs');
const { readStdinJson, getFilePath, addedText, removedText, block, allow } = require('./lib/hook-io');

const PATTERN = /\bXrm\.Page\b/g;
const countMatches = (s) => ((s || '').match(PATTERN) || []).length;

const payload = readStdinJson();
if (!payload) allow();

const input = payload.tool_input || {};
const file = getFilePath(input);
if (!/\.js$/i.test(file)) allow();

let net;
if (typeof input.content === 'string') {
  // Write: compare against the file as it exists on disk (empty for a new file).
  let current = '';
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch {
    current = ''; // new file
  }
  net = countMatches(input.content) - countMatches(current);
} else {
  // Edit / MultiEdit: compare the added vs removed spans.
  net = countMatches(addedText(input)) - countMatches(removedText(input));
}

if (net > 0) {
  block(
    'Blocked: this edit introduces the deprecated `Xrm.Page` API. Get the form context from the ' +
    'execution context instead:\n' +
    '  function onLoad(executionContext) {\n' +
    '    const formContext = executionContext.getFormContext();\n' +
    '  }\n' +
    'See .claude/rules/javascript.md. (Removing Xrm.Page is fine - this only blocks introducing it.)'
  );
}
allow();
