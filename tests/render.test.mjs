import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSite } from '../scripts/render.mjs';

const template = await readFile(new URL('../src/index.template.html', import.meta.url), 'utf8');
const actualApproved = JSON.parse(await readFile(new URL('../data/approved-drugs.json', import.meta.url), 'utf8'));
const actualNews = JSON.parse(await readFile(new URL('../data/news.json', import.meta.url), 'utf8'));
const approved = { name: 'Test tracker', reviewed_at: '2026-10-28', coverage: 'Synthetic test data only.', records: [] };
const news = { name: 'Test news', reviewed_at: '2026-10-28', coverage: 'Synthetic news only.', articles: [] };

function drug(id, substance, conditionId, cure = false) {
  return { id, name: substance, active_substance: substance, condition: `Condition ${conditionId}`, condition_id: conditionId, reviewed_at: '2026-10-28', ai_role: 'AI discovery & design', ai_role_evidence: 'Synthetic source', regulatory_status: 'approved', approval: { regulator: 'FDA', date: '2026-10-20' }, counts_as_cure: cure, summary: 'A synthetic approved drug.', sources: [{ label: 'Regulatory evidence', kind: 'regulatory', url: 'https://example.com/approval' }] };
}
function article(id, published = '2026-07-07') {
  return { id, published_at: published, reviewed_at: '2026-10-28', category: 'Clinical trials', title: `Research update ${id}`, summary: 'A synthetic development update.', context: 'Research news is not an approval or a cure.', sources: [{ label: 'Developer report', kind: 'developer', url: 'https://example.com/news' }] };
}

test('production datasets render into separate sections and downloads', () => {
  const { html, approvedDataset, newsDataset } = renderSite(template, actualApproved, actualNews);
  assert.equal((html.match(/data-record-id=/g) ?? []).length, actualApproved.records.length);
  assert.equal((html.match(/data-news-id=/g) ?? []).length, Math.min(3, actualNews.articles.length));
  assert.equal(approvedDataset.records.length, actualApproved.records.length);
  assert.equal(newsDataset.articles.length, actualNews.articles.length);
  assert.ok(html.includes('href="approved-drugs.json"'));
  assert.ok(html.includes('href="news.json"'));
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
});

test('news additions and changes never affect either counter', () => {
  const first = renderSite(template, approved, news);
  const changedNews = { ...structuredClone(news), articles: [article('one'), article('two')] };
  const second = renderSite(template, approved, changedNews);
  assert.deepEqual(second.approvedDataset.counts, first.approvedDataset.counts);
  assert.match(second.html, /id="cure-count">0<\/div>/);
  assert.match(second.html, /id="approved-count">0<\/div>/);
  assert.match(second.html, /0 APPROVED RECORDS/);
  assert.match(second.html, /No approved AI-designed drugs documented yet\./);
  assert.ok(second.html.includes('Research update one'));
});

test('approved drugs and diseases are deduplicated across indications', () => {
  const data = { ...structuredClone(approved), records: [drug('one', 'Example A', 'a', true), drug('two', 'Example A', 'b', true), drug('three', 'Example B', 'a', true)] };
  const { html, approvedDataset } = renderSite(template, data, news);
  assert.deepEqual(approvedDataset.counts, { documented_disease_cures: 2, documented_approved_novel_ai_designed_active_substances: 2 });
  assert.match(html, /id="approved-count">2<\/div>/);
  assert.match(html, /id="cure-count">2<\/div>/);
  assert.match(html, /3 APPROVED RECORDS/);
  assert.match(html, /class="record-index">03<\/div>/);
  assert.match(html, /FDA APPROVED/);
});

test('news sorts newest first, shows three articles and exports the full dataset', () => {
  const data = { ...structuredClone(news), articles: [article('old', '2026-01-01'), article('latest', '2026-10-20'), article('middle', '2026-05-01'), article('newer', '2026-09-01')] };
  const { html, newsDataset } = renderSite(template, approved, data);
  assert.deepEqual(newsDataset.articles.map(item => item.id), ['latest', 'newer', 'middle', 'old']);
  assert.equal((html.match(/data-news-id=/g) ?? []).length, 3);
  assert.ok(html.indexOf('data-news-id="latest"') < html.indexOf('data-news-id="newer"'));
  assert.ok(!html.includes('data-news-id="old"'));
});

test('JSON text, source labels and review dates flow into generated HTML', () => {
  const drugs = { ...structuredClone(approved), reviewed_at: '2026-10-29', records: [drug('one', 'Edited drug', 'a')] };
  drugs.records[0].summary = 'A revised drug summary.';
  const updates = { ...structuredClone(news), articles: [article('one')] };
  Object.assign(updates.articles[0], { title: 'Edited headline', summary: 'A revised news summary.' });
  updates.articles[0].sources[0].label = 'Edited source label';
  const { html } = renderSite(template, drugs, updates);
  for (const value of ['Edited drug', 'A revised drug summary.', 'Edited headline', 'A revised news summary.', 'Edited source label', '29 Oct 2026', '29 October 2026', '7 Jul 2026']) assert.ok(html.includes(value));
});

test('empty datasets provide independent empty states', () => {
  const { html } = renderSite(template, approved, news);
  assert.match(html, /id="evidence-empty" class="evidence-empty" role="status">/);
  assert.match(html, /class="news-empty">/);
  assert.doesNotMatch(html, /data-record-id=|data-news-id=/);
});

test('invalid approval states and counter fields in news fail the build', () => {
  const data = { ...structuredClone(approved), records: [drug('one', 'Example A', 'a')] };
  data.records[0].regulatory_status = 'investigational';
  assert.throws(() => renderSite(template, data, news), /only approved drugs/);
  data.records[0].regulatory_status = 'approved';
  data.records[0].approval = null;
  assert.throws(() => renderSite(template, data, news), /FDA approval/);
  assert.throws(() => renderSite(template, { ...approved, counts: {} }, news), /calculated from records/);
  const updates = { ...structuredClone(news), articles: [{ ...article('one'), counts_as_cure: true }] };
  assert.throws(() => renderSite(template, approved, updates), /counter eligibility/);
  delete updates.articles[0].counts_as_cure;
  updates.articles[0].published_at = '2026-02-30';
  assert.throws(() => renderSite(template, approved, updates), /valid date/);
});

test('escapes drug and news content and rejects unsafe source URLs', () => {
  const data = { ...structuredClone(approved), records: [drug('one', '<img src=x onerror=alert(1)>', 'a')] };
  const updates = { ...structuredClone(news), articles: [article('one')] };
  updates.articles[0].title = '<script>alert(1)</script>';
  updates.articles[0].sources[0].label = '<b>Source</b>';
  const { html } = renderSite(template, data, updates);
  for (const escaped of ['&lt;img src=x onerror=alert(1)&gt;', '&lt;script&gt;alert(1)&lt;/script&gt;', '&lt;b&gt;Source&lt;/b&gt;']) assert.ok(html.includes(escaped));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  updates.articles[0].sources[0].url = 'javascript:alert(1)';
  assert.throws(() => renderSite(template, data, updates), /HTTPS/);
});
