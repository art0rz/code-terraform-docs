import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCrossLinker } from "./cross-links.mjs";
import { groupAliases, titleAliases } from "./search-aliases.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdownPath = path.join(projectRoot, "Code-Terraform-DOCS-Manual.md");
const generatedRoot = path.join(projectRoot, "docs", "generated");
const sidebarPath = path.join(projectRoot, "docs", ".vitepress", "generated-sidebar.mjs");
const manifestPath = path.join(projectRoot, "docs", ".vitepress", "manual-manifest.json");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "index";
}

function extractMarkdownBuild(markdown) {
  const match = markdown.match(/^Build\s+([^\s]+)\s*$/m);
  if (!match) throw new Error("Could not find the build identifier in the Markdown export.");
  return match[1];
}

function extractMarkdownEntries(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const starts = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^## (?!Contents\s*$)/.test(lines[index])) continue;
    let eyebrowIndex = index - 1;
    while (eyebrowIndex >= 0 && lines[eyebrowIndex].trim() === "") eyebrowIndex -= 1;
    if (!/^\*[^*]+\*$/.test(lines[eyebrowIndex] ?? "")) continue;
    starts.push({ headingIndex: index, eyebrowIndex });
  }

  return starts.map((start, index) => {
    const end = starts[index + 1]?.eyebrowIndex ?? lines.length;
    // Headings may wrap identifiers in inline code; the Contents list does not.
    const rawTitle = lines[start.headingIndex].slice(3).replaceAll("`", "").trim();
    const badgeMatch = rawTitle.match(/\s+\*\(([^)]+)\)\*$/);
    return {
      eyebrow: lines[start.eyebrowIndex].slice(1, -1),
      title: badgeMatch ? rawTitle.slice(0, badgeMatch.index).trim() : rawTitle,
      badge: badgeMatch?.[1] ?? "",
      body: lines.slice(start.headingIndex + 1, end).join("\n").trim()
    };
  });
}

function extractMarkdownContents(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const contentsIndex = lines.findIndex((line) => line.trim() === "## Contents");
  if (contentsIndex === -1) throw new Error("Could not find the Markdown contents list.");

  const entries = [];
  let section;

  for (const line of lines.slice(contentsIndex + 1)) {
    if (/^\*[^*]+\*$/.test(line)) break;

    const sectionMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const entryMatch = line.match(/^- (.+)$/);
    if (!entryMatch) continue;
    if (!section) throw new Error(`Contents entry has no section: ${entryMatch[1]}`);
    entries.push(`${section} / ${entryMatch[1]}`);
  }

  if (entries.length === 0) throw new Error("The Markdown contents list is empty.");
  return entries;
}

function extractSearchTerms(entry, body) {
  const terms = new Set([
    entry.section,
    entry.group,
    ...(groupAliases[entry.section] ?? []),
    ...(titleAliases[entry.title] ?? [])
  ].filter(Boolean));

  for (const match of body.matchAll(/`([^`\n]{2,100})`/g)) {
    const value = match[1].trim();
    if (/^(?:self\.)?[A-Za-z_][\w.]*(?:\([^)]*\))?$/.test(value)) terms.add(value);
    if (/^"[a-z][a-z0-9_]*"$/.test(value)) terms.add(value.slice(1, -1));
  }

  return [...terms].sort((a, b) => a.localeCompare(b));
}

function pageDescription(body) {
  const paragraph = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_#[\]|>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return paragraph.slice(0, 180);
}

function normalizeHeadingLevels(body) {
  let fence;

  return body.split("\n").map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { character: marker[0], length: marker.length };
      } else if (marker[0] === fence.character && marker.length >= fence.length) {
        fence = undefined;
      }
      return line;
    }

    if (fence) return line;
    if (line.startsWith("##### ")) return `### ${line.slice(6)}`;
    if (line.startsWith("### ")) return `## ${line.slice(4)}`;
    return line;
  }).join("\n");
}

