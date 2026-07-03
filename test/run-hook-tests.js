#!/usr/bin/env node
'use strict';
// Minimal hook test harness. Feeds each hook a stdin payload and checks its outcome.
// exit code 2 = blocked; exit 0 = allowed; deny is signalled via permissionDecision JSON on stdout.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;

function run(hookRelPath, payload) {
  const res = spawnSync('node', [path.join(ROOT, hookRelPath)], {
    input: JSON.stringify(payload), encoding: 'utf8',
  });
  return { code: res.status, out: res.stdout || '', err: res.stderr || '' };
}

function check(name, cond) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// A temp dir with pre-populated files, for the Write-rewrite (diff-aware against disk) cases.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ppad-hooks-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ } });

// no-xrm-page (diff-aware)
console.log('no-xrm-page.js');
check('blocks introducing Xrm.Page',
  run('.claude/hooks/no-xrm-page.js', { tool_input: { file_path: 'f.js', content: 'var a = Xrm.Page.getAttribute("x");' } }).code === 2);
check('allows removing Xrm.Page (old has it, new does not)',
  run('.claude/hooks/no-xrm-page.js', { tool_input: { file_path: 'f.js', old_string: 'Xrm.Page.getAttribute("x")', new_string: 'formContext.getAttribute("x")' } }).code === 0);
check('ignores non-js',
  run('.claude/hooks/no-xrm-page.js', { tool_input: { file_path: 'f.md', content: 'Xrm.Page' } }).code === 0);
{
  // Write-rewrite of an existing file: must compare against the file on disk, not treat the
  // whole new content as "added" (a rewrite that REDUCES Xrm.Page is a cleanup, not an intro).
  const f = path.join(TMP, 'xrm-rewrite.js');
  fs.writeFileSync(f, 'var a = Xrm.Page.getAttribute("a");\nvar b = Xrm.Page.getAttribute("b");\n');
  check('allows a full-file rewrite that reduces Xrm.Page (2 -> 1)',
    run('.claude/hooks/no-xrm-page.js', { tool_input: { file_path: f, content: 'var a = Xrm.Page.getAttribute("a");\nvar b = formContext.getAttribute("b");\n' } }).code === 0);
  check('blocks a full-file rewrite that increases Xrm.Page (2 -> 3)',
    run('.claude/hooks/no-xrm-page.js', { tool_input: { file_path: f, content: 'var a = Xrm.Page.getAttribute("a");\nvar b = Xrm.Page.getAttribute("b");\nvar c = Xrm.Page.getAttribute("c");\n' } }).code === 2);
}

// check-hardcoded-guid
console.log('check-hardcoded-guid.js');
check('blocks introducing a GUID',
  run('.claude/hooks/check-hardcoded-guid.js', { tool_input: { file_path: 'f.js', content: 'var id="f47ac10b-58cc-4372-a567-0e02b2c3d479";' } }).code === 2);
check('allows no GUID',
  run('.claude/hooks/check-hardcoded-guid.js', { tool_input: { file_path: 'f.js', content: 'var id=getConfig("x");' } }).code === 0);
{
  const f = path.join(TMP, 'guid-rewrite.js');
  fs.writeFileSync(f, 'var a="f47ac10b-58cc-4372-a567-0e02b2c3d479";\nvar b="0e02b2c3-d479-4372-a567-f47ac10b58cc";\n');
  check('allows a full-file rewrite that reduces GUIDs (2 -> 1)',
    run('.claude/hooks/check-hardcoded-guid.js', { tool_input: { file_path: f, content: 'var a="f47ac10b-58cc-4372-a567-0e02b2c3d479";\nvar b=getConfig("b");\n' } }).code === 0);
  check('blocks a full-file rewrite that adds a GUID (2 -> 3)',
    run('.claude/hooks/check-hardcoded-guid.js', { tool_input: { file_path: f, content: 'var a="f47ac10b-58cc-4372-a567-0e02b2c3d479";\nvar b="0e02b2c3-d479-4372-a567-f47ac10b58cc";\nvar c="a567f47a-c10b-58cc-4372-0e02b2c3d479";\n' } }).code === 2);
}

