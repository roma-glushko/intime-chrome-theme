#!/usr/bin/env node
/*
 * Builds the Chrome Web Store uploads: dist/<name>-<version>.zip for newtab/, theme/ and theme-light/.
 *
 * Each zip has manifest.json at its root (the Web Store requires that) and holds only files that ship. Before zipping,
 * every package is checked against the store's hard limits, so a bad manifest fails here rather than in review:
 *   name <= 75 characters, description <= 132, a valid version, icons that exist at their real pixel sizes (including
 *   the 128 px store icon), every referenced file present, theme images are PNG, no inline scripts, no remote code.
 * The new-tab package must also contain privacy.html; a copy is written to dist/privacy-policy.html, the file to host.
 * Every zip also carries the repository's LICENSE and NOTICE (Apache-2.0 asks redistributors to pass them on).
 *
 *   node tools/pack.mjs              build all three
 *   node tools/pack.mjs theme        build one of: newtab | theme | theme-light
 *
 * Needs the `zip` and `unzip` command-line tools (both ship with macOS and most Linux distributions).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const PACKAGES = {
  newtab: 'in-time-newtab',
  theme: 'in-time-dark-theme',
  'theme-light': 'in-time-light-theme',
};
// Files a package must contain. The privacy policy ships inside the extension (Settings links to it).
const REQUIRED_FILES = { newtab: ['privacy.html'] };
// Apache-2.0 asks anyone who redistributes the work to pass the licence (and the NOTICE) on, so every zip carries both.
const LEGAL_FILES = ['LICENSE', 'NOTICE'];

// What Chrome, macOS and editors leave behind (hidden files, Chrome's compiled theme cache...). Never zipped.
const JUNK = /(^|\/)(\.[^/]+|Cached Theme\.pak|Thumbs\.db|__MACOSX)(\/|$)/;

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [relative(base, full)];
  });
}

/** [width, height] of a PNG, or null if the file isn't one. */
function pngSize(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function check(dir, files) {
  const errors = [];
  const warnings = [];
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return { errors: ['manifest.json is missing'], warnings, manifest: null };
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { errors: [`manifest.json is not valid JSON: ${error.message}`], warnings, manifest: null };
  }

  if (manifest.manifest_version !== 3) errors.push(`manifest_version is ${manifest.manifest_version}; new items must use 3`);
  const name = manifest.name ?? '';
  if (!name || name.length > 75) errors.push(`name must be 1-75 characters (it is ${name.length})`);
  const description = manifest.description ?? '';
  if (!description || description.length > 132) errors.push(`description must be 1-132 characters (it is ${description.length})`);
  const version = manifest.version ?? '';
  if (!/^\d+(\.\d+){0,3}$/.test(version) || version.split('.').some((part) => +part > 65535)) {
    errors.push(`version "${version}" must be 1-4 dot-separated integers, each at most 65535`);
  }

  const icons = manifest.icons ?? {};
  if (!icons['128']) errors.push('icons must include a "128" entry (the store icon)');
  for (const [size, file] of Object.entries(icons)) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      errors.push(`icon ${size}: ${file} does not exist`);
      continue;
    }
    const dims = pngSize(path);
    if (!dims) errors.push(`icon ${size}: ${file} is not a PNG`);
    else if (dims[0] !== +size || dims[1] !== +size) errors.push(`icon ${size}: ${file} is ${dims[0]}x${dims[1]}`);
  }

  const themeImages = Object.values(manifest.theme?.images ?? {});
  for (const file of [...themeImages, manifest.chrome_url_overrides?.newtab].filter(Boolean)) {
    if (!existsSync(join(dir, file))) errors.push(`${file} is referenced by the manifest but missing`);
  }
  for (const file of themeImages) {
    if (existsSync(join(dir, file)) && !pngSize(join(dir, file))) errors.push(`${file}: theme images must be PNG`);
  }

  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(join(dir, file), 'utf8');
    for (const [, url] of html.matchAll(/(?:src|href)="([^"#?]+)/g)) {
      if (/^(https?:)?\/\//.test(url)) continue; // reported by the remote-code scan below
      if (!existsSync(join(dir, dirname(file), url))) errors.push(`${file} refers to ${url}, which is missing`);
    }
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push(`${file} has an inline <script>; extension pages may only load script files`);
  }

  for (const file of files.filter((f) => /\.(html|css|m?js)$/.test(f))) {
    const text = readFileSync(join(dir, file), 'utf8');
    const urls = [...text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)]
      .map((match) => match[0])
      .filter((url) => url !== 'http://www.w3.org/2000/svg'); // an XML namespace, not a request
    if (urls.length) warnings.push(`${file} mentions ${[...new Set(urls)].join(', ')} (fine in a comment; the store forbids remote code)`);
  }

  return { errors, warnings, manifest };
}

