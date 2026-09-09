/**
 * smoke-test-firebase-admin-interop.ts — dynamic-import interop guard.
 *
 * ~80 call sites do `const { db, auth, adminAuth } = await import('./lib/firebase-admin')`.
 * Under tsx (the production runtime) that namespace silently became the raw
 * `firebase-admin` CommonJS object when the module's default export was the
 * package itself, so every named export read as undefined (customAuth bridge
 * 500 "Authentication setup failed", activation-status 401 with a valid token —
 * live on 2026-09-09, present in logs since at least 2026-09-04).
 *
 * This runs under the SAME resolver production uses (npx tsx) and fails the
 * gate if the dynamic namespace ever loses its named exports again.
 *
 * Run locally before push:  npx tsx scripts/smoke-test-firebase-admin-interop.ts
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = pathToFileURL(resolve(process.cwd(), 'server/lib/firebase-admin.ts')).href;
const failures: string[] = [];

const ns: any = await import(target);
const { db, auth, adminAuth, storage, default: admin } = ns;

if (typeof db?.collection !== 'function') failures.push(`db.collection is ${typeof db?.collection} (db=${typeof db})`);
if (typeof auth?.verifyIdToken !== 'function') failures.push(`auth.verifyIdToken is ${typeof auth?.verifyIdToken} (auth=${typeof auth})`);
if (typeof adminAuth?.verifyIdToken !== 'function') failures.push(`adminAuth.verifyIdToken is ${typeof adminAuth?.verifyIdToken}`);
if (typeof storage?.bucket !== 'function') failures.push(`storage.bucket is ${typeof storage?.bucket}`);
if (typeof admin?.initializeApp !== 'function') failures.push(`default.initializeApp is ${typeof admin?.initializeApp}`);
if (typeof admin?.auth !== 'function') failures.push(`default.auth is ${typeof admin?.auth}`);
if (typeof admin?.firestore?.FieldValue !== 'function') failures.push(`default.firestore.FieldValue is ${typeof admin?.firestore?.FieldValue}`);
if (!Array.isArray(admin?.apps)) failures.push(`default.apps is not an array`);
if (ns.__esModule !== undefined || 'SDK_VERSION' in ns) failures.push(`namespace is the raw firebase-admin CJS object (keys: ${Object.keys(ns).join(',')})`);

if (failures.length) {
  console.error('❌ firebase-admin dynamic-import interop BROKEN:');
  for (const f of failures) console.error('   -', f);
  process.exit(1);
}
console.log('✅ firebase-admin dynamic-import interop OK — named exports survive `await import()` under tsx');
process.exit(0);
