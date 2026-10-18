// Ambiguous page titles that have a clear meaning inside a particular manual
// section. Leave a title out when the correct destination still depends on
// sentence-level context.
export const contextualTitleOverrides: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Components: {
    "Data Archive": "/generated/components/logistics-and-orders/data-archive",
    "Earth Orders": "/generated/components/logistics-and-orders/earth-orders",
    "Map Markers": "/generated/components/exploration/map-markers",
    "Plant Terraformer": "/generated/components/biosphere/plant-terraformer",
    "Signal Bus": "/generated/components/logistics-and-orders/signal-bus"
  },
  Guide: {
    "Data Archive": "/generated/guide/automation-systems/data-archive",
    "Earth Orders": "/generated/guide/automation-systems/earth-orders",
    "Lists & Tuples": "/generated/guide/programming/lists-and-tuples",
    "Map Markers": "/generated/guide/automation-systems/map-markers",
    "Match / Case": "/generated/guide/programming/match-case",
    "Plant Terraformer": "/generated/guide/world-and-infrastructure/plant-terraformer",
    "Regular Expressions": "/generated/guide/programming/regular-expressions",
    "Signal Bus": "/generated/guide/automation-systems/signal-bus"
  },
  Language: {
    "Lists & Tuples": "/generated/language/data-structures/lists-and-tuples",
    "Match / Case": "/generated/language/control-flow/match-case",
    "Regular Expressions": "/generated/language/basics/regular-expressions"
  }
};
