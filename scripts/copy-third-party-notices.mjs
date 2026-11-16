import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
mkdirSync(publicDir, { recursive: true });
copyFileSync(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(publicDir, 'THIRD_PARTY_NOTICES.md'));
