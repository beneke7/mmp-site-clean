// verify.mjs — run every construction in applets/ and report its degrees.
// CI runs this on every push, so a construction can never silently break, and a
// claim that stops holding fails the build before it reaches the site.
//
//   node verify.mjs applets/*.mmp
import { readFileSync } from 'node:fs';
import { degrees } from './engine.js';

let bad = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8');
  let res;
  try { res = degrees(src); }
  catch (err) { console.log(`FAIL ${file}: ${err.message}`); bad++; continue; }

  const objects = res.steps.filter((s) => s.name);
  const claims = res.steps.filter((s) => s.claim);
  const line = objects.map((s) => `${s.name}:${s.degree}`).join(' ');
  console.log(`${file}\n  ${line}`);
  for (const c of claims) {
    const ok = c.alwaysTrue;
    if (!ok) bad++;
    console.log(`  ${ok ? 'holds' : 'FAILS'}  ${c.op} ${c.args.join(' ')} `
      + `— degree ${c.statementDegree}, ${c.casesNeeded} special cases suffice`);
  }
}
process.exit(bad ? 1 : 0);
