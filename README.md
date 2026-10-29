# Are We Cured Yet?

An English-language, evidence-based tracker of **approved AI-designed drugs** and **diseases cured with AI**, with a separate research news section.

- Production domain: **https://arewecured.com**
- GitHub Pages project address: **https://timostrotmann.github.io/are-we-cured-yet/**
- Source repository: **https://github.com/timostrotmann/are-we-cured-yet**

The site is static. A small Node.js build generates HTML, counters, and JSON downloads. It needs no backend, database, API keys, or npm dependencies. GitHub Actions tests and rebuilds the site after changes to `main`.

## Project structure

```text
.github/workflows/pages.yml  Test, build, and deploy to GitHub Pages
.nvmrc                      Node.js version used by CI (24)
data/approved-drugs.json     Approved-drug records; the only input to the counters
data/news.json               Dated research news; never included in the counters
public/                      CSS, JavaScript, SVGs, .nojekyll, and CNAME
src/index.template.html      Layout, navigation, and methodology text
scripts/render.mjs           Data validation, counting, and HTML rendering
scripts/build.mjs            Copy public assets and generate dist/
tests/                       Rendering and deployment-artifact tests
dist/                        Generated site; ignored by Git
```

Edit the files in `data/`, `src/`, and `public/`. Do not edit generated files inside `dist/`. The former Sites hosting configuration and Git history are not required for GitHub Pages.

## Run locally

Use Node.js 24 or newer. With nvm installed, `nvm use` selects the version from `.nvmrc`.

```sh
npm test
npm run build
python -m http.server 4173 --directory dist
```

Open http://localhost:4173. No `npm install` step is required because there are no dependencies. Run the build again after editing a dataset, the HTML template, or public assets, then refresh the browser.

## Add a news article

1. Open `data/news.json`.
2. Add a new object to the `articles` array. Existing objects are separated by commas.
3. Choose a unique, stable `id` and fill in all fields below. Replace the placeholders, including the dates and source URL.
4. Run `npm test` and `npm run build`, then review the article locally.
5. Commit the source JSON and push to `main`, or open a pull request. GitHub Actions publishes after the change reaches `main`.

Illustrative template only; this is not a real announcement:

