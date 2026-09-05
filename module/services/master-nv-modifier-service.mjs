import { NVModifierService } from "./nv-modifier-service.mjs";

/** Manages the GM-owned NV modifiers applied globally or to one actor. */
export class MasterNVModifierService {
  static GLOBAL_SETTING_KEY = "master-global-nv-modifiers";
  static LEGACY_SETTING_KEY = "master-global-nv";
  static LOCAL_FLAG_KEY = "master-local-nv-modifiers";

  static registerSettings() {
    game.settings.register("naruto2d6world", this.GLOBAL_SETTING_KEY, {
      name: "Modificadores globais de NV do Mestre",
      scope: "world",
      config: false,
      type: Array,
      default: []
    });
  }

  static getGlobalModifiers() {
    return (game.settings.get("naruto2d6world", this.GLOBAL_SETTING_KEY) ?? [])
      .map((modifier) => this._normalize(modifier));
  }

  static getLocalModifiers(actor) {
    if (!actor) return [];
    return (actor.getFlag("naruto2d6world", this.LOCAL_FLAG_KEY) ?? [])
      .map((modifier) => this._normalize(modifier));
  }

  static getModifiers(actor) {
    return [
      ...this.getGlobalModifiers().map((modifier) => ({ ...modifier, scope: "Global", label: `Mestre Global — ${modifier.name}` })),
      ...this.getLocalModifiers(actor).map((modifier) => ({ ...modifier, scope: "Local", label: `Mestre Local — ${modifier.name}` }))
    ];
  }

  static getApplicableModifiers(actor, attribute = null, movement = null) {
    return this.getModifiers(actor).filter((modifier) => NVModifierService.applies(modifier, { attribute, movement }));
  }

  static getTotal(actor, attribute = null, movement = null) {
    return this.getApplicableModifiers(actor, attribute, movement).reduce((total, modifier) => total + modifier.value, 0);
  }

  static async addGlobalModifier({ name, value, attributes = [], moves = [] }) {
    this._requireGM();
    const modifier = this._createModifier(name, value, attributes, moves);
    await game.settings.set("naruto2d6world", this.GLOBAL_SETTING_KEY, [...this.getGlobalModifiers(), modifier]);
    return modifier;
  }

  static async removeGlobalModifier(id) {
    this._requireGM();
    await game.settings.set("naruto2d6world", this.GLOBAL_SETTING_KEY, this.getGlobalModifiers().filter((modifier) => modifier.id !== id));
  }

  static async updateGlobalModifier(id, { name, value, attributes = [], moves = [] }) {
    this._requireGM();
    const updatedModifier = this._createModifier(name, value, attributes, moves);
    const modifiers = this.getGlobalModifiers().map((modifier) => (
      modifier.id === id ? { ...updatedModifier, id } : modifier
    ));
    await game.settings.set("naruto2d6world", this.GLOBAL_SETTING_KEY, modifiers);
  }

  static async adjustGlobalModifier(id, amount) {
    this._requireGM();
    const modifiers = this.getGlobalModifiers().map((modifier) => (
      modifier.id === id ? { ...modifier, value: modifier.value + Number(amount) } : modifier
    ));
    await game.settings.set("naruto2d6world", this.GLOBAL_SETTING_KEY, modifiers);
  }

  static async clearGlobalModifiers() {
    this._requireGM();
    await game.settings.set("naruto2d6world", this.GLOBAL_SETTING_KEY, []);
  }

  static async addLocalModifier(actor, { name, value, attributes = [], moves = [] }) {
    this._requireGM();
    if (!actor) throw new Error("Um personagem é obrigatório para criar um modificador local.");
    if (actor.type !== "character") throw new Error("Apenas personagens podem receber modificadores locais de NV do Mestre.");
    const modifier = this._createModifier(name, value, attributes, moves);
    await actor.setFlag("naruto2d6world", this.LOCAL_FLAG_KEY, [...this.getLocalModifiers(actor), modifier]);
    return modifier;
  }

  static async removeLocalModifier(actor, id) {
    this._requireGM();
    if (actor?.type !== "character") return;
    await actor.setFlag("naruto2d6world", this.LOCAL_FLAG_KEY, this.getLocalModifiers(actor).filter((modifier) => modifier.id !== id));
  }

  static async adjustLocalModifier(actor, id, amount) {
    this._requireGM();
    if (actor?.type !== "character") return;
    const adjustment = Number(amount);
    if (!Number.isFinite(adjustment)) return;
    const modifiers = this.getLocalModifiers(actor).map((modifier) => (
      modifier.id === id ? { ...modifier, value: modifier.value + adjustment } : modifier
    ));
    await actor.setFlag("naruto2d6world", this.LOCAL_FLAG_KEY, modifiers);
  }

  static async updateLocalModifier(actor, id, { name, value, attributes = [], moves = [] }) {
    this._requireGM();
    if (actor?.type !== "character") return;
    const updatedModifier = this._createModifier(name, value, attributes, moves);
    const modifiers = this.getLocalModifiers(actor).map((modifier) => (
      modifier.id === id ? { ...updatedModifier, id } : modifier
    ));
    await actor.setFlag("naruto2d6world", this.LOCAL_FLAG_KEY, modifiers);
  }

  static async clearLocalModifiers(actor) {
    this._requireGM();
    if (actor?.type !== "character") return;
    await actor.setFlag("naruto2d6world", this.LOCAL_FLAG_KEY, []);
  }

  /** Converts the retired scalar setting once, without losing existing worlds' value. */
  static async migrateLegacySetting() {
    if (!game.user.isGM || this.getGlobalModifiers().length) return;
    const legacyValue = Number(game.settings.get("naruto2d6world", this.LEGACY_SETTING_KEY)) || 0;
    if (!legacyValue) return;
    await game.settings.set("naruto2d6world", this.GLOBAL_SETTING_KEY, [this._createModifier("NV Mestre (legado)", legacyValue)]);
    await game.settings.set("naruto2d6world", this.LEGACY_SETTING_KEY, 0);
  }

  static _createModifier(name, value, attributes = [], moves = []) {
    const numericValue = Number(value);
    if (!String(name ?? "").trim() || !Number.isFinite(numericValue)) {
      throw new Error("Informe um nome e um valor numérico para o modificador.");
    }
    return {
      id: randomID(),
      name: String(name).trim(),
      value: numericValue,
      attributes: NVModifierService.normalizeAttributes(attributes),
      moves: NVModifierService.normalizeMoves(moves)
    };
  }

  static _normalize(modifier) {
    return NVModifierService.normalize(modifier, "Modificador do Mestre");
  }

  static _requireGM() {
    if (!game.user.isGM) throw new Error("Somente o Mestre pode alterar modificadores de NV.");
  }
}
