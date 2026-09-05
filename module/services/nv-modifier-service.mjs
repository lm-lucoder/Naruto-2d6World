/** Shared normalization and attribute-scoping rules for every NV modifier. */
export class NVModifierService {
  static ATTRIBUTES = Object.freeze([
    { ref: "bod", name: "Físico" },
    { ref: "agl", name: "Agilidade" },
    { ref: "hrt", name: "Coração" },
    { ref: "shd", name: "Sombra" },
    { ref: "cun", name: "Astúcia" }
  ]);

  static normalizeAttributes(attributes) {
    const selected = Array.isArray(attributes)
      ? attributes
      : Object.entries(attributes ?? {}).filter(([, value]) => Boolean(value)).map(([ref]) => ref);
    const valid = new Set(this.ATTRIBUTES.map(({ ref }) => ref));
    return [...new Set(selected.map(String).filter((ref) => valid.has(ref)))];
  }

  static normalize(modifier = {}, fallbackName = "Modificador de NV") {
    return {
      ...modifier,
      id: modifier.id || randomID(),
      name: String(modifier.name || fallbackName),
      value: Number(modifier.value) || 0,
      attributes: this.normalizeAttributes(modifier.attributes)
    };
  }

  static appliesToAttribute(modifier, attribute = null) {
    const attributes = this.normalizeAttributes(modifier?.attributes);
    return attributes.length === 0 || (Boolean(attribute) && attributes.includes(attribute));
  }

  static getAttributeLabel(modifier) {
    const selected = this.normalizeAttributes(modifier?.attributes);
    if (!selected.length) return "Todos os atributos";
    const names = new Map(this.ATTRIBUTES.map(({ ref, name }) => [ref, name]));
    return selected.map((ref) => names.get(ref)).filter(Boolean).join(", ");
  }
}
