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

  static normalizeMoves(moves) {
    if (!Array.isArray(moves)) return [];
    return [...new Set(moves.map((name) => String(name ?? "").trim()).filter(Boolean))];
  }

  static normalize(modifier = {}, fallbackName = "Modificador de NV") {
    return {
      ...modifier,
      id: modifier.id || randomID(),
      name: String(modifier.name || fallbackName),
      value: Number(modifier.value) || 0,
      attributes: this.normalizeAttributes(modifier.attributes),
      moves: this.normalizeMoves(modifier.moves)
    };
  }

  static appliesToAttribute(modifier, attribute = null) {
    const attributes = this.normalizeAttributes(modifier?.attributes);
    return attributes.length === 0 || (Boolean(attribute) && attributes.includes(attribute));
  }

  static appliesToMovement(modifier, movement = null) {
    const moves = this.normalizeMoves(modifier?.moves);
    if (!moves.length) return true;
    const movementName = typeof movement === "string" ? movement : movement?.name;
    return Boolean(movementName) && moves.includes(movementName);
  }

  static applies(modifier, { attribute = null, movement = null } = {}) {
    return this.appliesToAttribute(modifier, attribute) && this.appliesToMovement(modifier, movement);
  }

  static getAttributeLabel(modifier) {
    const selected = this.normalizeAttributes(modifier?.attributes);
    if (!selected.length) return "Todos os atributos";
    const names = new Map(this.ATTRIBUTES.map(({ ref, name }) => [ref, name]));
    return selected.map((ref) => names.get(ref)).filter(Boolean).join(", ");
  }

  static getMovementLabel(modifier) {
    const moves = this.normalizeMoves(modifier?.moves);
    return moves.length ? moves.join(", ") : "Todos os movimentos";
  }

  static getActorMovementNames(actor) {
    if (!actor) return [];
    return this.normalizeMoves(actor.items.filter((item) => item.type === "move").map((item) => item.name));
  }

  static getWorldMovementNames() {
    const names = [];
    for (const actor of game.actors ?? []) {
      if (actor.type !== "character") continue;
      names.push(...this.getActorMovementNames(actor));
    }
    return this.normalizeMoves(names).sort((left, right) => left.localeCompare(right, game.i18n?.lang ?? "pt-BR"));
  }
}