function frontmatter(entry, build, searchTerms, description) {
  return [
    "---",
    `title: ${JSON.stringify(entry.title)}`,
    `description: ${JSON.stringify(description)}`,
    `manualBuild: ${JSON.stringify(build)}`,
    `manualEntry: ${entry.id}`,
    `section: ${JSON.stringify(entry.section)}`,
    `group: ${JSON.stringify(entry.group)}`,
    `searchTerms: ${JSON.stringify(searchTerms)}`,
    "outline: [2, 3]",
    "---"
  ].join("\n");
}

function uniquePaths(entries) {
  const used = new Set();
  for (const entry of entries) {
    const parts = [slugify(entry.section)];
    if (entry.group) parts.push(slugify(entry.group));
    parts.push(slugify(entry.title));
    let relativePath = `${parts.join("/")}.md`;
    if (used.has(relativePath)) relativePath = `${parts.join("/")}-${entry.id}.md`;
    if (used.has(relativePath)) throw new Error(`Could not create a unique path for entry ${entry.id}.`);
    used.add(relativePath);
    entry.relativePath = relativePath;
    entry.url = `/generated/${relativePath.slice(0, -3)}`;
  }
}

function makeSidebar(entries) {
  const sections = new Map();
  for (const entry of entries) {
    if (!sections.has(entry.section)) sections.set(entry.section, new Map());
    const groups = sections.get(entry.section);
    const group = entry.group || entry.section;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ text: entry.title, link: entry.url });
  }

  return [...sections].map(([section, groups]) => ({
    text: section,
    collapsed: section !== "Guide",
    items: [...groups].map(([group, items]) => ({
      text: group,
      collapsed: true,
      items
    }))
  }));
}

