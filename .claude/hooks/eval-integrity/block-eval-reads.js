#!/usr/bin/env node
'use strict';
// PreToolUse (Read|Grep|Glob) hook: eval-integrity guard.
//
// An adversarial reviewer must keep "fresh eyes." If a reviewer agent can read the answer key -
// the human resolutions, the grading scripts, the metrics log, prior cross-model reviews - its
// findings are contaminated. This hook DENIES those reads, but ONLY when the caller is one of the
// protected reviewer agents; the main session and every other agent are unaffected.
//
// Denies via the PreToolUse permissionDecision JSON. Fails open (allow) on anything unexpected -
// a guard that crashes must not wedge the session.
const fs = require('fs');
const path = require('path');

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return null; }
}
function config() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')); } catch { return {}; }
}
function agentType(p) {
  return p.agent_type || p.subagent_type || p.agent || (p.agent_context && p.agent_context.type) || '';
}
function targetPath(input) {
  return input.file_path || input.path || input.pattern || '';
}

const p = readStdin();
if (!p) process.exit(0);
const cfg = config();
const who = agentType(p);
if (!Array.isArray(cfg.protectedReviewerAgents) || !cfg.protectedReviewerAgents.includes(who)) {
  process.exit(0); // not a protected reviewer -> allow
}
const target = String(targetPath(p.tool_input || {}));
const patterns = (cfg.evalDataPatterns || []).map((s) => { try { return new RegExp(s, 'i'); } catch { return null; } }).filter(Boolean);

if (patterns.some((rx) => rx.test(target))) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Eval-integrity guard: reviewer agent "' + who + '" may not read evaluation data ' +
        '(resolutions / grading / metrics / prior reviews). This protects fresh-eyes review.',
    },
  }));
  process.exit(0);
}
process.exit(0);
