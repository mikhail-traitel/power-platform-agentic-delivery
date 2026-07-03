#!/usr/bin/env node
'use strict';
// PreToolUse hook: block hardcoded GUID literals introduced into JavaScript web resources.
// A hardcoded record/entity ID breaks when the solution is deployed to another environment.
// Diff-aware (only blocks a GUID this edit ADDS): for Edit/MultiEdit it compares the added vs
// removed spans; for a Write (full-file rewrite) it reads the CURRENT file and compares GUID
// counts, so a rewrite that keeps or reduces pre-existing GUIDs is a cleanup, not an
// introduction. Exit 2 blocks; exit 0 allows. Fails open.
const fs = require('fs');
const { readStdinJson, getFilePath, addedText, removedText, block, allow } = require('./lib/hook-io');

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const countMatches = (s) => ((s || '').match(GUID) || []).length;

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
    'Blocked: this edit introduces a hardcoded GUID in a web resource. Hardcoded record/entity IDs ' +
    'break when the solution moves to another environment. Resolve IDs at runtime or read them from ' +
    'configuration (environment variables). See .claude/rules/javascript.md.'
  );
}
allow();
