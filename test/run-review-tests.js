#!/usr/bin/env node
'use strict';
// Determinism regression for the design-review scripts. It re-runs the deterministic tail of
// the pipeline (pre-scan, and synthesize -> ground -> verdict over the committed reviewer
// fixtures) and asserts the output still equals the committed worked run under
// examples/review-run/. This is the CI teeth behind the "same findings in, same verdict out"
// claim: if anyone changes a scoring script and the worked example shifts, this fails.
// It also unit-pins the sharp edges: the verdict gate rule, quote extraction around
// contractions, and the test-designer's leak-grep gate.
//
// Cross-platform: resolves `python` or `python3`, runs from the repo root, compares parsed
// JSON (not bytes) so line-ending / trailing-newline differences never cause a false failure.
const { spawnSync } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const S = '.claude/skills/design-review/scripts';
const RR = 'examples/review-run';
const DOC = 'examples/sample-design.md';

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n         ' + String(e.message || e).split('\n')[0]); }
}

function resolvePython() {
  for (const cmd of ['python', 'python3']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return cmd;
  }
  throw new Error('no python interpreter found on PATH (need python or python3)');
}
const PY = resolvePython();

function py(args, opts = {}) {
  const r = spawnSync(PY, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (r.error) throw new Error(PY + ' ' + args.join(' ') + ' -> ' + r.error.message);
  if (r.status !== 0) throw new Error(PY + ' ' + args.join(' ') + ' exited ' + r.status + ': ' + (r.stderr || '').trim());
  return r.stdout;
}

// Like py() but returns { status, stdout, stderr } without throwing - for scripts whose
// non-zero exit IS the behavior under test (the leak-grep gate).
function pyRaw(args, opts = {}) {
  const r = spawnSync(PY, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (r.error) throw new Error(PY + ' ' + args.join(' ') + ' -> ' + r.error.message);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

console.log('review pipeline determinism (examples/review-run)');

// 1. pre-scan on the sample reproduces the committed pre_scan.json
check('pre_scan.py reproduces committed pre_scan.json', () => {
  const got = JSON.parse(py([S + '/pre_scan.py', DOC]));
  assert.deepStrictEqual(got, readJson(RR + '/pre_scan.json'));
});

// 2. synthesize -> ground -> verdict over the committed fixtures reproduces review.json
check('synthesize -> ground -> verdict reproduces committed review.json', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppad-review-'));
  const tmp = path.join(tmpDir, 'review.json');
  try {
    const merged = py([
      S + '/synthesize_findings.py',
      RR + '/inputs/pre_scan_findings.json',
      RR + '/inputs/consistency.json',
      RR + '/inputs/platform.json',
    ]);
    fs.writeFileSync(tmp, merged);
    py([S + '/verify_evidence.py', tmp, '--doc', DOC]);   // mutates tmp in place
    py([S + '/compute_verdict.py', tmp]);                  // mutates tmp in place
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(tmp, 'utf8')), readJson(RR + '/review.json'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// 3. the committed verdict is the one the rule implies for the committed counts
check('committed verdict matches its counts under the gate rule', () => {
  const r = readJson(RR + '/review.json');
  const c = r.counts;
  const expect = (c.critical >= 1 || c.major >= 3) ? 'REJECT' : (c.major >= 1 ? 'REVISE' : 'APPROVE');
  assert.strictEqual(r.verdict, expect);
});

// 4. the gate rule itself - each branch and boundary, invoking the ACTUAL compute_verdict.py
//    (the committed run above only exercises REJECT, and via both OR-branches at once, so a
//    single-branch regression to the gate would otherwise ship green - this pins every path).
const VERDICT_CASES = [
  { counts: { critical: 1, major: 0, minor: 0 }, expect: 'REJECT' },   // critical branch alone
  { counts: { critical: 0, major: 3, minor: 0 }, expect: 'REJECT' },   // major>=3 branch alone
  { counts: { critical: 0, major: 2, minor: 9 }, expect: 'REVISE' },   // just below the major>=3 boundary
  { counts: { critical: 0, major: 1, minor: 0 }, expect: 'REVISE' },   // major>=1 branch
  { counts: { critical: 0, major: 0, minor: 3 }, expect: 'APPROVE' },  // minors never gate
  { counts: { critical: 0, major: 0, minor: 0 }, expect: 'APPROVE' },  // empty
];
for (const { counts, expect } of VERDICT_CASES) {
  check(`compute_verdict c=${counts.critical} m=${counts.major} n=${counts.minor} -> ${expect}`, () => {
    const findings = [];
    for (const [sev, k] of Object.entries(counts)) for (let i = 0; i < k; i++) findings.push({ severity: sev });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppad-verdict-'));
    const tmp = path.join(tmpDir, 'v.json');
    try {
      fs.writeFileSync(tmp, JSON.stringify({ document: 'x', findings }));
      py([S + '/compute_verdict.py', tmp]);   // the real script, not an inline copy of the rule
      const out = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      assert.strictEqual(out.verdict, expect);
      assert.deepStrictEqual(out.counts, counts);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
}

// 5. evidence-grounding regression: apostrophes are NOT quote delimiters. Contractions in
//    reviewer prose must neither parse as fake quotes (spurious demotion) nor truncate a
//    genuine double-quoted span - while a fabricated quote is still demoted.
console.log('\nverify_evidence quote extraction (contractions)');
{
  const DOC_TEXT = 'The gallery doesn\'t show archived events unless the coordinator opts in.\n' +
    'Managers get a read-only view across all regions.\n';
  const CASES = [
    {
      name: 'contractions with no quote stay an observation (no demotion)',
      evidence: "The design doesn't handle archival and doesn't bound the result set.",
      severity: 'critical',
      assert: (f) => {
        assert.strictEqual(f.evidence_grounded, null, 'expected evidence_grounded null, got ' + f.evidence_grounded);
        assert.strictEqual(f.severity, 'critical', 'contraction-only evidence must not demote');
      },
    },
    {
      name: 'a genuine quote containing a contraction is not truncated at the apostrophe',
      evidence: 'The doc says "The gallery doesn\'t show archived events unless the coordinator opts in."',
      severity: 'critical',
      assert: (f) => {
        assert.strictEqual(f.evidence_grounded, true, 'verbatim quote with contraction must ground true');
        assert.strictEqual(f.severity, 'critical');
      },
    },
    {
      name: 'a fabricated double-quoted claim is still demoted',
      evidence: 'The doc says "every column is encrypted client-side before hitting the datastore layer".',
      severity: 'critical',
      assert: (f) => {
        assert.strictEqual(f.evidence_grounded, false, 'fabricated quote must ground false');
        assert.strictEqual(f.severity, 'major', 'fabricated critical must demote to major');
        assert.strictEqual(f.original_severity, 'critical');
      },
    },
  ];
  for (const c of CASES) {
    check(c.name, () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppad-evidence-'));
      try {
        const doc = path.join(tmpDir, 'doc.md');
        const rev = path.join(tmpDir, 'review.json');
        fs.writeFileSync(doc, DOC_TEXT);
        fs.writeFileSync(rev, JSON.stringify({
          document: doc,
          findings: [{ id: 'T1', severity: c.severity, reviewer: 'platform', location: 'x', description: 'x', evidence: c.evidence }],
        }));
        py([S + '/verify_evidence.py', rev, '--doc', doc]);
        c.assert(JSON.parse(fs.readFileSync(rev, 'utf8')).findings[0]);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  }
}

// 6. the test-designer's leak-grep gate (input firewall): clean inputs pass, harness tokens or
//    test-artifact file names fail the run with exit 1.
console.log('\ntest-designer leak-grep gate');
{
  const G = '.claude/skills/test-designer/scripts/leak_grep.py';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppad-leakgrep-'));
  try {
    const clean = path.join(tmpDir, 'story.md');
    fs.writeFileSync(clean, 'As a coordinator, I can create an event with at least one session.\n');
    const leaky = path.join(tmpDir, 'notes.md');
    fs.writeFileSync(leaky, 'the harness asserts expect(list).toHaveLength(3)\n');
    const specName = path.join(tmpDir, 'events.spec.js');
    fs.writeFileSync(specName, 'plain text\n');

    check('clean designer input passes (exit 0)', () => {
      assert.strictEqual(pyRaw([G, clean]).status, 0);
    });
    check('input containing a harness token fails the run (exit 1)', () => {
      const r = pyRaw([G, clean, leaky]);
      assert.strictEqual(r.status, 1);
      assert.ok(/expect\(/.test(r.stderr), 'stderr should name the leaked token');
    });
    check('a test-artifact file name fails the run (exit 1)', () => {
      assert.strictEqual(pyRaw([G, specName]).status, 1);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
