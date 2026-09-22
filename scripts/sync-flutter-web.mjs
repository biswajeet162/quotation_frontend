#!/usr/bin/env node
/**
 * Builds quotation_mobile for Flutter Web and copies the output into
 * quotation_frontend/public/m/ so one Vercel project can serve:
 *   - desktop → Angular
 *   - mobile  → Flutter Web at /m/
 *
 * Usage (from quotation_frontend):
 *   npm run sync:flutter-web
 *   npm run sync:flutter-web -- --skip-build   # copy existing build/web only
 *
 * Requires Flutter SDK on PATH.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const repoMobileRoot = resolve(frontendRoot, '..', 'quotation_mobile');
const flutterWebOut = join(repoMobileRoot, 'build', 'web');
const targetDir = join(frontendRoot, 'public', 'm');

const skipBuild = process.argv.includes('--skip-build');
const apiTarget = process.env.API_TARGET || 'prod';

function fail(message) {
  console.error(`\n[sync-flutter-web] ${message}\n`);
  process.exit(1);
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  // Windows needs shell so `flutter` resolves via PATH (.bat).
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(`Command failed with exit code ${result.status}`);
  }
}

if (!existsSync(repoMobileRoot)) {
  fail(`quotation_mobile not found at:\n  ${repoMobileRoot}`);
}

if (!skipBuild) {
  run('flutter', ['--version'], repoMobileRoot);
  run('flutter', ['pub', 'get'], repoMobileRoot);
  run(
    'flutter',
    [
      'build',
      'web',
      '--release',
      '--base-href',
      '/m/',
      `--dart-define=API_TARGET=${apiTarget}`,
    ],
    repoMobileRoot,
  );
} else {
  console.log('[sync-flutter-web] Skipping Flutter build (--skip-build)');
}

if (!existsSync(join(flutterWebOut, 'index.html'))) {
  fail(
    `Flutter web output missing:\n  ${flutterWebOut}\nRun without --skip-build first.`,
  );
}

console.log(`\n[sync-flutter-web] Copying:\n  ${flutterWebOut}\n→ ${targetDir}`);
rmSync(targetDir, { recursive: true, force: true });
mkdirSync(dirname(targetDir), { recursive: true });
cpSync(flutterWebOut, targetDir, { recursive: true });

writeFileSync(
  join(targetDir, '.sync-meta.json'),
  JSON.stringify(
    {
      syncedAt: new Date().toISOString(),
      apiTarget,
      baseHref: '/m/',
      source: 'quotation_mobile/build/web',
    },
    null,
    2,
  ),
);

console.log('\n[sync-flutter-web] Done. Flutter Web is at public/m/');
console.log(
  '[sync-flutter-web] Note: build/web now uses base-href /m/. For local Chrome use:',
);
console.log(
  '  flutter run -d chrome --release --base-href=/ --dart-define=API_TARGET=prod',
);
console.log('Next: commit public/m (if needed) and deploy quotation_frontend to Vercel.\n');
