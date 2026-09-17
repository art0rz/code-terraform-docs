const synonyms = new Map(Object.entries({
  aerial: ["drone"],
  charge: ["charging", "recharge"],
  charging: ["charge", "recharge"],
  communication: ["message", "signal"],
  electricity: ["power"],
  error: ["exception", "failure"],
  hotkey: ["shortcut", "keybind"],
  hotkeys: ["shortcuts", "keybinds"],
  inventory: ["storage", "items"],
  job: ["contract", "order"],
  logs: ["console", "output"],
  machine: ["component"],
  message: ["signal", "communication"],
  pipe: ["fluid", "network"],
  pipes: ["fluid", "network"],
  recharge: ["charge", "charging"],
  refill: ["recharge", "refuel"],
  repair: ["service"],
  result: ["status", "return"],
  shortcut: ["hotkey", "keybind"],
  storage: ["inventory", "cargo"],
  transfer: ["move", "cargo"],
  vehicle: ["rover", "pioneer", "drone"],
  waypoint: ["marker", "coordinate"]
}));

function expandToken(rawToken) {
  const token = rawToken.toLowerCase().replace(/^['"]+|['"]+$/g, "");
  if (!token) return [];

  const expanded = new Set([token]);
  const withoutCall = token.replace(/\(.*\)$/, "");
  expanded.add(withoutCall);

  const parts = withoutCall.split(/[._-]+/).filter(Boolean);
  for (const part of parts) expanded.add(part);
  if (parts.length > 1) expanded.add(parts.join(""));

  for (const alias of synonyms.get(token) ?? synonyms.get(withoutCall) ?? []) expanded.add(alias);
  return [...expanded].filter(Boolean);
}

export function tokenize(text) {
  // VitePress serializes this function for its browser worker. Keep its
  // runtime dependencies inside the function instead of closing over them.
  const browserSynonyms = {
    aerial: ["drone"],
    charge: ["charging", "recharge"],
    charging: ["charge", "recharge"],
    communication: ["message", "signal"],
    electricity: ["power"],
    error: ["exception", "failure"],
    hotkey: ["shortcut", "keybind"],
    hotkeys: ["shortcuts", "keybinds"],
    inventory: ["storage", "items"],
    job: ["contract", "order"],
    logs: ["console", "output"],
    machine: ["component"],
    message: ["signal", "communication"],
    pipe: ["fluid", "network"],
    pipes: ["fluid", "network"],
    recharge: ["charge", "charging"],
    refill: ["recharge", "refuel"],
    repair: ["service"],
    result: ["status", "return"],
    shortcut: ["hotkey", "keybind"],
    storage: ["inventory", "cargo"],
    transfer: ["move", "cargo"],
    vehicle: ["rover", "pioneer", "drone"],
    waypoint: ["marker", "coordinate"]
  };

  return String(text).match(/[A-Za-z0-9_.'"()-]+/g)?.flatMap((rawToken) => {
    const token = rawToken.toLowerCase().replace(/^['"]+|['"]+$/g, "");
    if (!token) return [];
    const expanded = new Set([token]);
    const withoutCall = token.replace(/\(.*\)$/, "");
    expanded.add(withoutCall);
    const parts = withoutCall.split(/[._-]+/).filter(Boolean);
    for (const part of parts) expanded.add(part);
    if (parts.length > 1) expanded.add(parts.join(""));
    const aliases = browserSynonyms[token] ?? browserSynonyms[withoutCall];
    if (Array.isArray(aliases)) {
      for (const alias of aliases) expanded.add(alias);
    }
    return [...expanded].filter(Boolean);
  }) ?? [];
}

export function processTerm(term) {
  return term.toLowerCase();
}
