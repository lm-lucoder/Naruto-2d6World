import { MasterNVModifierService } from "../services/master-nv-modifier-service.mjs";
import { NVModifierService } from "../services/nv-modifier-service.mjs";
import { NVModifierFormDialog } from "./nvModifierFormDialog.mjs";

class ManageNVModifiersDialog extends Dialog {
  static SOCKET_EVENT = "system.naruto2d6world";
  static _instance = null;
  static _socketInitialized = false;
  static _nativeRefreshTimers = new Map();
  static _socketRevisions = new Map();

  static initializeSocket() {
    if (this._socketInitialized) return;
    this._socketInitialized = true;
    game.socket.on(this.SOCKET_EVENT, (payload) => {
      if (payload?.type !== "nvModifierDialog:refresh" || payload.sourceUserId === game.user.id) return;
      const dialog = this._instance;
      if (!dialog?.rendered || dialog._actor?.uuid !== payload.actorUuid) return;
      if (Number(payload.revision) < Number(this._socketRevisions.get(payload.actorUuid) ?? 0)) return;

      // Document updates travel on Foundry's own socket too. Rendering from the
      // payload avoids depending on which of the two socket messages arrives first.
      dialog._remoteModifierState = payload.state ?? null;
      this._socketRevisions.set(payload.actorUuid, payload.revision ?? 0);
      dialog.refresh({ focus: false });
    });

    Hooks.on("updateActor", (actor, _changes, _options, userId) => {
      if (userId === game.user.id) return;
      this._refreshFromNativeDocument(actor);
    });
    Hooks.on("updateSetting", (setting) => {
      if (setting.key !== `naruto2d6world.${MasterNVModifierService.GLOBAL_SETTING_KEY}`) return;
      const dialog = this._instance;
      if (!dialog?.rendered) return;
      this._scheduleNativeRefresh(dialog._actor);
    });
  }

  static _refreshFromNativeDocument(actor) {
    const dialog = this._instance;
    if (!dialog?.rendered || dialog._actor?.uuid !== actor?.uuid) return;
    this._scheduleNativeRefresh(actor);
  }

  static _scheduleNativeRefresh(actor) {
    const dialog = this._instance;
    if (!dialog?.rendered || dialog._actor?.uuid !== actor?.uuid) return;
    const key = actor.uuid;
    clearTimeout(this._nativeRefreshTimers.get(key));
    this._nativeRefreshTimers.set(key, setTimeout(() => {
      this._nativeRefreshTimers.delete(key);
      // Foundry has now applied its authoritative document/setting update.
      dialog._remoteModifierState = null;
      this._socketRevisions.delete(key);
      dialog.refresh({ focus: false });
    }, 0));
  }

  static async create({ actor }) {
    const existing = this._instance;
    if (existing) {
      if (existing._actor?.uuid !== actor.uuid) existing._remoteModifierState = null;
      existing._actor = actor;
      existing.refresh();
      return existing;
    }

    const dialog = new this({
      title: `Modificadores de NV — ${actor.name}`,
      content: this._buildContent(actor),
      buttons: {}
    });
    dialog._actor = actor;
    this._instance = dialog;
    dialog.render(true);
    return dialog;
  }

  refresh({ focus = true } = {}) {
    this.data.title = `Modificadores de NV — ${this._actor.name}`;
    this.data.content = this.constructor._buildContent(this._actor, this._remoteModifierState);
    this.render(true, { focus });
    if (focus) this.bringToTop();
    return this;
  }

  async close(options = {}) {
    if (this.constructor._instance === this) this.constructor._instance = null;
    clearTimeout(this.constructor._nativeRefreshTimers.get(this._actor?.uuid));
    this.constructor._nativeRefreshTimers.delete(this._actor?.uuid);
    return super.close(options);
  }

