#!/usr/bin/env node
/**
 * Catches evaluative language in reader-facing copy.
 *
 * Politick describes government; it does not argue about it. That is easy to
 * agree with and easy to violate — the phrases below all shipped in
 * lib/officeRoles.ts on the first pass, written in good faith, none of them
 * partisan in the red/blue sense, all of them opinions in the voice of fact:
 *
 *   "the single most powerful official over daily life in the state"
 *   "zoning ... the single biggest lever government has over housing costs"
 *   "arguably the most consequential office on a local ballot"
 *
 * This is a net, not a judge. It cannot tell whether a sentence takes a side —
 * it only flags the constructions that usually mean one does. Read what you
 * wrote; see the "Neutral voice" section in AGENTS.md.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// Reader-facing copy lives here. Excluded: tests, and this file's own examples.
const ROOTS = ["lib", "app", "components", "supabase/functions"];
const EXT = /\.(ts|tsx)$/;

const RULES = [
  {
    id: "superlative-rank",
    // "the most powerful", "single biggest lever", "arguably the most X"
    re: /\b(?:the\s+)?(?:single\s+)?(?:most|biggest|largest|greatest|worst|best)\s+(?:\w+\s+){0,2}(?:office|official|lever|power|influence|consequential|important|powerful|significant)\b|\barguably\s+the\b/i,
    why: "ranks offices or powers against each other — that's an argument, not a fact",
  },
  {
    id: "verdict",
    re: /\b(?:is|are|was|were)\s+(?:clearly\s+|obviously\s+)?(?:good|bad|wrong|right|unfair|corrupt|broken|failing|justified|sensible|reasonable)\b(?!\s*(?:faith|,\s*bad))/i,
    why: "delivers a verdict on a policy or actor",
  },
  {
    id: "characterisation",
    re: /\b(?:extreme|radical|far-left|far-right|hardline|moderate wing|common[- ]?sense)\b/i,
    why: "characterises a position rather than describing it",
  },
  {
    id: "prediction",
    re: /\b(?:likely to (?:pass|fail|win|lose)|will probably|is expected to (?:pass|fail)|almost certainly)\b/i,
    why: "predicts an outcome",
  },
  {
    id: "advocacy",
    re: /\b(?:you should (?:support|oppose|vote)|we (?:support|oppose)|deserves? your vote)\b/i,
    why: "tells the reader what to do",
  },
];

// Comments explaining the rule necessarily quote the banned phrasing.
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

// A prompt that forbids "likely to pass" has to contain the words "likely to
// pass". Prohibitions look identical to violations to a regex, so the scan
// tracks whether it is inside a rules block and skips it.
const OPENS_PROHIBITION =
  /you must never|must never|rules you must not break|hard limits|you (?:may|must) not|never do any of/i;
const LINE_IS_PROHIBITION =
  /\b(?:never|must not|do not|don'?t|no opinion|avoid|refrain from)\b/i;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(p)) out.push(p);
  }
  return out;
}

const findings = [];
for (const r of ROOTS) {
  for (const file of walk(join(ROOT, r))) {
    if (file.endsWith("check-neutral-voice.mjs")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    let inProhibition = false;
    lines.forEach((line, i) => {
      if (OPENS_PROHIBITION.test(line)) inProhibition = true;
      // A rules block ends at the blank line or the end of the template.
      else if (inProhibition && (line.trim() === "" || line.includes("`;"))) inProhibition = false;

      if (isComment(line)) return;
      if (inProhibition || LINE_IS_PROHIBITION.test(line)) return;

      for (const rule of RULES) {
        if (rule.re.test(line)) {
          findings.push({
            file: relative(ROOT, file),
            line: i + 1,
            id: rule.id,
            why: rule.why,
            text: line.trim().slice(0, 110),
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error(`\n✗ Neutral voice check: ${findings.length} issue(s)\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.id}]`);
    console.error(`    ${f.why}`);
    console.error(`    ${f.text}\n`);
  }
  console.error("See the “Neutral voice” section in AGENTS.md.");
  console.error("If a match is genuinely descriptive, reword it rather than");
  console.error("loosening the rule — the pattern exists because these all shipped once.\n");
  process.exit(1);
}

console.log("✓ Neutral voice check passed.");
