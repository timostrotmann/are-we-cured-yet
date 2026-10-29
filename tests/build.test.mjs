import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const project = new URL('../', import.meta.url);

test('a clean checkout builds a complete Pages artifact including assets and both datasets', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'are-we-cured-yet-build-'));
  t.after(async () => {
    const withinTemporaryRoot = relative(tmpdir(), temporary);
    assert.ok(withinTemporaryRoot && !withinTemporaryRoot.startsWith('..') && !isAbsolute(withinTemporaryRoot));
    await rm(temporary, { recursive: true });
  });
  for (const directory of ['scripts', 'src', 'data', 'public']) {
    await cp(new URL(`${directory}/`, project), join(temporary, directory), { recursive: true });
  }
  await assert.rejects(access(join(temporary, 'dist')));
  await run(process.execPath, [join(temporary, 'scripts/build.mjs')]);
  const output = join(temporary, 'dist');
  for (const asset of ['style.css', 'app.js', 'hero-drug.svg', 'icon.svg', '.nojekyll']) {
    assert.equal(await readFile(join(output, asset), 'utf8'), await readFile(new URL(`public/${asset}`, project), 'utf8'));
  }
  assert.equal((await readFile(join(output, 'CNAME'), 'utf8')).trim(), 'arewecuredyet.ai');
  const html = await readFile(join(output, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
  for (const match of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
    if (match[1].startsWith('https:')) continue;
    assert.ok(!match[1].startsWith('/'), 'Site assets must work under a repository path.');
    await access(join(output, match[1].split('?')[0]));
  }
  const drugs = JSON.parse(await readFile(join(output, 'approved-drugs.json'), 'utf8'));
  const news = JSON.parse(await readFile(join(output, 'news.json'), 'utf8'));
  assert.equal(drugs.records.length, JSON.parse(await readFile(new URL('data/approved-drugs.json', project), 'utf8')).records.length);
  assert.equal(news.articles.length, JSON.parse(await readFile(new URL('data/news.json', project), 'utf8')).articles.length);
  await assert.rejects(access(join(output, '.openai')));
  await assert.rejects(access(join(output, '.git')));
});
