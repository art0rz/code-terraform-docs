import { contextualTitleOverrides } from "./cross-link-overrides.mjs";

const protectedInlinePattern = /(`+[^`\n]*`+|!?\[[^\]\n]*\]\([^)]+\)|<[^>\n]+>|https?:\/\/[^\s)>]+)/g;
const ignoredCodeReferences = new Set(["False", "None", "True"]);

function key(value) {
  return value.trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function vitepressSlugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(\d)/, "_$1")
    .toLowerCase();
}

function headingLabel(markup) {
  return markup
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\(([^)]+)\)\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

function codeReferenceKeys(value) {
  const reference = value.trim();
  const keys = [key(reference)];
  const call = reference.match(/^(self\.)?([A-Za-z_][\w]*)\s*\([^)]*\)$/);
  const memberCall = reference.match(/^(\.[A-Za-z_][\w]*)\s*\([^)]*\)$/);

  if (call) keys.push(`${call[1] ? "." : ""}${call[2].toLowerCase()}()`);
  if (memberCall) keys.push(`${memberCall[1].toLowerCase()}()`);
  return [...new Set(keys)];
}

function addTarget(index, reference, target) {
  const referenceKey = key(reference);
  if (!referenceKey) return;
  const targets = index.get(referenceKey) ?? [];
  if (!targets.some((candidate) => candidate.url === target.url)) targets.push(target);
  index.set(referenceKey, targets);
}

function ambiguousTargets(index) {
  return [...index.entries()]
    .filter(([, targets]) => targets.length > 1)
    .map(([reference, targets]) => ({
      reference,
      targets: targets.map((target) => target.url)
    }))
    .sort((a, b) => a.reference.localeCompare(b.reference));
}

function reportableCodeReference(value) {
  if (ignoredCodeReferences.has(value)) return false;
  return /^[A-Z][A-Za-z0-9]+$/.test(value) || /^[a-z_][\w]*\([^)]*\)$/.test(value);
}

export function createCrossLinker(entries, markdownEntries) {
  const titleTargets = new Map();
  const symbolTargets = new Map();
  const entryByUrl = new Map(entries.map((entry) => [entry.url, entry]));

  for (const entry of entries) {
    addTarget(titleTargets, entry.title, {
      entryId: entry.id,
      title: entry.title,
      url: entry.url
    });

    const usedSlugs = new Map();
    for (const match of markdownEntries[entry.id].body.matchAll(/^#{3,6}\s+(.+)$/gm)) {
      const label = headingLabel(match[1]);
      const baseSlug = vitepressSlugify(label);
      const duplicateIndex = usedSlugs.get(baseSlug) ?? 0;
      usedSlugs.set(baseSlug, duplicateIndex + 1);
      const slug = duplicateIndex === 0 ? baseSlug : `${baseSlug}-${duplicateIndex}`;
      const target = {
        entryId: entry.id,
        title: label,
        url: `${entry.url}#${slug}`
      };

      for (const codeMatch of match[1].matchAll(/`([^`]+)`/g)) {
        for (const referenceKey of codeReferenceKeys(codeMatch[1])) {
          addTarget(symbolTargets, referenceKey, target);
        }
      }
    }
  }

  const plainTitleTexts = [...new Set(entries
    .map((entry) => entry.title)
    .filter((title) => title.length >= 4 && /[\s&/]/.test(title)))]
    .sort((a, b) => b.length - a.length);
  const titleByText = new Map(plainTitleTexts.flatMap((title) => {
    const targets = titleTargets.get(key(title)) ?? [];
    return targets.length === 1 ? [[title, targets[0]]] : [];
  }));
  const plainTitlePattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${plainTitleTexts.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`,
    "gu"
  );

  const report = {
    added: 0,
    codeLinks: 0,
    overrideLinks: 0,
    returnTypeLinks: 0,
    titleLinks: 0,
    conflictingReferences: new Set(),
    unresolvedCodeReferences: new Set(),
    ambiguousTitles: ambiguousTargets(titleTargets),
    ambiguousSymbols: ambiguousTargets(symbolTargets)
  };

  function candidatesFor(index, reference) {
    return index.get(key(reference)) ?? [];
  }

  function resolveCodeReference(value) {
    const referenceKeys = codeReferenceKeys(value);
    const exactTitleCandidates = candidatesFor(titleTargets, referenceKeys[0]);
    if (exactTitleCandidates.length === 1) return exactTitleCandidates[0];
    if (exactTitleCandidates.length > 1) {
      report.conflictingReferences.add(value);
      return undefined;
    }

    for (const referenceKey of referenceKeys) {
      const candidates = candidatesFor(symbolTargets, referenceKey);
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        report.conflictingReferences.add(value);
        return undefined;
      }
    }

    if (reportableCodeReference(value)) report.unresolvedCodeReferences.add(value);
    return undefined;
  }

  function resolveTypeExpression(value) {
    const targets = [...value.matchAll(/\b[A-Z][A-Za-z0-9]*\b/g)]
      .flatMap((match) => candidatesFor(titleTargets, match[0]))
      .filter((target, index, values) => values.findIndex((candidate) => candidate.url === target.url) === index);
    return targets.length === 1 ? targets[0] : undefined;
  }

  function linkifyPlainText(text, entry, linkedTargets) {
    plainTitlePattern.lastIndex = 0;
    return text.replace(plainTitlePattern, (match) => {
      const overrideUrl = contextualTitleOverrides[entry.section]?.[match];
      const overrideEntry = overrideUrl ? entryByUrl.get(overrideUrl) : undefined;
      const target = overrideEntry
        ? { entryId: overrideEntry.id, title: overrideEntry.title, url: overrideEntry.url }
        : titleByText.get(match);
      if (!target || target.entryId === entry.id || linkedTargets.has(target.url)) return match;
      linkedTargets.add(target.url);
      report.added += 1;
      report.titleLinks += 1;
      if (overrideUrl) report.overrideLinks += 1;
      return `[${match}](${target.url})`;
    });
  }

  function linkifyCodeToken(token, entry, linkedTargets, returnType) {
    const markerLength = token.match(/^`+/)?.[0].length ?? 1;
    const value = token.slice(markerLength, -markerLength).trim();
    const target = resolveCodeReference(value) ?? (returnType ? resolveTypeExpression(value) : undefined);
    if (!target || target.entryId === entry.id || (!returnType && linkedTargets.has(target.url))) return token;
    linkedTargets.add(target.url);
    report.added += 1;
    if (returnType) {
      report.returnTypeLinks += 1;
    } else {
      report.codeLinks += 1;
    }
    return `[${token}](${target.url})`;
  }

  function linkifyLine(line, entry, linkedTargets, returnType) {
    let output = "";
    let cursor = 0;
    protectedInlinePattern.lastIndex = 0;

    for (const match of line.matchAll(protectedInlinePattern)) {
      output += linkifyPlainText(line.slice(cursor, match.index), entry, linkedTargets);
      const token = match[0];
      output += token.startsWith("`")
        ? linkifyCodeToken(token, entry, linkedTargets, returnType)
        : token;
      cursor = match.index + token.length;
    }

    return output + linkifyPlainText(line.slice(cursor), entry, linkedTargets);
  }

  function linkify(body, entry) {
    const linkedTargets = new Set();
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

      if (fence || /^\s{0,3}#{1,6}\s/.test(line) || /^\s*</.test(line)) return line;
      const returnType = /^\s*-\s+\*\*Returns\*\*/.test(line);
      return linkifyLine(line, entry, linkedTargets, returnType);
    }).join("\n");
  }

  function finalReport() {
    return {
      added: report.added,
      codeLinks: report.codeLinks,
      overrideLinks: report.overrideLinks,
      returnTypeLinks: report.returnTypeLinks,
      titleLinks: report.titleLinks,
      ambiguousTitles: report.ambiguousTitles,
      ambiguousSymbols: report.ambiguousSymbols,
      conflictingReferences: [...report.conflictingReferences].sort(),
      unresolvedCodeReferences: [...report.unresolvedCodeReferences].sort()
    };
  }

  return { linkify, report: finalReport };
}
