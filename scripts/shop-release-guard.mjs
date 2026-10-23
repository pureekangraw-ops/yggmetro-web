import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const lockPath = new URL('../releases/shop-production-lock.json', import.meta.url);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

function trafficDistribution(versions) {
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error('Missing traffic distribution; fail closed.');
  }
  const seen = new Set();
  let total = 0;
  const entries = [];
  for (const entry of versions) {
    if (!isObject(entry) || !isId(entry.version_id) || seen.has(entry.version_id) ||
        typeof entry.percentage !== 'number' || !Number.isFinite(entry.percentage) ||
        entry.percentage <= 0 || entry.percentage > 100) {
      throw new Error('Invalid traffic distribution; fail closed.');
    }
    seen.add(entry.version_id);
    total += entry.percentage;
    entries.push([entry.version_id, entry.percentage]);
  }
  // Allow floating-point addition roundoff, not missing traffic or duplicate IDs.
  if (Math.abs(total - 100) > 1e-9) throw new Error('Traffic must total 100%; fail closed.');
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

export function assertActiveDeployment(lock, payload) {
  if (!isObject(lock) || lock.schemaVersion !== 1 || lock.worker !== 'yggmetro-web' ||
      !isId(lock.expectedDeploymentId)) {
    throw new Error('Missing or invalid deployment baseline; fail closed.');
  }
  const expected = trafficDistribution(lock.expectedVersions);
  if (!isObject(payload) || payload.success !== true || !isObject(payload.result) ||
      !Array.isArray(payload.result.deployments)) {
    throw new Error('Cannot establish active Cloudflare deployment; fail closed.');
  }
  // Cloudflare returns the active deployment first. Never search history for a match.
  const active = payload.result.deployments[0];
  if (!isObject(active) || !isId(active.id)) {
    throw new Error('Missing or invalid active deployment; fail closed.');
  }
  const actual = trafficDistribution(active.versions);
  if (active.id !== lock.expectedDeploymentId || JSON.stringify(actual) !== JSON.stringify(expected)) {
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
