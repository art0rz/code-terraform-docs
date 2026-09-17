# Code: Terraform docs

A searchable static documentation site generated from the game's exported manual.

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

## Updating from a new game export

1. Replace `Code-Terraform-DOCS-Manual.md`.
2. Run `npm run docs:build`.
3. If the game adds or removes entries, update the expected entry count in `scripts/import-manual.mjs` after reviewing the change.

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
