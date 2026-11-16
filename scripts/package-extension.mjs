import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'shared');
const extension = resolve(root, 'extension');
const bundled = resolve(extension, 'shared');
const outputDir = resolve(root, 'dist');
const archive = resolve(outputDir, 'nova-chromium-extension.zip');
const ortDist = resolve(root, 'node_modules/onnxruntime-web/dist');
mkdirSync(outputDir, { recursive: true });
rmSync(bundled, { recursive: true, force: true });
cpSync(source, bundled, { recursive: true });
cpSync(resolve(root, 'sync-config.js'), resolve(extension, 'sync-config.js'));
cpSync(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(extension, 'THIRD_PARTY_NOTICES.md'));
for (const file of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  cpSync(resolve(ortDist, file), resolve(extension, file));
}
await build({
  entryPoints: [resolve(source, 'feature-suite.js')], bundle: true, minify: true,
  platform: 'browser', format: 'iife', target: 'chrome120',
  outfile: resolve(extension, 'feature-suite.bundle.js'), legalComments: 'none'
});
await build({
  entryPoints: [resolve(source, 'background-removal.js')], bundle: true, minify: true,
  platform: 'browser', format: 'esm', target: 'chrome120',
  outfile: resolve(extension, 'background-removal.bundle.js'),
  assetNames: 'assets/[name]-[hash]', loader: { '.wasm': 'file' }, legalComments: 'eof'
});
rmSync(archive, { force: true });
execFileSync('zip', ['-qr', archive, '.'], { cwd: extension, stdio: 'inherit' });
console.log(`Extension bundle ready: ${archive}`);
