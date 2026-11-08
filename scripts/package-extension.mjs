import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'shared');
const extension = resolve(root, 'extension');
const bundled = resolve(extension, 'shared');
const outputDir = resolve(root, 'dist');
const archive = resolve(outputDir, 'nova-chromium-extension.zip');

mkdirSync(outputDir, { recursive: true });
rmSync(bundled, { recursive: true, force: true });
cpSync(source, bundled, { recursive: true });
rmSync(archive, { force: true });
execFileSync('zip', ['-qr', archive, '.'], { cwd: extension, stdio: 'inherit' });
console.log(`Extension bundle ready: ${archive}`);
