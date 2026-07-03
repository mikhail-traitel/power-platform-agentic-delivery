#!/usr/bin/env node
'use strict';
// PreToolUse hook: a CONTEXT-SENSITIVE rule you cannot express with a regex -
// "direct `console.*` calls are allowed ONLY inside one designated logging-bootstrap function;
// everywhere else, route through the app logger." Enforced by parsing the AST of the file's
// PROJECTED post-edit content (see lib/hook-io.js) with acorn, walking the tree while carrying
// the enclosing-function name down, and blocking only calls INTRODUCED outside the allowed function
// (diff-aware: it compares offender count in the current vs projected file).
//
// Configurable via .claude/hooks/config.json:
//   { "consoleAllowedInFunction": "bootstrapLogging",
//     "consoleMethods": ["log","error","warn"],
//     "suggestedLogger": "AppLog.error(...)" }
//
// Zero-added-dependency posture: resolves acorn if present, else FAILS OPEN with a note.
// (Add acorn via `npm install` to activate the check - see package.json.)
const fs = require('fs');
const path = require('path');
const { readStdinJson, getFilePath, projectedContent, block, allow } = require('./lib/hook-io');

let acorn;
try {
  acorn = require('acorn');
} catch {
  process.stderr.write('note: acorn not installed; console-context AST check skipped (npm install to enable)\n');
  allow();
}

function loadConfig() {
  const def = { consoleAllowedInFunction: 'bootstrapLogging', consoleMethods: ['log', 'error', 'warn'], suggestedLogger: 'your app logger' };
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    return Object.assign(def, cfg);
  } catch {
    return def;
  }
}

function isConsoleCall(node, methods) {
  return (
    node.type === 'CallExpression' &&
    node.callee && node.callee.type === 'MemberExpression' &&
    node.callee.object && node.callee.object.name === 'console' &&
    node.callee.property && methods.includes(node.callee.property.name)
  );
}

// Recursive walk that carries the enclosing function name and recovers names for anonymous
// function expressions assigned to a variable or member (acorn gives no parent links).
function parseAny(src) {
  // Try ESM first: PCF controls and modern web resources use import/export, which throw
  // under sourceType:'script' (and used to make this whole check silently no-op on exactly
  // the modern code it guards). Fall back to script for classic web resources with top-level
  // return / non-module syntax. null only if BOTH fail (likely mid-edit) -> caller fails open.
  for (const sourceType of ['module', 'script']) {
    try {
      return acorn.parse(src, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true });
    } catch {
      /* try next */
    }
  }
  return null;
}

function countOffenders(src, cfg) {
  const ast = parseAny(src);
  if (!ast) return null; // unparseable under module and script -> caller fails open
  let offenders = 0;

  function walk(node, enclosing) {
    if (!node || typeof node.type !== 'string') return;

    if (isConsoleCall(node, cfg.consoleMethods) && enclosing !== cfg.consoleAllowedInFunction) {
      offenders++;
    }

    let scopeName = enclosing;
    if (node.type === 'FunctionDeclaration' && node.id) scopeName = node.id.name;
    else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      scopeName = node.__nameFromDeclarator || (node.id && node.id.name) || '(anonymous)';
    }

    for (const key of Object.keys(node)) {
      if (key === 'type' || key.startsWith('__')) continue;
      const val = node[key];
      const children = Array.isArray(val) ? val : [val];
      for (const child of children) {
        if (!child || typeof child.type !== 'string') continue;
        // name recovery: `const foo = function(){}` / `obj.foo = () => {}`
        if (node.type === 'VariableDeclarator' && key === 'init' &&
            (child.type === 'FunctionExpression' || child.type === 'ArrowFunctionExpression') && node.id) {
          child.__nameFromDeclarator = node.id.name;
        }
        if (node.type === 'AssignmentExpression' && key === 'right' &&
            (child.type === 'FunctionExpression' || child.type === 'ArrowFunctionExpression') &&
            node.left && node.left.type === 'MemberExpression' && node.left.property) {
          child.__nameFromDeclarator = node.left.property.name;
        }
        walk(child, scopeName);
      }
    }
  }
  walk(ast, null);
  return offenders;
}

const payload = readStdinJson();
if (!payload) allow();
const input = payload.tool_input || {};
const file = getFilePath(input);
if (!/\.js$/i.test(file)) allow();

const cfg = loadConfig();
const projected = projectedContent(input);
if (projected == null) allow(); // couldn't build post-edit text -> fail open

const after = countOffenders(projected, cfg);
if (after == null) allow(); // unparseable -> fail open

let before = 0;
try {
  before = countOffenders(fs.readFileSync(file, 'utf8'), cfg) || 0;
} catch {
  before = 0; // new file
}

if (after > before) {
  block(
    'Blocked: this edit introduces a direct `console.*` call outside `' + cfg.consoleAllowedInFunction + '()`. ' +
    'Route logging through ' + cfg.suggestedLogger + ' so it is centrally controlled. ' +
    '(Direct console calls are allowed only inside the logging-bootstrap function.) See .claude/rules/javascript.md.'
  );
}
allow();