async function writeSectionIndexes(entries, build) {
  const sections = Object.groupBy(entries, (entry) => entry.section);

  for (const [section, sectionEntries] of Object.entries(sections)) {
    const groups = Object.groupBy(sectionEntries, (entry) => entry.group || section);
    const groupCount = Object.keys(groups).length;
    const content = [
      "---",
      `title: ${JSON.stringify(section)}`,
      `description: ${JSON.stringify(`Browse the ${section} section of the Code: Terraform manual.`)}`,
      `manualBuild: ${JSON.stringify(build)}`,
      "search: false",
      "outline: false",
      "---",
      "",
      `# ${section}`,
      "",
      `<p class="section-summary">${sectionEntries.length} ${sectionEntries.length === 1 ? "entry" : "entries"} across ${groupCount} ${groupCount === 1 ? "group" : "groups"}.</p>`,
      "",
      '<div class="section-grid">',
      ""
    ];

    for (const [group, groupEntries] of Object.entries(groups)) {
      const groupId = slugify(group);
      const sectionPrefix = `/generated/${slugify(section)}/`;
      content.push(
        `<section class="section-card" aria-labelledby="${groupId}">`,
        '  <div class="section-card-header">',
        `    <h2 id="${groupId}">${escapeHtml(group)}</h2>`,
        `    <span class="section-card-count">${groupEntries.length} ${groupEntries.length === 1 ? "entry" : "entries"}</span>`,
        "  </div>",
        '  <ul class="section-card-links">'
      );
      for (const entry of groupEntries) {
        const relativeUrl = entry.url.slice(sectionPrefix.length);
        content.push(`    <li><a href="${relativeUrl}">${escapeHtml(entry.title)}</a></li>`);
      }
      content.push("  </ul>", "</section>", "");
    }

    content.push("</div>", "");

    const outputPath = path.join(generatedRoot, slugify(section), "index.md");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${content.join("\n")}\n`);
  }
}

function entriesFromMarkdown(markdownEntries) {
  return markdownEntries.map((entry, id) => {
    const [section, ...groupParts] = entry.eyebrow.split(" / ");
    if (!section) throw new Error(`Entry ${id} has no section in its hierarchy marker.`);
    return {
      id,
      section,
      group: groupParts.join(" / "),
      title: entry.title
    };
  });
}

function validateMarkdown(markdown, markdownEntries) {
  for (const [index, entry] of markdownEntries.entries()) {
    if (!entry.title || !entry.eyebrow) throw new Error(`Entry ${index} is missing a title or hierarchy marker.`);
  }

  const contentsEntries = extractMarkdownContents(markdown);
  const pageEntries = markdownEntries.map((entry) => `${entry.eyebrow} / ${entry.title}`);
  const difference = (expected, actual) => {
    const remaining = new Map();
    for (const entry of actual) remaining.set(entry, (remaining.get(entry) ?? 0) + 1);
    return expected.filter((entry) => {
      const count = remaining.get(entry) ?? 0;
      if (count === 0) return true;
      remaining.set(entry, count - 1);
      return false;
    });
  };
  const missing = difference(contentsEntries, pageEntries);
  const unexpected = difference(pageEntries, contentsEntries);
  if (missing.length || unexpected.length) {
    const details = [
      missing.length ? `missing pages: ${missing.slice(0, 5).join(", ")}` : "",
      unexpected.length ? `pages absent from Contents: ${unexpected.slice(0, 5).join(", ")}` : ""
    ].filter(Boolean).join("; ");
    throw new Error(`Contents/page mismatch (${details}).`);
  }

  const orderMismatch = pageEntries.findIndex((entry, index) => entry !== contentsEntries[index]);
  if (orderMismatch !== -1) {
    throw new Error(`Contents/page order mismatch at entry ${orderMismatch}: expected ${contentsEntries[orderMismatch]}, found ${pageEntries[orderMismatch]}.`);
  }
}

async function main() {
  const markdown = await readFile(markdownPath, "utf8");
  const markdownEntries = extractMarkdownEntries(markdown);
  validateMarkdown(markdown, markdownEntries);

  const build = extractMarkdownBuild(markdown);
  const entries = entriesFromMarkdown(markdownEntries);
  uniquePaths(entries);
  const crossLinker = createCrossLinker(entries, markdownEntries);

  await rm(generatedRoot, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });
  await mkdir(path.dirname(sidebarPath), { recursive: true });

  for (const entry of entries) {
    const source = markdownEntries[entry.id];
    // The game export uses `preview` for console-output examples. Shiki does
    // not define that language, so render those deliberately as plain text.
    source.body = source.body.replace(/^```preview\s*$/gm, "```text");
    // Exported pages skip from h1 to h3, then from h3 to h5. Normalize those
    // levels so sections and API members form an accessible h1/h2/h3 tree.
    source.body = normalizeHeadingLevels(source.body);
    source.body = crossLinker.linkify(source.body, entry);
    const outputPath = path.join(generatedRoot, entry.relativePath);
    const breadcrumb = [entry.section, entry.group].filter(Boolean).join(" · ");
    const searchTerms = extractSearchTerms(entry, source.body);
    const heading = source.badge
      ? `# ${entry.title} <Badge type="tip" text=${JSON.stringify(source.badge)} />`
      : `# ${entry.title}`;
    const page = `${frontmatter(entry, build, searchTerms, pageDescription(source.body))}\n\n` +
      `<div class="doc-breadcrumb">${breadcrumb}</div>\n\n` +
      `${heading}\n\n${source.body}\n`;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, page);
    entry.searchTerms = searchTerms;
  }

  await writeSectionIndexes(entries, build);

  const sidebar = makeSidebar(entries);
  const crossLinks = crossLinker.report();
  await writeFile(sidebarPath, `// Generated by scripts/import-manual.mjs. Do not edit.\nexport default ${JSON.stringify(sidebar, null, 2)};\n`);
  await writeFile(manifestPath, `${JSON.stringify({ build, entryCount: entries.length, crossLinks, entries }, null, 2)}\n`);

  const sectionSummary = Object.entries(Object.groupBy(entries, (entry) => entry.section))
    .map(([section, values]) => `${section}=${values.length}`)
    .join(", ");
  console.log(`Imported ${entries.length} entries from build ${build}.`);
  console.log(sectionSummary);
  console.log(`Cross-links=${crossLinks.added} (${crossLinks.codeLinks} code, ${crossLinks.returnTypeLinks} return types, ${crossLinks.titleLinks} titles, ${crossLinks.overrideLinks} contextual overrides), ambiguous titles=${crossLinks.ambiguousTitles.length}, ambiguous symbols=${crossLinks.ambiguousSymbols.length}, unresolved code references=${crossLinks.unresolvedCodeReferences.length}.`);
}

await main();
