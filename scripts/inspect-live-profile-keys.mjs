// Offline diagnostic: setting NAMES only. Never print values or connection strings.
import fs from 'node:fs';
import { parse } from 'dotenv';
import { LIVE_SETTINGS, UNRELATED_APPLICATION_KEYS } from './lib/live-db-safety.mjs';
import path from 'node:path';
try {
  const profile = parse(fs.readFileSync('.env.live.local', 'utf8'));
  const keys = Object.keys(profile);
  let historicalReceipt = null;
  if (fs.existsSync('.joro-live/last-check.json')) {
    const receipt = JSON.parse(fs.readFileSync('.joro-live/last-check.json', 'utf8'));
    historicalReceipt = { verifiedAt: receipt.verifiedAt, action: receipt.action, appliedCount: receipt.applied?.length, pending: receipt.pending };
  }
  const localBackupMetadata = ['.joro-live/backups', 'backups', 'backup'].flatMap(directory => {
    if (!fs.existsSync(directory) || fs.lstatSync(directory).isSymbolicLink()) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isFile() && /\.(sql|sql\.gz|dump|bak|zip)$/i.test(entry.name)).map(entry => {
      const stat = fs.statSync(path.join(directory, entry.name));
      return { directory, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
    });
  });
  console.log(JSON.stringify({
    recognized: keys.filter(key => Object.hasOwn(LIVE_SETTINGS, key) || key === 'JORO_LIVE_DB_PASSWORD'),
    unrelatedApplicationConfiguration: keys.filter(key => UNRELATED_APPLICATION_KEYS.includes(key)),
    unexpected: keys.filter(key => !Object.hasOwn(LIVE_SETTINGS, key) && key !== 'JORO_LIVE_DB_PASSWORD' && !UNRELATED_APPLICATION_KEYS.includes(key)),
    missing: Object.keys(LIVE_SETTINGS).filter(key => !Object.hasOwn(profile, key)),
    targetMatches: Object.entries(LIVE_SETTINGS).every(([key, value]) => profile[key] === value),
    passwordConfigured: Boolean(profile.JORO_LIVE_DB_PASSWORD?.trim() && profile.JORO_LIVE_DB_PASSWORD !== 'ADD_MYSQL_PASSWORD_HERE'),
    managedTunnelStatePresent: fs.existsSync('.joro-live/tunnel.json'),
    dedicatedKnownHostsPresent: fs.existsSync('.joro-live/known_hosts'),
    dedicatedSshKeyPresent: fs.existsSync('.joro-live/id_ed25519'),
    historicalReceipt,
    localBackupMetadata,
  }, null, 2));
} catch { console.error('Protected profile inspection failed; no values were printed.'); process.exitCode = 1; }
