import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStatic } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Vercel config routes API separately, packages native dependency and uses a daily secured-cron path', async () => {
  const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'public');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.installCommand, 'npm ci');
  assert.equal(pkg.scripts.build, 'node scripts/build.mjs');
  assert.equal(pkg.engines.node, '24.x');
  assert.deepEqual(config.rewrites, [{ source: '/api/:path*', destination: '/api/index' }]);
  assert.equal(config.functions['api/index.mjs'].includeFiles, 'node_modules/@libsql/**');
  assert.deepEqual(config.crons, [{ path: '/api/cron', schedule: '0 0 * * *' }]);
  const allHeaders = config.headers.find((rule) => rule.source === '/(.*)').headers;
  assert.ok(allHeaders.some((header) => header.key === 'Content-Security-Policy' && header.value.includes("script-src 'self'")));
});

test('static build copies only frontend assets, never secrets, databases or backend source', async (t) => {
  const parent = resolve(tmpdir());
  const fixture = await mkdtemp(join(parent, 'overbyte-build-test-'));
  t.after(async () => {
    assert.ok(fixture.startsWith(parent + sep));
    assert.ok(fixture.slice(parent.length + 1).startsWith('overbyte-build-test-'));
    await rm(fixture, { recursive: true, force: true });
  });
  for (const folder of ['src/pages', 'styles', 'assets/fonts', 'data', 'overbyte']) {
    await mkdir(join(fixture, folder), { recursive: true });
  }
  const fixtureFiles = {
    'index.html': '<html>OverByte</html>',
    'src/main.js': 'export const app = true;',
    'src/pages/auth.js': 'export const auth = true;',
    'styles/base.css': 'body { color: white; }',
    'assets/fonts/example.woff2': 'font-placeholder',
    'src/.env': 'PRIVATE=secret',
    'assets/private.json': '{"secret":true}',
    'data/overbyte.sqlite': 'private database',
    'overbyte/index.html': 'another project',
    'server.mjs': 'private API source',
    '.env': 'TOKEN=secret',
    'Overbyte.rar': 'archive',
  };
  for (const [path, content] of Object.entries(fixtureFiles)) await writeFile(join(fixture, path), content);
  const build = await buildStatic(fixture);
  assert.deepEqual(build.files, ['assets/fonts/example.woff2', 'index.html', 'src/main.js', 'src/pages/auth.js', 'styles/base.css']);
  for (const path of build.files) {
    assert.equal(await readFile(join(build.output, path), 'utf8'), fixtureFiles[path]);
  }
  assert.deepEqual((await buildStatic(fixture)).files, build.files, 'repeat builds are safe');
  await writeFile(join(build.output, 'private.sqlite'), 'do not publish or erase');
  await assert.rejects(buildStatic(fixture), /Unexpected file in generated public/);
  assert.equal(await readFile(join(build.output, 'private.sqlite'), 'utf8'), 'do not publish or erase');
});
