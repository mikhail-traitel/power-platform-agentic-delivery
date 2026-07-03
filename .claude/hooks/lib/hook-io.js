'use strict';
// Shared helpers for PreToolUse hooks.
//
// The interesting one is projectedContent(): a PreToolUse hook fires BEFORE the edit is
// applied, but we want to check what the file WILL contain. So we reconstruct the post-edit
// text ourselves - reading the current file and folding in the Write/Edit/MultiEdit - and
// hand that to the caller (regex or AST). This lets a check run before the write commits.
//
// Every helper fails open: on any parse/read problem the caller should allow the action.
const fs = require('fs');

function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return null; // caller treats null as "allow"
  }
}

function getFilePath(input) {
  return (input && (input.file_path || input.filePath)) || '';
}

function applyOne(text, oldStr, newStr) {
  if (oldStr === '' || oldStr == null) return newStr + text; // Write-new / prepend semantics
  const idx = text.indexOf(oldStr);
  if (idx === -1) return text; // can't simulate; let the real tool surface the error
  return text.slice(0, idx) + newStr + text.slice(idx + oldStr.length);
}

// Returns the file content as it will look after this tool call, or null if it can't be built.
function projectedContent(input) {
  if (!input) return null;
  if (typeof input.content === 'string') return input.content; // Write
  const file = getFilePath(input);
  let current = '';
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch {
    current = ''; // new file
  }
  if (typeof input.new_string === 'string') {
    return applyOne(current, input.old_string, input.new_string); // Edit
  }
  if (Array.isArray(input.edits)) {
    return input.edits.reduce((acc, e) => applyOne(acc, e && e.old_string, e && e.new_string), current); // MultiEdit
  }
  return null;
}

// The text this call INTRODUCES (for diff-aware checks): Write -> content, Edit -> new_string,
// MultiEdit -> concatenated new_strings.
function addedText(input) {
  if (!input) return '';
  const parts = [];
  if (typeof input.content === 'string') parts.push(input.content);
  if (typeof input.new_string === 'string') parts.push(input.new_string);
  if (Array.isArray(input.edits)) for (const e of input.edits) if (e && e.new_string) parts.push(e.new_string);
  return parts.join('\n');
}

// The text this call REMOVES (for diff-aware checks).
function removedText(input) {
  if (!input) return '';
  const parts = [];
  if (typeof input.old_string === 'string') parts.push(input.old_string);
  if (Array.isArray(input.edits)) for (const e of input.edits) if (e && e.old_string) parts.push(e.old_string);
  return parts.join('\n');
}

function block(reason) {
  process.stderr.write(reason + '\n');
  process.exit(2);
}

function allow() {
  process.exit(0);
}

module.exports = { readStdinJson, getFilePath, projectedContent, addedText, removedText, block, allow };