// check-console-context (AST) - requires acorn; if missing it fails open (allow) with a note
console.log('check-console-context.js');
let acornPresent = true;
try { require.resolve('acorn'); } catch { acornPresent = false; }
if (!acornPresent) {
  console.log('  skip (acorn not installed - run `npm install`)');
} else {
  check('blocks console.log outside the allowed function',
    run('.claude/hooks/check-console-context.js', { tool_input: { file_path: 'f.js', content: 'function foo(){ console.log("x"); }' } }).code === 2);
  check('allows console.log inside bootstrapLogging',
    run('.claude/hooks/check-console-context.js', { tool_input: { file_path: 'f.js', content: 'function bootstrapLogging(){ console.log("x"); }' } }).code === 0);
  check('allows a file with no console calls',
    run('.claude/hooks/check-console-context.js', { tool_input: { file_path: 'f.js', content: 'function foo(){ return 1; }' } }).code === 0);
  // regression: an ES module (import/export) must still be parsed and checked, not silently skipped
  check('blocks console.log in an ES module (import/export) outside the allowed function',
    run('.claude/hooks/check-console-context.js', { tool_input: { file_path: 'f.js', content: 'import { x } from "./m.js";\nexport function foo(){ console.log(x); }' } }).code === 2);
  check('allows console.log inside bootstrapLogging in an ES module',
    run('.claude/hooks/check-console-context.js', { tool_input: { file_path: 'f.js', content: 'export function bootstrapLogging(){ console.log("x"); }' } }).code === 0);
}

// inject-rules
console.log('inject-rules.js');
{
  const r = run('.claude/hooks/inject-rules.js', { tool_input: { file_path: 'src/x.js', content: 'x' } });
  check('emits additionalContext for a .js edit', r.code === 0 && /additionalContext/.test(r.out));
  const canvas = run('.claude/hooks/inject-rules.js', { tool_input: { file_path: 'src/Screens/Main.fx.yaml', content: 'x' } });
  check('injects canvas.md for a .fx.yaml edit', canvas.code === 0 && /canvas\.md/.test(canvas.out));
  const flow = run('.claude/hooks/inject-rules.js', { tool_input: { file_path: 'src/approve.flow.json', content: 'x' } });
  check('injects power-automate.md for a .flow.json edit', flow.code === 0 && /power-automate\.md/.test(flow.out));
  const dv = run('.claude/hooks/inject-rules.js', { tool_input: { file_path: 'solution/customizations.xml', content: 'x' } });
  check('injects dataverse.md for a customizations.xml edit', dv.code === 0 && /dataverse\.md/.test(dv.out));
}

// eval-integrity: block-eval-reads
console.log('eval-integrity/block-eval-reads.js');
check('denies a protected reviewer reading eval data',
  /"permissionDecision":"deny"/.test(run('.claude/hooks/eval-integrity/block-eval-reads.js',
    { agent_type: 'review-consistency', tool_input: { file_path: 'x/design-review/evals/answers.json' } }).out));
check('allows the main session to read the same path',
  run('.claude/hooks/eval-integrity/block-eval-reads.js',
    { tool_input: { file_path: 'x/design-review/evals/answers.json' } }).out.indexOf('deny') === -1);

// eval-integrity: protect-skill-files
console.log('eval-integrity/protect-skill-files.js');
check('denies a reviewer editing its own skill file',
  /"permissionDecision":"deny"/.test(run('.claude/hooks/eval-integrity/protect-skill-files.js',
    { agent_type: 'review-platform', tool_input: { file_path: 'a/.claude/skills/review-platform/SKILL.md' } }).out));
check('allows the main session to edit skill files',
  run('.claude/hooks/eval-integrity/protect-skill-files.js',
    { tool_input: { file_path: 'a/.claude/skills/review-platform/SKILL.md' } }).out.indexOf('deny') === -1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
