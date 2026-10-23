import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const lockPath = new URL('../releases/shop-production-lock.json', import.meta.url);
export function assertActiveDeployment(lock, payload) {
  if (payload?.success !== true || !Array.isArray(payload?.result?.deployments)) {
    throw new Error('Cannot establish active Cloudflare deployment; fail closed.');
  }
  // Cloudflare returns the active deployment first. Never search history for a match.
  const active = payload.result.deployments[0];
  if (!active || active.id !== lock.expectedDeploymentId ||
      JSON.stringify(active.versions) !== JSON.stringify(lock.expectedVersions)) {
    throw new Error('Production changed (including direct API deployment); reconcile before release.');
  }
  return active;
}

export function assertReleaseReady(lock) {
  if (lock?.schemaVersion !== 1 || lock.worker !== 'yggmetro-web') {
    throw new Error('Missing or invalid production release lock; fail closed.');
  }
  // Deliberate unconditional freeze. There is no flag, input, state edit or env override.
  // Unlocking requires reviewed code plus source/runtime reconciliation and a fresh
  // active deployment comparison immediately before mutation. See the release notes.
  throw new Error(`Production release blocked: ${lock.reason || 'source is unreconciled'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertReleaseReady(JSON.parse(readFileSync(lockPath, 'utf8')));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