  static notifyChange(actor, { refreshLocal = false } = {}) {
    if (!actor?.uuid) return;
    const dialog = this._instance;
    if (refreshLocal && dialog?.rendered && dialog._actor?.uuid === actor.uuid) {
      dialog.refresh({ focus: false });
    }
    const revision = Date.now();
    game.socket.emit(this.SOCKET_EVENT, {
      type: "nvModifierDialog:refresh",
      sourceUserId: game.user.id,
      actorUuid: actor.uuid,
      revision,
      state: this._buildModifierState(actor)
    });
  }

  static _buildModifierState(actor) {
    return {
      actorNVModifiers: foundry.utils.deepClone(actor.system.nvModifiers ?? []),
      masterGlobalModifiers: foundry.utils.deepClone(MasterNVModifierService.getGlobalModifiers()),
      masterLocalModifiers: foundry.utils.deepClone(MasterNVModifierService.getLocalModifiers(actor))
    };
  }

  _notifyRemoteRefresh() {
    this.constructor.notifyChange(this._actor);
  }

  static _formatValue(value) {
    return `${value > 0 ? "+" : ""}${value} NV`;
  }

  static _escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
  }

  static _buildContent(actor, modifierState = null) {
    const escapeHTML = this._escapeHTML;
    const rows = [
      `<li class="nv-modifier-row fixed"><span>NV base</span><strong>${this._formatValue(actor.system.advantageLevel.actual)}</strong></li>`
    ];

    for (const condition of actor.items.filter((item) => item.type === "condition" && item.system.isActive)) {
      const globalNV = Number(condition.system.globalNV) || 0;
      if (globalNV !== 0) {
        rows.push(`<li class="nv-modifier-row fixed"><span>${escapeHTML(condition.name)} — global</span><strong>${this._formatValue(globalNV)}</strong></li>`);
      }
      for (const attribute of Object.values(condition.system.attributes ?? {})) {
        const attributeNV = Number(attribute.nv) || 0;
        if (attributeNV !== 0) {
          rows.push(`<li class="nv-modifier-row fixed"><span>${escapeHTML(condition.name)} — ${escapeHTML(attribute.name)}</span><strong>${this._formatValue(attributeNV)}</strong></li>`);
        }
      }
    }

    const masterModifiers = [
      ...(modifierState?.masterGlobalModifiers ?? MasterNVModifierService.getGlobalModifiers()).map((modifier) => ({ ...modifier, scope: "Global", label: `Mestre Global — ${modifier.name}` })),
      ...(modifierState?.masterLocalModifiers ?? MasterNVModifierService.getLocalModifiers(actor)).map((modifier) => ({ ...modifier, scope: "Local", label: `Mestre Local — ${modifier.name}` }))
    ];
    for (const modifier of masterModifiers) {
      const canRemoveMasterModifier = game.user.isGM && modifier.scope === "Local";
      const canAdjustMasterModifier = game.user.isGM;
      rows.push(`
        <li class="nv-modifier-row ${canRemoveMasterModifier ? "custom" : "fixed"} ${canAdjustMasterModifier ? "adjustable has-edit" : ""} ${canRemoveMasterModifier ? "has-delete" : ""}" data-modifier-source="master" data-modifier-scope="${modifier.scope}" data-modifier-id="${modifier.id}" data-modifier-index="" data-modifier-value="${modifier.value}" ${canAdjustMasterModifier ? 'data-tooltip="Clique: +1 NV • Shift+clique: +5 NV • Botão direito: -1 NV"' : ""}>
          <span>${escapeHTML(modifier.label)}<small>${escapeHTML(NVModifierService.getAttributeLabel(modifier))}</small><small>${escapeHTML(NVModifierService.getMovementLabel(modifier))}</small></span>
          <strong>${this._formatValue(modifier.value)}</strong>
          ${canAdjustMasterModifier ? `<button type="button" class="edit-nv-modifier" data-tooltip="Editar modificador"><i class="fa-solid fa-pen"></i></button>` : ""}
          ${canRemoveMasterModifier ? `<button type="button" class="remove-master-nv-modifier" data-modifier-id="${modifier.id}"><i class="fa-solid fa-trash"></i></button>` : ""}
        </li>
      `);
    }

    const customModifiers = modifierState?.actorNVModifiers ?? actor.system.nvModifiers ?? [];
    const canAdjustActorModifiers = game.user.isGM || actor.isOwner;
    for (const [index, modifier] of customModifiers.entries()) {
      const value = Number(modifier.value) || 0;
      rows.push(`
        <li class="nv-modifier-row custom ${canAdjustActorModifiers ? "adjustable has-edit" : ""} has-delete" data-modifier-source="actor" data-modifier-id="${modifier.id ?? ""}" data-modifier-index="${index}" data-modifier-value="${value}" ${canAdjustActorModifiers ? 'data-tooltip="Clique: +1 NV • Shift+clique: +5 NV • Botão direito: -1 NV"' : ""}>
          <span>${escapeHTML(modifier.name || "Modificador personalizado")}<small>${escapeHTML(NVModifierService.getAttributeLabel(modifier))}</small><small>${escapeHTML(NVModifierService.getMovementLabel(modifier))}</small></span>
          <strong>${this._formatValue(value)}</strong>
          ${canAdjustActorModifiers ? `<button type="button" class="edit-nv-modifier" data-tooltip="Editar modificador"><i class="fa-solid fa-pen"></i></button>` : ""}
          <button type="button" class="remove-nv-modifier" data-modifier-id="${modifier.id}"><i class="fa-solid fa-trash"></i></button>
        </li>
      `);
    }

    if (rows.length === 1 && customModifiers.length === 0) {
      rows.push('<li class="nv-modifier-empty">Não há condições ou modificadores personalizados ativos.</li>');
    }

    return `
      <div class="manage-nv-modifiers-dialog">
        <button type="button" class="add-nv-modifier">Adicionar novo modificador</button>
        ${game.user.isGM ? '<button type="button" class="add-master-local-nv-modifier">Adicionar novo modificador do mestre</button>' : ""}
        <p class="hint">Clique em um modificador para +1, Shift+clique para +5 e use o botão direito para -1. Condições são apenas para consulta.</p>
        <ul class="nv-modifiers-list">${rows.join("")}</ul>
      </div>
    `;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.add-nv-modifier').on('click', () => this._openAddDialog());
    html.find('.add-master-local-nv-modifier').on('click', () => this._openAddMasterLocalDialog());
    html.find('.remove-nv-modifier').on('click', (event) => this._removeModifier(event.currentTarget.dataset.modifierId));
    html.find('.remove-master-nv-modifier').on('click', (event) => this._removeMasterLocalModifier(event.currentTarget.dataset.modifierId));
    html.on('click', '.edit-nv-modifier', (event) => this._openEditDialog(event.currentTarget.closest('.nv-modifier-row')));
    html.on('click', '.nv-modifier-row.adjustable', (event) => {
      if (event.target.closest('button')) return;
      this._adjustModifier(event.currentTarget, event.shiftKey ? 5 : 1);
    });
    html.on('contextmenu', '.nv-modifier-row.adjustable', (event) => {
      event.preventDefault();
      this._adjustModifier(event.currentTarget, -1);
    });
  }

  async _adjustModifier(row, amount) {
    const { modifierSource, modifierScope, modifierId, modifierIndex } = row.dataset;
    try {
      if (modifierSource === "master") {
        if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode alterar modificadores de NV do Mestre.");
        if (modifierScope === "Global") await MasterNVModifierService.adjustGlobalModifier(modifierId, amount);
        else await MasterNVModifierService.adjustLocalModifier(this._actor, modifierId, amount);
      } else {
        if (!game.user.isGM && !this._actor.isOwner) {
          return ui.notifications.warn("Você não possui permissão para alterar este modificador de NV.");
        }
        const modifiers = (this._actor.system.nvModifiers ?? []).map((modifier, index) => {
          const isTarget = modifier.id === modifierId || index === Number(modifierIndex);
          return isTarget ? { ...modifier, value: (Number(modifier.value) || 0) + amount } : modifier;
        });
        await this._actor.update({ "system.nvModifiers": modifiers });
      }
      const value = (Number(row.dataset.modifierValue) || 0) + amount;
      row.dataset.modifierValue = String(value);
      row.querySelector("strong").textContent = ManageNVModifiersDialog._formatValue(value);
      this._notifyRemoteRefresh();
    } catch (error) {
      ui.notifications.warn(error.message || "Não foi possível alterar o modificador de NV.");
    }
  }

  async _openEditDialog(row) {
    const { modifierSource, modifierScope, modifierId, modifierIndex } = row.dataset;
    const modifiers = modifierSource === "master"
      ? (modifierScope === "Global" ? MasterNVModifierService.getGlobalModifiers() : MasterNVModifierService.getLocalModifiers(this._actor))
      : (this._actor.system.nvModifiers ?? []);
    const modifier = modifiers.find((candidate, index) => (
      candidate.id === modifierId || index === Number(modifierIndex)
    ));
    if (!modifier) return ui.notifications.warn("Modificador de NV não encontrado.");

    const result = await NVModifierFormDialog.prompt({ title: "Editar modificador de NV", modifier, actor: this._actor });
    if (!result) return;
    try {
      if (modifierSource === "master") {
        if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode alterar modificadores de NV do Mestre.");
        if (modifierScope === "Global") await MasterNVModifierService.updateGlobalModifier(modifierId, result);
        else await MasterNVModifierService.updateLocalModifier(this._actor, modifierId, result);
      } else {
        if (!game.user.isGM && !this._actor.isOwner) return ui.notifications.warn("Você não possui permissão para alterar este modificador de NV.");
        const updatedModifiers = (this._actor.system.nvModifiers ?? []).map((candidate, index) => {
          const isTarget = candidate.id === modifierId || index === Number(modifierIndex);
          return isTarget ? { ...candidate, ...result } : candidate;
        });
        await this._actor.update({ "system.nvModifiers": updatedModifiers });
      }
      this.refresh();
      this._notifyRemoteRefresh();
    } catch (error) {
      ui.notifications.warn(error.message || "Não foi possível editar o modificador de NV.");
    }
  }

  async _openAddDialog() {
    const actor = this._actor;
    const result = await NVModifierFormDialog.prompt({ title: "Adicionar modificador de NV", submitLabel: "Adicionar", actor });
    if (!result) return;
    const modifiers = [...(actor.system.nvModifiers ?? []), { id: randomID(), ...result }];
    await actor.update({ "system.nvModifiers": modifiers });
    this.refresh();
    this._notifyRemoteRefresh();
  }

  async _openAddMasterLocalDialog() {
    if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode adicionar modificadores locais de NV.");
    const actor = this._actor;
    const result = await NVModifierFormDialog.prompt({ title: "Adicionar modificador local do Mestre", submitLabel: "Adicionar", actor });
    if (!result) return;
    try {
      await MasterNVModifierService.addLocalModifier(actor, result);
      this.refresh();
      this._notifyRemoteRefresh();
    } catch (error) {
      ui.notifications.warn(error.message);
    }
  }

  async _removeMasterLocalModifier(modifierId) {
    if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode remover modificadores locais de NV.");
    await MasterNVModifierService.removeLocalModifier(this._actor, modifierId);
    this.refresh();
    this._notifyRemoteRefresh();
  }

  async _removeModifier(modifierId) {
    const modifiers = (this._actor.system.nvModifiers ?? []).filter((modifier) => modifier.id !== modifierId);
    await this._actor.update({ "system.nvModifiers": modifiers });
    this.refresh();
    this._notifyRemoteRefresh();
  }
}

export default ManageNVModifiersDialog;
