export interface MarkdownEntry {
  eyebrow: string;
  title: string;
  badge: string;
  body: string;
}

export interface Entry {
  id: number;
  section: string;
  group: string;
  title: string;
}

export interface PlacedEntry extends Entry {
  relativePath: string;
  url: string;
}

export interface ManifestEntry extends PlacedEntry {
  searchTerms: string[];
}

export interface Fence {
  character: string;
  length: number;
}

/** Returns the item at `index`, throwing instead of yielding `undefined`. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Index ${index} is out of range (length ${items.length}).`);
  return item;
}

export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = keyOf(item);
    const group = groups.get(groupKey);
    if (group) {
      group.push(item);
    } else {
      groups.set(groupKey, [item]);
    }
  }
  return groups;
}

/**
 * Advances fenced-code-block tracking for one line. Returns the new fence
 * state and whether the line is itself a fence marker.
 */
export function trackFence(line: string, fence: Fence | undefined): { fence: Fence | undefined; isMarker: boolean } {
  const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
  if (marker === undefined) return { fence, isMarker: false };
  if (!fence) return { fence: { character: marker.charAt(0), length: marker.length }, isMarker: true };
  if (marker.charAt(0) === fence.character && marker.length >= fence.length) return { fence: undefined, isMarker: true };
  return { fence, isMarker: true };
}
