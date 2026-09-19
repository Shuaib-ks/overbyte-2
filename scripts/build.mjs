import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicTypes = {
  src: new Set(['.js']),
  styles: new Set(['.css']),
  assets: new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.ico', '.woff', '.woff2']),
};

async function collectFiles(directory, base = '') {
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`Build input/output must be a real directory: ${directory}`);
  }
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Build does not follow symbolic links: ${relative}`);
    if (entry.isDirectory()) files.push(...await collectFiles(join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Build input/output must contain regular files: ${relative}`);
  }
  return files;
}

// No account data, backend code, credentials, nested projects or archives enter public/.
// The dedicated output directory is never recursively erased by this build script.
export async function buildStatic(root = projectRoot) {
  root = resolve(root);
  const output = join(root, 'public');
  const index = await lstat(join(root, 'index.html'));
  if (index.isSymbolicLink() || !index.isFile()) throw new Error('index.html must be a regular file.');
  const files = ['index.html'];
  for (const [folder, extensions] of Object.entries(publicTypes)) {
    for (const relative of await collectFiles(join(root, folder))) {
      if (extensions.has(extname(relative).toLowerCase()) && !relative.split('/').some((part) => part.startsWith('.'))) {
        files.push(`${folder}/${relative}`);
      }
    }
  }

  await mkdir(output, { recursive: true });
  const expected = new Set(files);
  for (const relative of await collectFiles(output)) {
    if (!expected.has(relative)) {
      throw new Error(`Unexpected file in generated public/: ${relative}. Move it out before rebuilding.`);
    }
  }
  for (const relative of files) {
    const target = join(output, relative);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, relative), target);
  }
  return { output, files: files.sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { output, files } = await buildStatic();
  console.log(`Built ${files.length} public files in ${output}. API is deployed separately from api/index.mjs.`);
}