function build(key) {
  const dir = join(root, key);
  const all = walk(dir).sort();
  const files = all.filter((file) => !JUNK.test(file));
  const skipped = all.filter((file) => JUNK.test(file));
  const { errors, warnings, manifest } = check(dir, files);
  for (const file of REQUIRED_FILES[key] ?? []) {
    if (!files.includes(file)) errors.push(`${file} is required but missing`);
  }
  for (const file of LEGAL_FILES) {
    if (!existsSync(join(root, file))) errors.push(`${file} is missing from the repository root (it is bundled into every package)`);
  }

  console.log(`\n${key}${manifest ? `  —  ${manifest.name}  v${manifest.version}` : ''}`);
  for (const file of skipped) console.log(`  skipped  ${file}`);
  for (const warning of warnings) console.log(`  warning  ${warning}`);
  if (errors.length) {
    for (const error of errors) console.log(`  ERROR    ${error}`);
    return false;
  }

  mkdirSync(dist, { recursive: true });
  const out = join(dist, `${PACKAGES[key]}-${manifest.version}.zip`);
  const scratch = join(dist, `.build-${PACKAGES[key]}.zip`); // zip appends to an existing archive, so always start empty
  rmSync(scratch, { force: true });
  const ordered = ['manifest.json', ...files.filter((file) => file !== 'manifest.json')];
  execFileSync('zip', ['-X', '-q', '-9', scratch, '-@'], { cwd: dir, input: `${ordered.join('\n')}\n` });
  execFileSync('zip', ['-X', '-q', '-9', '-j', scratch, ...LEGAL_FILES.map((file) => join(root, file))]); // -j: they land at the zip root
  renameSync(scratch, out);

  // Read the archive back: manifest.json must sit at its root and the contents must be exactly the files we meant.
  const entries = execFileSync('unzip', ['-Z1', out], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  if (!entries.includes('manifest.json')) throw new Error(`${out} has no manifest.json at its root`);
  const expected = [...new Set([...files, ...LEGAL_FILES])].sort();
  if (entries.join('\n') !== expected.join('\n')) throw new Error(`${out} does not contain exactly the expected files`);

  console.log(`  ok       ${entries.length} files, ${(statSync(out).size / 1024).toFixed(0)} KB  ->  ${relative(root, out)}`);

  // The Web Store wants the policy at a public URL: this copy of the page inside the extension is the file to host.
  if (key === 'newtab') {
    copyFileSync(join(dir, 'privacy.html'), join(dist, 'privacy-policy.html'));
    console.log('  ok       copy to host publicly  ->  dist/privacy-policy.html');
  }
  return true;
}

const wanted = process.argv.slice(2);
const unknown = wanted.filter((key) => !(key in PACKAGES));
if (unknown.length) {
  console.error(`unknown package: ${unknown.join(', ')} (choose from ${Object.keys(PACKAGES).join(', ')})`);
  process.exit(2);
}
const results = (wanted.length ? wanted : Object.keys(PACKAGES)).map(build);
console.log(results.every(Boolean) ? '\nAll packages are ready to upload.' : '\nFix the errors above, then run again.');
process.exitCode = results.every(Boolean) ? 0 : 1;
