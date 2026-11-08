import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
/** Lock an empty newly-created file before writing backup data or private plans. */
export function securePrivateFile(file, platform = process.platform, run = spawnSync) {
  if (platform !== 'win32') { fs.chmodSync(file, 0o600); return; }
  const command = "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object Security.AccessControl.FileSecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow'))); [IO.File]::SetAccessControl($env:JORO_PRIVATE_OUTPUT_FILE,$acl)";
  const result = run('powershell.exe', ['-NoProfile', '-Command', command], { env: { ...process.env, JORO_PRIVATE_OUTPUT_FILE: file }, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Cannot restrict private output file access. No private data was written.');
}
