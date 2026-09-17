import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groupAliases, titleAliases } from "./search-aliases.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdownPath = path.join(projectRoot, "Code-Terraform-DOCS-Manual.md");
const generatedRoot = path.join(projectRoot, "docs", "generated");
const sidebarPath = path.join(projectRoot, "docs", ".vitepress", "generated-sidebar.mjs");
const manifestPath = path.join(projectRoot, "docs", ".vitepress", "manual-manifest.json");

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
    const rawTitle = lines[start.headingIndex].slice(3).trim();
    const badgeMatch = rawTitle.match(/\s+\*\(([^)]+)\)\*$/);
    return {
      eyebrow: lines[start.eyebrowIndex].slice(1, -1),
      title: badgeMatch ? rawTitle.slice(0, badgeMatch.index).trim() : rawTitle,
      badge: badgeMatch?.[1] ?? "",
      body: lines.slice(start.headingIndex + 1, end).join("\n").trim()
    };
  });
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
    const content = [
      "---",
      `title: ${JSON.stringify(section)}`,
      `description: ${JSON.stringify(`Browse the ${section} section of the Code: Terraform manual.`)}`,
      `manualBuild: ${JSON.stringify(build)}`,
      "search: false",
      "outline: [2, 2]",
      "---",
      "",
      `# ${section}`,
      ""
    ];

    for (const [group, groupEntries] of Object.entries(groups)) {
      content.push(`## ${group}`, "");
      for (const entry of groupEntries) content.push(`- [${entry.title}](${entry.url})`);
      content.push("");
    }

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

function validateMarkdown(markdownEntries) {
  const expected = 367;
  if (markdownEntries.length !== expected) {
    throw new Error(`Expected ${expected} Markdown entries; found ${markdownEntries.length}.`);
  }

  for (const [index, entry] of markdownEntries.entries()) {
    if (!entry.title || !entry.eyebrow) throw new Error(`Entry ${index} is missing a title or hierarchy marker.`);
  }
}

async function main() {
  const markdown = await readFile(markdownPath, "utf8");
  const markdownEntries = extractMarkdownEntries(markdown);
  validateMarkdown(markdownEntries);

  const build = extractMarkdownBuild(markdown);
  const entries = entriesFromMarkdown(markdownEntries);
  uniquePaths(entries);

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
  await writeFile(sidebarPath, `// Generated by scripts/import-manual.mjs. Do not edit.\nexport default ${JSON.stringify(sidebar, null, 2)};\n`);
  await writeFile(manifestPath, `${JSON.stringify({ build, entryCount: entries.length, entries }, null, 2)}\n`);

  const sectionSummary = Object.entries(Object.groupBy(entries, (entry) => entry.section))
    .map(([section, values]) => `${section}=${values.length}`)
    .join(", ");
  console.log(`Imported ${entries.length} entries from build ${build}.`);
  console.log(sectionSummary);
}

await main();
