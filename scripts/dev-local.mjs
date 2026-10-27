// Validate Next's normal development environment before starting the app.
// The live profile and DPAPI credential are never loaded here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import nextEnv from '@next/env';
import { assertDevelopmentDatabase } from './lib/migration-tools.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try {
  nextEnv.loadEnvConfig(root,true,{info() {},error() {}});
  assertDevelopmentDatabase(process.env.DATABASE_URL,process.env);
  if (process.argv.includes('--check')) console.log('Local development target verified. No database connection attempted.');
  else {
    const child = spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',...process.argv.slice(2)],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
    child.on('error',()=>{console.error('Could not start Next.js development server.');process.exitCode=1;});
    child.on('exit',code=>{process.exitCode=code ?? 1;});
  }
} catch {
  console.error('Development refused an unsafe or missing database target. Use your local development database; live credentials are never loaded automatically.');
  process.exitCode = 1;
}
