# Code: Terraform docs

A searchable static documentation site generated from the game's exported manual.

<a href="https://art0rz.github.io/code-terraform-docs/">
  <img src="https://img.shields.io/badge/Open_the_searchable_documentation-0969da?style=for-the-badge" alt="Open the searchable documentation" height="48">
</a>

## Requirements

- Node.js 26.8.2 (selected by `.tool-versions`)
- npm

## Commands

```bash
npm install
npm run import
npm run docs:dev
npm run docs:build
npm run docs:preview
```

`npm run import` requires one source export:

- `Code-Terraform-DOCS-Manual.md` supplies the build identifier, hierarchy, page boundaries, and content.

The importer validates all Markdown entries before replacing `docs/generated`. It then writes 367 entry pages, section landing pages, the nested sidebar, and a machine-readable manifest.

It also adds conservative cross-links for uniquely resolved page titles, types, functions, properties, and methods. Code blocks, headings, existing links, raw HTML, ambiguous names, and repeated references to the same target are left untouched. Return annotations are the exception: each resolvable return type is linked, including the single documented inner type in expressions such as `list<CropJob>`. Cross-link statistics and conflicts are recorded in the generated manifest.

Edit `scripts/cross-link-overrides.mjs` when an otherwise ambiguous title has a reliable destination within a particular manual section.

## Updating from a new game export

1. Replace `Code-Terraform-DOCS-Manual.md`.
2. Commit the updated export.
3. Push `main` to GitHub.

The GitHub Pages workflow installs dependencies, validates and imports the manual, builds the site with the repository base path, and publishes it. No generated files need to be committed.

The importer compares the parsed pages with the export's Contents list, so game updates can add or remove entries without requiring a script change. A truncated or structurally inconsistent export still fails validation.

Never edit files in `docs/generated` or the generated sidebar directly; the next import replaces them.

## Search

Search is built into the static site and works without a server-side search service. It provides:

- fuzzy and prefix matching;
- title and heading boosts;
- API-aware tokenization for dotted names, calls, and snake_case identifiers;
- extracted method names, statuses, types, and other inline code terms;
- a small curated vocabulary mapping player phrasing such as `recharge` to documented terms such as `charge` and `charging`.

Edit `scripts/search-aliases.mjs` to add page-specific vocabulary. Edit `docs/.vitepress/search-language.mjs` to add query-time synonyms or tokenization behavior.

## Generated output

The production site is written to `docs/.vitepress/dist` by `npm run docs:build`.

## GitHub Pages setup

The workflow in `.github/workflows/deploy-pages.yml` deploys every push to `main`. Once the repository is on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. This is a one-time repository setting.

Local builds use `/` as the site base. The deployment workflow automatically uses `/<repository-name>/`, so project-site links work without hard-coding an owner or repository name.
