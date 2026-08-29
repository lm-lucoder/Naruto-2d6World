import { CharacterTrackerService } from "../services/character-tracker-service.mjs";
import { MasterNVModifierService } from "../services/master-nv-modifier-service.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A compact floating tracker window. ApplicationV2 owns its frame dragging,
 * positioning, focus, resize and minimize interactions. DragDrop below is
 * intentionally reserved for future drag-and-drop between tracker entries.
 */
export class CharacterTrackerApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "naruto2d6world-character-tracker",
    tag: "section",
    classes: ["naruto2d6world", "character-tracker"],
    actions: {
      addSelected: () => CharacterTrackerService.addControlledTokens(),
      removeTracked: (event, target) => CharacterTrackerService.removeTrackedActor(target.dataset.actorUuid),
      clearAll: () => CharacterTrackerService.clearAll(),
      addMasterGlobal: () => this._addMasterGlobalModifier(),
      removeMasterGlobal: (event, target) => MasterNVModifierService.removeGlobalModifier(target.dataset.modifierId),
      clearMasterGlobal: () => MasterNVModifierService.clearGlobalModifiers()
    },
    position: {
      width: 260,
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
      dropSelector: ".character-tracker-list",
      // Entry reordering is deliberately not enabled yet. These hooks make
      // future internal drag-and-drop independent from window-frame dragging.
      permissions: {
        dragstart: () => false,
        drop: () => false
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
      masterGlobalModifiers: MasterNVModifierService.getGlobalModifiers(),
      actors: orderedActors.map((actor) => this._prepareActorContext(actor))
    };
  }

  _prepareActorContext(actor) {
    const system = actor.system;
    const isCharacter = actor.type === "character";
    const customNV = (system.nvModifiers ?? []).reduce((total, modifier) => total + (Number(modifier.value) || 0), 0);

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
      nv: (Number(system.advantageLevel?.actual) || 0) + customNV
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._dragDrop.bind(this.element);
  }

  _onEntryDragStart(event) {
    // Reserved for future native internal DragDrop behavior.
  }

  _onEntryDrop(event) {
    // Reserved for future native internal DragDrop behavior.
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
}
