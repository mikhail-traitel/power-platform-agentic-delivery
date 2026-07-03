#!/usr/bin/env node
'use strict';
// PreToolUse (Write|Edit) hook: eval-integrity guard.
//
// Threat model: an adversarial reviewer editing its OWN rubric or skill definition to make its
// findings pass is a trivially exploitable failure mode. This hook DENIES writes/edits to the
// reviewer skill directories, but ONLY when the caller is one of the protected reviewer agents.
// The main session (where you legitimately maintain those skills) is unaffected.
//
// Denies via the PreToolUse permissionDecision JSON. Fails open (allow) on anything unexpected.
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

const p = readStdin();
if (!p) process.exit(0);
const cfg = config();
const who = agentType(p);
if (!Array.isArray(cfg.protectedReviewerAgents) || !cfg.protectedReviewerAgents.includes(who)) {
  process.exit(0);
}
const input = p.tool_input || {};
const target = String(input.file_path || input.filePath || '').replace(/\\/g, '/');
const dirs = (cfg.protectedSkillDirs || []).map((s) => { try { return new RegExp(s, 'i'); } catch { return null; } }).filter(Boolean);

if (dirs.some((rx) => rx.test(target))) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Eval-integrity guard: reviewer agent "' + who + '" may not modify reviewer skill files ' +
        '(no editing your own rubric to make findings pass).',
    },
  }));
  process.exit(0);
}
process.exit(0);
