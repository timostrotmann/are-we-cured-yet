import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { renderSite } from './render.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [template, source, news] = await Promise.all([
  readFile(resolve(root, 'src/index.template.html'), 'utf8'),
  readFile(resolve(root, 'data/approved-drugs.json'), 'utf8'),
  readFile(resolve(root, 'data/news.json'), 'utf8')
]);
const { html, approvedDataset, newsDataset } = renderSite(template, JSON.parse(source), JSON.parse(news));
await mkdir(resolve(root, 'dist'), { recursive: true });
await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true });
await Promise.all([
  writeFile(resolve(root, 'dist/index.html'), html),
  writeFile(resolve(root, 'dist/approved-drugs.json'), `${JSON.stringify(approvedDataset, null, 2)}\n`),
  writeFile(resolve(root, 'dist/news.json'), `${JSON.stringify(newsDataset, null, 2)}\n`)
]);
console.log(`Generated ${approvedDataset.records.length} approved records and ${newsDataset.articles.length} news articles; ${approvedDataset.counts.documented_disease_cures} cures; ${approvedDataset.counts.documented_approved_novel_ai_designed_active_substances} approved drugs.`);