```json
{
  "id": "unique-news-id",
  "published_at": "YYYY-MM-DD",
  "reviewed_at": "YYYY-MM-DD",
  "category": "Clinical trials",
  "title": "Replace with a factual headline",
  "summary": "Summarize the announcement and attribute company-reported claims.",
  "context": "Explain the limitations, such as investigational status and lack of marketing approval.",
  "sources": [
    {
      "label": "Developer announcement",
      "kind": "developer",
      "url": "https://example.com/replace-with-real-source"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique article identifier. Keep it stable after publication. |
| `published_at` | Date of the source announcement or article, not the date it was added here. |
| `reviewed_at` | Date the sources and claims were last checked. |
| `category` | Short display label, such as `Clinical trials` or `Research`. |
| `title` | English headline. |
| `summary` | English factual summary with attribution where appropriate. |
| `context` | Qualification or limitation of the reported result. |
| `sources` | At least one labeled HTTPS source. |

The homepage shows the **three newest articles**, ordered by `published_at` from newest to oldest. The downloadable `news.json` contains every article. News has no counter-eligibility fields and never changes either counter.

## Add an approved-drug record

1. Verify that the drug qualifies under the methodology: a newly discovered or designed AI-origin active substance with an **FDA-approved therapeutic indication**. Repurposed drugs are excluded. Investigational candidates belong in news.
2. Open `data/approved-drugs.json` and add an object to `records`. The array is currently empty; replace `[]` with `[ { ... } ]` for the first record.
3. Fill in the fields below and supply real approval evidence and evidence of AI's contribution.
4. Set `counts_as_cure` to `true` only after separately verifying a durable curative outcome under the methodology. FDA approval alone does not establish a cure.
5. Run `npm test` and `npm run build`, inspect the record and counters locally, then commit and push or open a pull request.

Illustrative template only; **this does not represent a real approved drug**. Replace every placeholder before use:

```json
{
  "id": "unique-drug-indication-id",
  "name": "Replace with the drug name",
  "active_substance": "stable-active-substance-id",
  "condition": "Replace with the approved indication",
  "condition_id": "stable-condition-id",
  "reviewed_at": "YYYY-MM-DD",
  "ai_role": "AI discovery & design",
  "ai_role_evidence": "Describe the source documenting AI's contribution",
  "regulatory_status": "approved",
  "approval": {
    "regulator": "FDA",
    "date": "YYYY-MM-DD"
  },
  "counts_as_cure": false,
  "summary": "Describe the verified approval, indication, and AI contribution.",
  "sources": [
    {
      "label": "FDA approval",
      "kind": "regulatory",
      "url": "https://www.fda.gov/replace-with-real-approval-source"
    },
    {
      "label": "Evidence of AI contribution",
      "kind": "publication",
      "url": "https://example.com/replace-with-real-source"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique record identifier, normally for one drug and indication. |
| `name` | Drug name displayed on the site. |
| `active_substance` | Stable identifier used to count one drug only once across indications. Use the same value for the same active substance. |
| `condition` | Human-readable disease or approved indication. |
| `condition_id` | Stable disease identifier. Use the same value across drugs treating the same disease. |
| `reviewed_at` | Last verification date for this record's evidence. |
| `ai_role` | Short description displayed beside the indication. |
| `ai_role_evidence` | Attribution describing the evidence for AI involvement. |
| `regulatory_status` | Must be `approved`. The build rejects investigational drugs here. |
| `approval` | FDA regulator and the actual approval date. At least one source must have `kind: regulatory`. |
| `counts_as_cure` | Boolean editorial assessment under the cure methodology. Defaults to `false` in new records. |
| `summary` | English explanation of the documented milestone. |
| `sources` | Labeled HTTPS evidence, including a regulatory source. |

### How the counters are calculated

- **Approved AI-designed drugs:** number of distinct approved `active_substance` identifiers. Adding another indication for the same drug does not add another drug.
- **Diseases cured with AI:** number of distinct `condition_id` values among approved records with `counts_as_cure: true`. Multiple drugs curing the same disease count as one disease.
- News articles have no influence on either counter.

Do not add manual `counts`, `counts_as_approved`, or `is_repurposed` fields to source records. The build calculates counts and writes them to the downloadable `approved-drugs.json`.

## Sources and review dates

Each source uses `label`, `kind`, and `url`. Allowed `kind` values are `developer`, `registry`, `regulatory`, and `publication`. URLs must use HTTPS and may not contain credentials. Approval records require a regulatory source.

Every dataset and every record or article has its own `reviewed_at` in `YYYY-MM-DD` format. Update an individual date when its evidence is checked. Update the dataset-level date only after reviewing the **entire corresponding dataset**. Copy edits do not reset evidence-review dates. The review date above the counters comes from the approved-drug dataset.

This is a curated dataset, not an exhaustive global census. The build validates structure and consistency; maintaining factual accuracy and checking eligibility remain editorial tasks.

## GitHub Pages deployment

The workflow in `.github/workflows/pages.yml` runs on pushes to `main`, pull requests, and manual dispatches.

- Pull requests run tests and build without publishing.
- Pushes to `main` and manual runs on `main` test, build, upload `dist/`, and deploy to the `github-pages` environment.
- In **Settings → Pages → Build and deployment**, the source must be **GitHub Actions**.
- The workflow uses GitHub's automatic token. No personal access token, deployment key, or repository secret is needed.
- Only the generated `dist/` artifact is published. Source JSON, tests, the template, and the README remain in the repository.

If deployment fails, open the repository's **Actions** tab and read the failing step. Invalid data prevents publication and leaves the previous deployment in place.

## Domain and DNS: arewecured.com at IONOS

The primary website domain is **arewecured.com**. GitHub Pages hosts the website; IONOS manages the domain, DNS, and email. The old planned `.ai` domain is no longer the deployment target.

1. Set this repository's **Settings → Pages → Custom domain** to `arewecured.com` before pointing DNS at GitHub Pages. The publishing source remains **GitHub Actions**.
2. In IONOS, open **Domains & SSL → arewecured.com → DNS**. Replace the previous website A/AAAA values with these GitHub Pages records and add the `www` CNAME:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` |
   | AAAA | `@` | `2606:50c0:8001::153` |
   | AAAA | `@` | `2606:50c0:8002::153` |
   | AAAA | `@` | `2606:50c0:8003::153` |
   | CNAME | `www` | `timostrotmann.github.io` |

3. Preserve IONOS nameservers and all email records, including MX, SPF, DKIM, DMARC and autodiscover. This keeps email, including `hello@arewecured.com`, separate from website hosting. Use individual DNS edits rather than resetting the entire domain.
4. Wait for DNS propagation and GitHub's certificate provisioning. Enable **Enforce HTTPS** when the certificate is available, then verify both `https://arewecured.com` and `https://www.arewecured.com`. GitHub redirects `www` to the primary domain.

`public/CNAME` documents the intended domain and is copied into `dist/`. With this Actions-based deployment, that file alone does not configure the custom domain: the repository Pages setting controls it. Recommended additional protection: verify the domain under your GitHub account's **Settings → Pages** using the account-specific TXT record GitHub supplies.

Official references: [GitHub custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages), [IONOS A/AAAA records](https://www.ionos.de/hilfe/domains/ip-adresse-konfigurieren/domain-mit-statischer-ip-adresse-verbinden/).

## Frontend assets

Edit the layout in `src/index.template.html` and CSS, JavaScript, or SVGs in `public/`. Asset and download links are relative, so the site works both under a repository path and at the root of a custom domain. Navigation supports keyboard use and a mobile hamburger menu. Google Fonts is currently loaded through an external stylesheet with system-font fallbacks.

## Link previews on X and Facebook

The static HTML head includes Open Graph and X Card metadata, using the canonical URL `https://arewecured.com/`, account `@AreWeCuredYet`, and an absolute HTTPS image URL. The card image is `public/social-card-v1.jpg` (1200 × 630). Both metadata and artwork are available without JavaScript.

The editable artwork is `src/social-card.html`; it reuses the website CSS and capsule illustration. Serve the repository locally, open that file in a browser, wait for its fonts and image to load, and export the 1200 × 630 artwork area as a JPEG. Update the public image and metadata together. Use a new versioned image filename when replacing the artwork so crawlers can fetch the new asset.
