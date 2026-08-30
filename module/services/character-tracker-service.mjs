/** Public service for opening and populating the compact character tracker. */
export class CharacterTrackerService {
  static SETTING_KEY = "character-tracker-actors";
  static AUTO_OPEN_SETTING_KEY = "auto-open-character-tracker";
  static DETAIL_MODE_SETTING_KEY = "character-tracker-detail-mode";
  static _application = null;

  static registerSettings() {
    game.settings.register("naruto2d6world", this.SETTING_KEY, {
      name: "Personagens monitorados",
      scope: "world",
      config: false,
      type: Array,
      default: []
    });
    game.settings.register("naruto2d6world", this.AUTO_OPEN_SETTING_KEY, {
      name: "Iniciar rastreador de personagens automaticamente?",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });
    game.settings.register("naruto2d6world", this.DETAIL_MODE_SETTING_KEY, {
      name: "Exibir detalhes no rastreador de personagens",
      scope: "client",
      config: false,
      type: Boolean,
      default: false
    });

    Hooks.on("updateActor", (actor) => {
      // Foundry broadcasts Actor document updates to every connected client.
      // Only the GM with an already open tracker needs to react to them.
      this._refreshForTrackedActor(actor);
    });
    for (const hookName of ["updateItem", "createItem", "deleteItem"]) {
      Hooks.on(hookName, (item) => {
        // Conditions and other embedded Items do not require a custom socket:
        // their updates are synchronized by Foundry before these hooks run.
        this._refreshForTrackedActor(item.actor ?? item.parent);
      });
    }
    Hooks.on("updateSetting", (setting) => {
      const rerenderKeys = [
        "naruto2d6world.master-global-nv-modifiers",
        `naruto2d6world.${this.DETAIL_MODE_SETTING_KEY}`
      ];
      if (!rerenderKeys.includes(setting.key) || !this._application?.rendered) return;
      this._application.render();
    });
  }

  static get trackedActorUuids() {
    return game.settings.get("naruto2d6world", this.SETTING_KEY) ?? [];
  }

  static async getTrackedActors() {
    const documents = await Promise.all(this.trackedActorUuids.map((uuid) => fromUuid(uuid)));
    return documents.filter((document) => document?.documentName === "Actor");
  }

  static get detailMode() {
    return game.settings.get("naruto2d6world", this.DETAIL_MODE_SETTING_KEY);
  }

  static async toggleDetailMode() {
    if (!game.user.isGM) return;
    await game.settings.set("naruto2d6world", this.DETAIL_MODE_SETTING_KEY, !this.detailMode);
  }

  static async addControlledTokens() {
    if (!game.user.isGM) {
      return ui.notifications.warn("Somente o Mestre pode adicionar personagens ao rastreador.");
    }

    const selectedActors = canvas.tokens.controlled
      .map((token) => token.actor)
      .filter((actor) => actor?.type === "character" || actor?.type === "npc");

    if (!selectedActors.length) {
      return ui.notifications.warn("Selecione ao menos um token de personagem ou NPC.");
    }

    const updatedUuids = [...new Set([...this.trackedActorUuids, ...selectedActors.map((actor) => actor.uuid)])];
    await game.settings.set("naruto2d6world", this.SETTING_KEY, updatedUuids);
    await this.open();
  }

  static async removeTrackedActor(actorUuid) {
    if (!game.user.isGM) {
      return ui.notifications.warn("Somente o Mestre pode remover personagens do rastreador.");
    }

    const updatedUuids = this.trackedActorUuids.filter((uuid) => uuid !== actorUuid);
    await game.settings.set("naruto2d6world", this.SETTING_KEY, updatedUuids);
    await this.open();
  }

  static async clearAll() {
    if (!game.user.isGM) {
      return ui.notifications.warn("Somente o Mestre pode limpar o rastreador.");
    }

    await game.settings.set("naruto2d6world", this.SETTING_KEY, []);
    await this.open();
  }

  static async open() {
    if (!game.user.isGM) {
      return ui.notifications.warn("O rastreador de personagens é exclusivo do Mestre.");
    }

    if (!this._application) {
      const { CharacterTrackerApplication } = await import("../apps/character-tracker-app.mjs");
      this._application = new CharacterTrackerApplication();
    }
    await this._application.render({ force: true });
    this._application.bringToFront();
    return this._application;
  }

  /** Force the currently open tracker to reflect any operation performed in it. */
  static async refresh() {
    if (!game.user.isGM || !this._application?.rendered) return;
    await this._application.render({ force: true });
  }

  static _refreshForTrackedActor(actor) {
    if (!game.user.isGM || !actor || !this._application?.rendered || !this.trackedActorUuids.includes(actor.uuid)) return;
    this.refresh().catch((error) => console.error("Não foi possível atualizar o rastreador de personagens:", error));
  }
}
