// Hand-written vocabulary that bridges player language and API terminology.
// These aliases are added to the search index only; they are not rendered.
export const titleAliases: Readonly<Record<string, readonly string[]>> = {
  "Batteries & Charging": ["recharge", "refill battery", "vehicle power"],
  Battery: ["charge", "charging", "recharge", "power storage"],
  "Command Results": ["return value", "status message", "error result"],
  Contracts: ["programming puzzles", "jobs", "missions"],
  "Data Archive": ["persistent storage", "save data", "remember between loads"],
  Drones: ["flying vehicle", "air logistics", "aerial transport"],
  "Flow Networks, Fluids": ["pipes", "liquid network", "gas network"],
  "Input & Output": ["transfer items", "move cargo", "machine ports"],
  "Keyboard Shortcuts": ["hotkeys", "keybinds"],
  "Long-Running Scripts": ["automation loop", "restart safe", "save load"],
  "Map Markers": ["waypoints", "map pins", "coordinates"],
  "Power Networks": ["electricity", "grid", "power distribution"],
  "Reading Errors and Console Output": ["debug errors", "logs", "console"],
  "Refinement & Storage": ["process materials", "store items"],
  "Signal Bus": ["machine communication", "messages", "channels"],
  "Vehicle Proximity & Service": ["park vehicle", "repair", "refuel", "service area"]
};

export const groupAliases: Readonly<Record<string, readonly string[]>> = {
  Components: ["machine", "hardware", "component api"],
  Database: ["catalog", "recipe", "item data"],
  Guide: ["tutorial", "how to", "help"],
  Language: ["syntax", "programming language"],
  Types: ["object", "fields", "return type", "data type"]
};
