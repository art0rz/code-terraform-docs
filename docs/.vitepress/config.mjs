import { defineConfig } from "vitepress";
import sidebar from "./generated-sidebar.mjs";
import { processTerm, tokenize } from "./search-language.mjs";

const siteBase = process.env.DOCS_BASE || "/";

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

export default defineConfig({
  title: "Code: Terraform",
  description: "Searchable player documentation for Code: Terraform",
  base: siteBase,
  cleanUrls: true,
  lastUpdated: false,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/generated/guide/" },
      { text: "Components", link: "/generated/components/" },
      { text: "Language", link: "/generated/language/" },
      { text: "Types", link: "/generated/types/" }
    ],
    sidebar,
    outline: { level: [2, 3], label: "On this page" },
    docFooter: { prev: "Previous", next: "Next" },
    search: {
      provider: "local",
      options: {
        miniSearch: {
          options: { tokenize, processTerm },
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: { title: 10, titles: 5, text: 1 }
          }
        },
        async _render(src, env, md) {
          const html = typeof md.renderAsync === "function"
            ? await md.renderAsync(src, env)
            : md.render(src, env);
          const terms = env.frontmatter?.searchTerms;
          if (!Array.isArray(terms) || terms.length === 0) return html;
          return `<p>${escapeHtml(terms.join(" "))}</p>${html}`;
        }
      }
    }
  }
});
