#!/usr/bin/env bun
/**
 * run-tests.js – Minimal Bun entry‑point that launches Mocha programmatically.
 *
 *   bun run run-tests.js ./todoSpec.js
 *   ╰─────────┬────────╯ ╰────────── CLI positional spec‑file (mandatory)
 *             │
 *             └─ bun executes this file; the file then boots Mocha, injects the
 *                `--data` flag for api.test.js, and finally runs the suite.
 *
 * Why a wrapper?
 *   • Keeps `api.test.js` pure Mocha so it can still be executed with the normal
 *     `mocha` CLI in CI or IDE integrations.
 *   • Lets you avoid installing the global Mocha bin in dev machines where you
 *     already have Bun.
 *   • Keeps the single‑source‑of‑truth CLI contract: *always* provide the spec
 *     path (now as a positional arg instead of `--data`).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import Mocha from 'mocha';

// ─── 1. Expect a positional spec‑file argument ───────────────────────────────
const specPath = Bun.argv[2]; // Bun.argv[0] == "bun", Bun.argv[1] == this script
if (!specPath) {
  console.error('Usage: bun run run-tests.js <spec-file.js>');
  process.exit(1);
}

// Inject the --data flag so api.test.js receives it exactly as before
process.argv.push('--data', specPath);

// ─── 2. Boot Mocha programmatically ──────────────────────────────────────────
const mocha = new Mocha({ timeout: 10_000, reporter: 'spec' });

// Resolve path to api.test.js (same folder as this wrapper)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
mocha.addFile(path.resolve(__dirname, 'api.test.js'));

// ─── 3. Run and exit with proper code for CI ─────────────────────────────────
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
});
