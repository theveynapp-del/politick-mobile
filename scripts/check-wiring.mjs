#!/usr/bin/env node
/**
 * Guards integrations that are invisible to the type-checker.
 *
 * Every check below corresponds to something that has actually been lost by
 * replacing this folder wholesale with a zip from another session. Each time,
 * the app still compiled and still ran — it just quietly stopped doing the
 * thing. `tsc` cannot catch a deleted `.functions.invoke(...)` call, so this
 * asserts the wiring exists by inspection.
 *
 * Run: npm run check:wiring   (also runs automatically on pre-commit)
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const checks = [
  {
    name: "Representative lookup falls back to the edge function",
    why: "Without it only pre-seeded ZIPs resolve; every other real US ZIP shows 'no representative data'.",
    file: "lib/queries.ts",
    mustContain: ["lookup-representatives", "functions.invoke"],
  },
  {
    name: "Local/State stories are filtered to the user's state",
    why: "Without it a user is shown another state's local news labelled as their own.",
    file: "lib/queries.ts",
    mustContain: ["stateForZip"],
  },
  {
    name: "ZIP entry dismisses the keyboard",
    why: "iOS number-pad has no return key, so the keyboard covers Continue and the user is stuck.",
    file: "app/onboarding.tsx",
    mustContain: ["dismissKeyboard"],
  },
  {
    name: "Onboarding uses the real logo and illustration assets",
    why: "These are image files, not code — a replace can drop them and the screen silently falls back.",
    file: "app/onboarding.tsx",
    mustContain: ["politick-logo-lockup.png", "onboarding-welcome.jpg"],
  },
];

const requiredFiles = [
  { path: "assets/politick-logo-lockup.png", why: "approved logo lockup" },
  { path: "assets/onboarding-welcome.jpg", why: "onboarding illustration" },
  { path: "eas.json", why: "production build profile / build-number auto-increment" },
];

const failures = [];

for (const check of checks) {
  if (!existsSync(check.file)) {
    failures.push(`${check.name}\n    missing file: ${check.file}\n    why: ${check.why}`);
    continue;
  }
  const src = readFileSync(check.file, "utf8");
  const missing = check.mustContain.filter((needle) => !src.includes(needle));
  if (missing.length) {
    failures.push(
      `${check.name}\n    ${check.file} no longer references: ${missing.join(", ")}\n    why: ${check.why}`
    );
  }
}

for (const f of requiredFiles) {
  if (!existsSync(f.path)) failures.push(`Missing ${f.path}\n    why: ${f.why}`);
}

// .env holds live API keys and must never be committed.
try {
  const tracked = execSync("git ls-files .env", { encoding: "utf8" }).trim();
  if (tracked) failures.push(".env is tracked by git — it holds live API keys and must stay ignored.");
} catch {
  /* not a git repo; nothing to assert */
}

if (failures.length) {
  console.error("\n✗ Wiring check failed — " + failures.length + " problem(s):\n");
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  console.error("These are regressions a folder replace can cause without breaking the build.");
  console.error("Restore the wiring rather than deleting the check.\n");
  process.exit(1);
}

console.log(`✓ Wiring check passed (${checks.length + requiredFiles.length} invariants).`);
