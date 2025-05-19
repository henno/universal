/**
 * api.test.js – generic HTTP‑API test‑runner
 *
 * Spec structure:
 *   [ title,
 *     'METHOD /path/:id',           // placeholders :param replaced with S.param
 *     headers | headersFn | null,   // e.g. auth   or null
 *     body    | bodyFn    | null,   // may be function(S) → object
 *     expect,                       // number OR fn(res)
 *     fn(res, S)? ]                 // optional combined assert & state‑update
 *
 * Invoke with a spec file:
 *   node  api.test.js   ./spec.js
 *   mocha api.test.js -- --data ./spec.js
 *
 * The spec module **must** export { baseUrl, spec }.
 */

const path    = require('path');
const request = require('supertest');
const assert  = require('assert');

/* ───────────────────────────────── helpers exposed to spec files ───────────────────────────────── */
Object.assign(global, {
  assert,
  rnd : () => Math.floor(Math.random() * 10_000),
  auth: S => ({ Authorization: `Bearer ${S.token}` }),
});

/* ───────────────────────────────── resolve spec‑file (mandatory) ───────────────────────────────── */
let specPath;
const flagIdx = process.argv.findIndex(a => a === '--data' || a.startsWith('--data='));
if (flagIdx !== -1) {
  specPath = process.argv[flagIdx].includes('=')
    ? process.argv[flagIdx].split('=')[1]
    : process.argv[flagIdx + 1];
} else {
  specPath = process.argv[2];
}
if (!specPath) {
  throw new Error('❌  No spec file supplied. Usage: node api.test.js <specFile.js>');
}

/* ───────────────────────────────── import and validate spec ───────────────────────────────── */
const { baseUrl, spec } = require(path.resolve(process.cwd(), specPath));
if (!baseUrl || !spec) {
  throw new Error('❌  Spec file must export { baseUrl, spec }');
}

/* ───────────────────────────────── shared state across tests ───────────────────────────────── */
const S = {
  token      : null,
  email      : null,
  password   : null,
  userId     : null,
  formId     : null,
  questionId : null,
  responseId : null,
};

/* ───────────────────────────────── util: substitute :param with S[param] ───────────────────────────────── */
function applyParams(tmpl) {
  return tmpl.replace(/:([A-Za-z_]+)/g, (_, k) => {
    if (S[k] == null) throw new Error(`Missing S.${k} for path param :${k}`);
    return S[k];
  });
}

function curlCmd({ method, path, headers = {}, body }) {
  const h = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
  const b = body ? `-d '${JSON.stringify(body)}'` : '';
  return `curl -X ${method.toUpperCase()} ${baseUrl}${path} ${h} ${b}`.trim();
}

/* ───────────────────────────────── Mocha runner ───────────────────────────────── */
describe('API contract', function () {
  this.timeout(10_000);

  for (const [group, rows] of Object.entries(spec)) {
    describe(group, () => {
      rows.forEach(row => {
        // Support 6‑column (combined) and legacy 7‑column rows
        const [ title, methodPath, hdrs, bodyP, expecter, col6, col7 ] = row;

        let combinedFn = () => {}, assertBody = () => {}, store = () => {};
        if (row.length === 6) {
          combinedFn = col6 || (() => {});
        } else {
          assertBody = col6 || (() => {});
          store      = col7 || (() => {});
        }

        const [ methodRaw, ...p ] = methodPath.split(' ');
        const method = methodRaw.toLowerCase();
        const pathTmpl = p.join(' ');

        it(title, async () => {
          const pathResolved = applyParams(pathTmpl);
          const headers = typeof hdrs === 'function' ? hdrs(S) : (hdrs || {});
          const body    = typeof bodyP === 'function' ? bodyP(S) : bodyP;

          let req = request(baseUrl)[method](pathResolved);
          Object.entries(headers).forEach(([k, v]) => { req = req.set(k, v); });
          if (body) req = req.send(body);

          try {
            const res = await req;

            typeof expecter === 'function'
              ? expecter(res)
              : assert.strictEqual(res.status, expecter);

            combinedFn(res, S);
            assertBody (res, S);
            store      (res, S);

          } catch (err) {
            console.error(`# FAIL in: ${title}\n${curlCmd({ method, path: pathResolved, headers, body })}`);
            console.error(err.response?.body ?? err.message);
            throw err;
          }
        });
      });
    });
  }
});
