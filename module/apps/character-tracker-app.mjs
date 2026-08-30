import { CharacterTrackerService } from "../services/character-tracker-service.mjs";
import { MasterNVModifierService } from "../services/master-nv-modifier-service.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A compact floating tracker window. ApplicationV2 owns its frame dragging,
 * positioning, focus, resize and minimize interactions. DragDrop below is
 * uses native DragDrop only for external condition drops on tracker entries.
 */
export class CharacterTrackerApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "naruto2d6world-character-tracker",
    tag: "section",
    classes: ["naruto2d6world", "character-tracker"],
    actions: {
      addSelected: () => this._runAndRefresh(() => CharacterTrackerService.addControlledTokens()),
      removeTracked: (event, target) => this._runAndRefresh(() => CharacterTrackerService.removeTrackedActor(target.dataset.actorUuid)),
      clearAll: () => this._runAndRefresh(() => CharacterTrackerService.clearAll()),
      addMasterGlobal: () => this._runAndRefresh(() => this._addMasterGlobalModifier()),
      removeMasterGlobal: (event, target) => this._runAndRefresh(() => MasterNVModifierService.removeGlobalModifier(target.dataset.modifierId)),
      clearMasterGlobal: () => this._runAndRefresh(() => MasterNVModifierService.clearGlobalModifiers()),
      editMasterGlobal: (event, target) => this._runAndRefresh(() => this._editMasterGlobalModifier(target.dataset.modifierId)),
      toggleDetails: () => this._runAndRefresh(() => CharacterTrackerService.toggleDetailMode()),
      addMasterLocalToTracked: () => this._runAndRefresh(() => this._addMasterLocalToTracked()),
      clearMasterLocalFromTracked: () => this._runAndRefresh(() => this._clearMasterLocalFromTracked()),
      removeMasterLocal: (event, target) => this._runAndRefresh(() => this._removeMasterLocalModifier(target.dataset.actorUuid, target.dataset.modifierId)),
      openActorSheet: (event, target) => this._runAndRefresh(() => this._openActorSheet(target.dataset.actorUuid)),
      openNVModifiers: (event, target) => this._runAndRefresh(() => this._openNVModifiers(target.dataset.actorUuid)),
      toggleCondition: (event, target) => this._runAndRefresh(() => this._toggleCondition(target.dataset.actorUuid, target.dataset.conditionId))
    },
    position: {
      width: 360,
      height: "auto"
    },
    window: {
      frame: true,
      positioned: true,
      title: "Rastreador de Personagens",
      icon: "fa-solid fa-users",
      minimizable: true,
      resizable: true,
      contentClasses: ["character-tracker-content"]
    }
  };

  static PARTS = {
    main: {
      template: "systems/naruto2d6world/templates/apps/character-tracker.html"
    }
  };

  constructor(options = {}) {
    super(options);
    this._dragDrop = new foundry.applications.ux.DragDrop({
      dragSelector: ".character-tracker-entry",
      dropSelector: ".character-tracker-entry",
      // Window-frame dragging remains ApplicationV2's responsibility. Internal
      // entry reordering stays disabled; only external Foundry Item drops work.
      permissions: {
        dragstart: () => false,
        drop: () => game.user.isGM
      },
      callbacks: {
        dragstart: this._onEntryDragStart.bind(this),
        drop: this._onEntryDrop.bind(this)
      }
    });
  }

  _canRender(options) {
    if (!game.user.isGM) return false;
    return super._canRender(options);
  }

  async _prepareContext() {
    const actors = await CharacterTrackerService.getTrackedActors();
    const orderedActors = [
      ...actors.filter((actor) => actor.type === "character"),
      ...actors.filter((actor) => actor.type !== "character")
    ];
    return {
      canAdd: game.user.isGM,
      canManage: game.user.isGM,
      detailMode: CharacterTrackerService.detailMode,
      masterGlobalModifiers: MasterNVModifierService.getGlobalModifiers(),
      actors: orderedActors.map((actor) => this._prepareActorContext(actor))
    };
  }

  _prepareActorContext(actor) {
    const system = actor.system;
    const isCharacter = actor.type === "character";
    const customNV = (system.nvModifiers ?? []).reduce((total, modifier) => total + (Number(modifier.value) || 0), 0);
    // `sort` is Foundry's native Item ordering key, maintained when items are
    // rearranged by drag-and-drop on the actor sheet.
    const conditions = actor.items
      .filter((item) => item.type === "condition")
      .sort((left, right) => left.sort - right.sort);
    const activeConditions = conditions.filter((item) => item.system.isActive);
    const activeGlobalConditionNV = activeConditions.reduce((total, condition) => total + (Number(condition.system.globalNV) || 0), 0);
    const baseNV = Number(system.advantageLevel?.actual) || 0;
    const masterNV = isCharacter ? MasterNVModifierService.getTotal(actor) : 0;

    return {
      id: actor.id,
      uuid: actor.uuid,
      name: actor.name,
      img: actor.img,
      isCharacter,
      wounds: system.wounds?.value ?? 0,
      woundsMax: system.wounds?.max ?? 0,
      chakra: system.chakra?.value ?? 0,
      armor: system.armor?.value ?? 0,
      momentum: system.momentum?.actual ?? 0,
      fireWill: system.fireWill?.value ?? 0,
      nv: baseNV + customNV + masterNV + activeGlobalConditionNV,
      baseNV,
      masterLocalModifiers: isCharacter ? MasterNVModifierService.getLocalModifiers(actor) : [],
      conditions: conditions
        .map((condition) => ({
          id: condition.id,
          name: condition.name,
          isActive: Boolean(condition.system.isActive),
          description: this._formatTooltip(condition.system.description) || "Sem descrição."
        })),
      attributeNVs: isCharacter ? this._prepareAttributeNVs(actor, customNV) : [],
      nvModifiers: isCharacter ? [
        ...(system.nvModifiers ?? []).map((modifier) => ({ id: modifier.id, name: modifier.name || "Modificador da ficha", value: Number(modifier.value) || 0, source: "Ficha", canDelete: true, modifierType: "actor" })),
        ...MasterNVModifierService.getGlobalModifiers().map((modifier) => ({ id: modifier.id, name: modifier.name, value: modifier.value, source: "Mestre Global", canDelete: false }))
      ] : []
    };
  }

  /** Mirrors the NV calculation used for moves, including active condition effects per attribute. */
  _prepareAttributeNVs(actor, customNV) {
    const attributeNames = {
      bod: "Físico",
      agl: "Agilidade",
      hrt: "Coração",
      cun: "Astúcia",
      shd: "Sombra"
    };
    const activeConditions = actor.items.filter((item) => item.type === "condition" && item.system.isActive);
    const commonNV = (Number(actor.system.advantageLevel?.actual) || 0)
      + customNV
      + MasterNVModifierService.getTotal(actor)
      + activeConditions.reduce((total, condition) => total + (Number(condition.system.globalNV) || 0), 0);

    return Object.entries(actor.system.attributes ?? {}).map(([key, attribute]) => {
      const conditionNV = activeConditions.reduce((total, condition) => total + (Number(condition.system.attributes?.[key]?.nv) || 0), 0);
      const conditionModifierTotal = activeConditions.reduce((total, condition) => (
        total
        + (Number(condition.system.globalNV) || 0)
        + (Number(condition.system.attributes?.[key]?.nv) || 0)
      ), 0);
      return {
        name: attribute.name || attributeNames[key] || key,
        value: commonNV + conditionNV,
        conditionModifierTotal
      };
    });
  }

  _formatTooltip(value) {
    return String(value ?? "").replace(/"/g, "&quot;").replace(/\r?\n/g, " ").trim();
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._dragDrop.bind(this.element);
    for (const entry of this.element.querySelectorAll(".character-tracker-master-entry")) {
      entry.addEventListener("click", (event) => this._adjustMasterGlobalModifier(event, entry.dataset.modifierId, 1));
      entry.addEventListener("contextmenu", (event) => this._adjustMasterGlobalModifier(event, entry.dataset.modifierId, -1));
    }
    for (const condition of this.element.querySelectorAll(".character-tracker-condition")) {
      condition.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        CharacterTrackerApplication._runAndRefresh(() => CharacterTrackerApplication._removeCondition(
          condition.dataset.actorUuid,
          condition.dataset.conditionId,
          event.shiftKey
        ));
      });
    }
    for (const modifier of this.element.querySelectorAll(".character-tracker-deletable-nv")) {
      modifier.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        CharacterTrackerApplication._runAndRefresh(() => CharacterTrackerApplication._removeNVModifier(
          modifier.dataset.actorUuid,
          modifier.dataset.modifierType,
          modifier.dataset.modifierId,
          event.shiftKey
        ));
      });
    }
  }

  _onEntryDragStart(event) {
    // Reserved for future native internal DragDrop behavior.
  }

  async _onEntryDrop(event) {
    event.preventDefault();
    await CharacterTrackerApplication._runAndRefresh(async () => {
      const target = event.target.closest(".character-tracker-entry");
      const actor = await fromUuid(target?.dataset.actorUuid);
      if (!actor?.isOwner) return;

      const dropData = TextEditor.getDragEventData(event);
      if (dropData.type !== "Item") return;

      const droppedItem = dropData.uuid
        ? await fromUuid(dropData.uuid)
        : await Item.implementation.fromDropData(dropData);
      if (droppedItem?.type !== "condition") return;

      const conditionData = foundry.utils.deepClone(droppedItem.toObject());
      delete conditionData._id;
      await actor.createEmbeddedDocuments("Item", [conditionData]);
    });
  }

  static async _addMasterGlobalModifier() {
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Adicionar NV global do Mestre" },
      content: `<form class="standard-form"><div class="form-group"><label>Nome</label><input name="name" type="text" required autofocus></div><div class="form-group"><label>Valor</label><input name="value" type="number" value="0" step="1" required></div></form>`,
      ok: {
        label: "Adicionar",
        callback: (event, button) => {
          const form = button.form ?? button.closest("form");
          return { name: form.elements.name.value, value: form.elements.value.value };
        }
      }
    });
    if (!result) return;
    try {
      await MasterNVModifierService.addGlobalModifier(result);
    } catch (error) {
      ui.notifications.warn(error.message);
    }
  }

  static async _editMasterGlobalModifier(id) {
    const modifier = MasterNVModifierService.getGlobalModifiers().find((entry) => entry.id === id);
    if (!modifier) return;
    const result = await this._promptMasterGlobalModifier("Editar NV global do Mestre", modifier);
    if (!result) return;
    try {
      await MasterNVModifierService.updateGlobalModifier(id, result);
    } catch (error) {
      ui.notifications.warn(error.message);
    }
  }

  static async _addMasterLocalToTracked() {
    const actors = (await CharacterTrackerService.getTrackedActors()).filter((actor) => actor.type === "character");
    if (!actors.length) return ui.notifications.warn("Adicione personagens ao rastreador antes de aplicar um NV local.");
    const result = await this._promptMasterGlobalModifier("Adicionar NV local do Mestre para o rastreador");
    if (!result) return;
    try {
      await Promise.all(actors.map((actor) => MasterNVModifierService.addLocalModifier(actor, result)));
    } catch (error) {
      ui.notifications.warn(error.message);
    }
  }

  static async _clearMasterLocalFromTracked() {
    const actors = (await CharacterTrackerService.getTrackedActors()).filter((actor) => actor.type === "character");
    if (!actors.length) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Limpar NVs locais do Mestre" },
      content: "<p>Remover todos os modificadores locais do Mestre dos personagens deste rastreador?</p>",
      yes: { label: "Limpar", icon: "fa-solid fa-broom" },
      no: { label: "Cancelar" }
    });
    if (!confirmed) return;
    await Promise.all(actors.map((actor) => MasterNVModifierService.clearLocalModifiers(actor)));
  }

  static async _removeMasterLocalModifier(actorUuid, modifierId) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;
    const modifier = MasterNVModifierService.getLocalModifiers(actor).find((entry) => entry.id === modifierId);
    if (!modifier) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Remover NV local do Mestre" },
      content: `<p>Remover <strong>${foundry.utils.escapeHTML(modifier.name)}</strong> deste personagem?</p>`,
      yes: { label: "Remover", icon: "fa-solid fa-trash" },
      no: { label: "Cancelar" }
    });
    if (confirmed) await MasterNVModifierService.removeLocalModifier(actor, modifierId);
  }

  static async _openActorSheet(actorUuid) {
    const actor = await fromUuid(actorUuid);
    actor?.sheet.render(true);
  }

  static async _openNVModifiers(actorUuid) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;
    const { default: ManageNVModifiersDialog } = await import("../dialogs/manageNVModifiersDialog.mjs");
    ManageNVModifiersDialog.create({ actor });
  }

  static async _toggleCondition(actorUuid, conditionId) {
    const actor = await fromUuid(actorUuid);
    const condition = actor?.items.get(conditionId);
    if (!condition?.isOwner) return;
    await condition.update({ "system.isActive": !condition.system.isActive });
  }

  static async _removeCondition(actorUuid, conditionId, skipConfirmation = false) {
    const actor = await fromUuid(actorUuid);
    const condition = actor?.items.get(conditionId);
    if (!condition?.isOwner) return;

    if (!skipConfirmation) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Remover condição" },
        content: `<p>Deseja remover a condição <strong>${foundry.utils.escapeHTML(condition.name)}</strong>?</p>`,
        yes: { label: "Remover", icon: "fa-solid fa-trash" },
        no: { label: "Cancelar" }
      });
      if (!confirmed) return;
    }

    await condition.delete();
  }

  static async _removeNVModifier(actorUuid, modifierType, modifierId, skipConfirmation = false) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    const modifier = modifierType === "master-local"
      ? MasterNVModifierService.getLocalModifiers(actor).find((entry) => entry.id === modifierId)
      : (actor.system.nvModifiers ?? []).find((entry) => entry.id === modifierId);
    if (!modifier) return;

    if (!skipConfirmation) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Remover modificador de NV" },
        content: `<p>Deseja remover o modificador <strong>${foundry.utils.escapeHTML(modifier.name)}</strong>?</p>`,
        yes: { label: "Remover", icon: "fa-solid fa-trash" },
        no: { label: "Cancelar" }
      });
      if (!confirmed) return;
    }

    if (modifierType === "master-local") {
      await MasterNVModifierService.removeLocalModifier(actor, modifierId);
      return;
    }
    await actor.update({ "system.nvModifiers": (actor.system.nvModifiers ?? []).filter((entry) => entry.id !== modifierId) });
  }

  _adjustMasterGlobalModifier(event, modifierId, direction) {
    if (event.target.closest("button")) return;
    event.preventDefault();
    const amount = direction * (event.shiftKey ? 5 : 1);
    CharacterTrackerApplication._runAndRefresh(() => MasterNVModifierService.adjustGlobalModifier(modifierId, amount));
  }

  static async _runAndRefresh(operation) {
    try {
      return await operation();
    } catch (error) {
      console.error("Erro em operação do rastreador de personagens:", error);
      ui.notifications.warn(error.message ?? "Não foi possível concluir a operação no rastreador.");
    } finally {
      await CharacterTrackerService.refresh();
    }
  }

  static async _promptMasterGlobalModifier(title, modifier = {}) {
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `<form class="standard-form"><div class="form-group"><label>Nome</label><input name="name" type="text" value="${foundry.utils.escapeHTML(modifier.name ?? "")}" required autofocus></div><div class="form-group"><label>Valor</label><input name="value" type="number" value="${Number(modifier.value) || 0}" step="1" required></div></form>`,
      ok: {
        label: modifier.id ? "Salvar" : "Adicionar",
        callback: (event, button) => {
          const form = button.form ?? button.closest("form");
          return { name: form.elements.name.value, value: form.elements.value.value };
        }
      }
    });
  }
}
