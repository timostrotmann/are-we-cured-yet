const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be nonempty text.`);
}

function requireDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${field} is not a valid date.`);
}

function requireHttps(value, field) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${field} must be an HTTPS URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${field} must be an HTTPS URL without credentials.`);
}

function validateSources(sources, id) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error(`${id} needs at least one source.`);
  for (const source of sources) {
    requireText(source.label, `${id}.source.label`);
    if (!['developer', 'registry', 'regulatory', 'publication'].includes(source.kind)) throw new Error(`${id}.source.kind is invalid.`);
    requireHttps(source.url, `${id}.source.url`);
  }
}

export function validateDataset(data) {
  if (!data || !Array.isArray(data.records)) throw new Error('A records array is required.');
  requireText(data.name, 'name');
  requireText(data.coverage, 'coverage');
  requireDate(data.reviewed_at, 'reviewed_at');
  if ('counts' in data) throw new Error('Do not store counts in the source dataset; they are calculated from records.');
  const ids = new Set();
  const substances = new Map();
  for (const record of data.records) {
    for (const field of ['id', 'name', 'active_substance', 'condition', 'condition_id', 'ai_role', 'ai_role_evidence', 'summary']) requireText(record[field], `${record.id ?? 'record'}.${field}`);
    if (ids.has(record.id)) throw new Error(`Duplicate record id: ${record.id}`);
    ids.add(record.id);
    requireDate(record.reviewed_at, `${record.id}.reviewed_at`);
    if ('is_repurposed' in record) throw new Error('Repurposing eligibility is a dataset-wide policy, not a record field.');
    if ('counts_as_approved' in record) throw new Error('Approval eligibility is derived from regulatory_status and approval.');
    if (record.regulatory_status !== 'approved') throw new Error(`${record.id}: only approved drugs belong in the approved-drugs dataset. Use news.json for research updates.`);
    if (typeof record.counts_as_cure !== 'boolean') throw new Error(`${record.id}.counts_as_cure must be boolean.`);
    validateSources(record.sources, record.id);
    if (record.approval?.regulator !== 'FDA') throw new Error(`${record.id} needs an FDA approval to count in this dataset.`);
    requireDate(record.approval.date, `${record.id}.approval.date`);
    if (!record.sources.some(source => source.kind === 'regulatory')) throw new Error(`${record.id} needs a regulatory source for its approval.`);
    const substance = record.active_substance.trim().toLowerCase();
    const displayName = record.name.trim().toLowerCase();
    if (substances.has(displayName) && substances.get(displayName) !== substance) throw new Error(`Inconsistent active_substance for ${record.name}.`);
    substances.set(displayName, substance);
  }
}

export function validateNewsDataset(data) {
  if (!data || !Array.isArray(data.articles)) throw new Error('News needs an articles array.');
  requireText(data.name, 'news.name');
  requireText(data.coverage, 'news.coverage');
  requireDate(data.reviewed_at, 'news.reviewed_at');
  if ('records' in data || 'counts' in data) throw new Error('News is separate from drug records and counters.');
  const ids = new Set();
  for (const article of data.articles) {
    for (const field of ['id', 'category', 'title', 'summary', 'context']) requireText(article[field], `news.${field}`);
    if (ids.has(article.id)) throw new Error(`Duplicate news id: ${article.id}`);
    ids.add(article.id);
    requireDate(article.published_at, `${article.id}.published_at`);
    requireDate(article.reviewed_at, `${article.id}.reviewed_at`);
    if ('counts_as_cure' in article || 'counts_as_approved' in article) throw new Error('News articles must not contain counter eligibility fields.');
    validateSources(article.sources, article.id);
  }
}

export function calculateCounts(records) {
  return {
    documented_disease_cures: new Set(records.filter(record => record.counts_as_cure).map(record => record.condition_id)).size,
    documented_approved_novel_ai_designed_active_substances: new Set(records.filter(record => record.regulatory_status === 'approved').map(record => record.active_substance.trim().toLowerCase())).size
  };
}

function formatDate(value, month) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function renderRecord(record, index) {
  const filter = 'approved';
  const status = 'FDA APPROVED';
  const verdict = record.counts_as_cure ? 'Counts as an approved drug and toward documented disease cures.' : 'Counts as an approved drug. Does not count as a cure.';
  const links = record.sources.map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>`).join('');
  return `  <article class="evidence-row" data-status="${filter}" data-record-id="${escapeHtml(record.id)}"><div class="record-index">${String(index + 1).padStart(2, '0')}</div><div class="record-name"><span class="tag ${filter}">${escapeHtml(status)}</span><h3>${escapeHtml(record.name)}</h3><p>${escapeHtml(record.condition)} · ${escapeHtml(record.ai_role)}</p></div><div class="record-detail"><p>${escapeHtml(record.summary)}</p><p class="record-verdict">${verdict}</p><div class="source-links">${links}</div></div></article>`;
}

function renderNewsArticle(article) {
  const links = article.sources.map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>`).join('');
  return `  <article class="news-row" data-news-id="${escapeHtml(article.id)}"><div class="news-meta"><time datetime="${article.published_at}">${escapeHtml(formatDate(article.published_at, 'short'))}</time><span>${escapeHtml(article.category)}</span></div><div class="news-content"><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.summary)}</p><p class="news-context">${escapeHtml(article.context)}</p><div class="source-links">${links}</div></div></article>`;
}

export function renderSite(template, data, news) {
  validateDataset(data);
  validateNewsDataset(news);
  const counts = calculateCounts(data.records);
  const sortedNews = [...news.articles].sort((a, b) => b.published_at.localeCompare(a.published_at) || a.id.localeCompare(b.id));
  const tokens = {
    SITE_NAME: escapeHtml(data.name),
    REVIEWED_AT: data.reviewed_at,
    REVIEWED_DATE_SHORT: escapeHtml(formatDate(data.reviewed_at, 'short')),
    REVIEWED_DATE_LONG: escapeHtml(formatDate(data.reviewed_at, 'long')),
    CURE_COUNT: String(counts.documented_disease_cures),
    APPROVED_COUNT: String(counts.documented_approved_novel_ai_designed_active_substances),
    RECORD_COUNT: String(data.records.length),
    RECORD_COUNT_TEXT: `${data.records.length} APPROVED RECORD${data.records.length === 1 ? '' : 'S'}`,
    EVIDENCE_RECORDS: data.records.map(renderRecord).join('\n'),
    EMPTY_HIDDEN: data.records.length ? ' hidden' : '',
    EMPTY_TEXT: 'No approved AI-designed drugs documented yet.',
    NEWS_ARTICLES: sortedNews.slice(0, 3).map(renderNewsArticle).join('\n'),
    NEWS_EMPTY_HIDDEN: news.articles.length ? ' hidden' : ''
  };
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in tokens)) throw new Error(`Unknown template token: ${key}`);
    return tokens[key];
  });
  for (const key of ['CURE_COUNT', 'APPROVED_COUNT', 'EVIDENCE_RECORDS', 'RECORD_COUNT_TEXT', 'NEWS_ARTICLES']) {
    if (!template.includes(`{{${key}}}`)) throw new Error(`Template is missing ${key}.`);
  }
  return { html, approvedDataset: { ...data, counts }, newsDataset: { ...news, articles: sortedNews } };
}
