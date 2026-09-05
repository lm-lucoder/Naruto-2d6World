import { MasterNVModifierService } from "../services/master-nv-modifier-service.mjs";

class ManageNVModifiersDialog extends Dialog {
  static async create({ actor }) {
    const dialog = new this({
      title: `Modificadores de NV — ${actor.name}`,
      content: this._buildContent(actor),
      buttons: {}
    });
    dialog._actor = actor;
    dialog.render(true);
    return dialog;
  }

  static _formatValue(value) {
    return `${value > 0 ? "+" : ""}${value} NV`;
  }

  static _escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
  }

  static _buildContent(actor) {
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

    for (const modifier of MasterNVModifierService.getModifiers(actor)) {
      const canRemoveMasterModifier = game.user.isGM && modifier.scope === "Local";
      const canAdjustMasterModifier = game.user.isGM;
      rows.push(`
        <li class="nv-modifier-row ${canRemoveMasterModifier ? "custom" : "fixed"} ${canAdjustMasterModifier ? "adjustable has-edit" : ""} ${canRemoveMasterModifier ? "has-delete" : ""}" data-modifier-source="master" data-modifier-scope="${modifier.scope}" data-modifier-id="${modifier.id}" data-modifier-index="" data-modifier-value="${modifier.value}" ${canAdjustMasterModifier ? 'data-tooltip="Clique: +1 NV • Shift+clique: +5 NV • Botão direito: -1 NV"' : ""}>
          <span>${escapeHTML(modifier.label)}</span>
          <strong>${this._formatValue(modifier.value)}</strong>
          ${canAdjustMasterModifier ? `<button type="button" class="edit-nv-modifier" data-tooltip="Editar modificador"><i class="fa-solid fa-pen"></i></button>` : ""}
          ${canRemoveMasterModifier ? `<button type="button" class="remove-master-nv-modifier" data-modifier-id="${modifier.id}"><i class="fa-solid fa-trash"></i></button>` : ""}
        </li>
      `);
    }

    const customModifiers = actor.system.nvModifiers ?? [];
    const canAdjustActorModifiers = game.user.isGM || actor.isOwner;
    for (const [index, modifier] of customModifiers.entries()) {
      const value = Number(modifier.value) || 0;
      rows.push(`
        <li class="nv-modifier-row custom ${canAdjustActorModifiers ? "adjustable has-edit" : ""} has-delete" data-modifier-source="actor" data-modifier-id="${modifier.id ?? ""}" data-modifier-index="${index}" data-modifier-value="${value}" ${canAdjustActorModifiers ? 'data-tooltip="Clique: +1 NV • Shift+clique: +5 NV • Botão direito: -1 NV"' : ""}>
          <span>${escapeHTML(modifier.name || "Modificador personalizado")}</span>
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
    } catch (error) {
      ui.notifications.warn(error.message || "Não foi possível alterar o modificador de NV.");
    }
  }

  _openEditDialog(row) {
    const { modifierSource, modifierScope, modifierId, modifierIndex } = row.dataset;
    const modifiers = modifierSource === "master"
      ? (modifierScope === "Global" ? MasterNVModifierService.getGlobalModifiers() : MasterNVModifierService.getLocalModifiers(this._actor))
      : (this._actor.system.nvModifiers ?? []);
    const modifier = modifiers.find((candidate, index) => (
      candidate.id === modifierId || index === Number(modifierIndex)
    ));
    if (!modifier) return ui.notifications.warn("Modificador de NV não encontrado.");

    new Dialog({
      title: "Editar modificador de NV",
      content: `
        <div class="add-nv-modifier-dialog">
          <div><label>Nome <input type="text" name="name" value="${ManageNVModifiersDialog._escapeHTML(modifier.name)}" required autofocus></label></div>
          <div><label>Valor <input type="number" name="value" value="${Number(modifier.value) || 0}" step="1" required></label></div>
        </div>
      `,
      buttons: {
        save: {
          label: "Salvar",
          callback: async (html) => {
            const name = html.find('[name="name"]').val().trim();
            const value = Number(html.find('[name="value"]').val());
            if (!name || !Number.isFinite(value)) {
              return ui.notifications.warn("Informe um nome e um valor numérico para o modificador.");
            }

            try {
              if (modifierSource === "master") {
                if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode alterar modificadores de NV do Mestre.");
                if (modifierScope === "Global") await MasterNVModifierService.updateGlobalModifier(modifierId, { name, value });
                else await MasterNVModifierService.updateLocalModifier(this._actor, modifierId, { name, value });
              } else {
                if (!game.user.isGM && !this._actor.isOwner) {
                  return ui.notifications.warn("Você não possui permissão para alterar este modificador de NV.");
                }
                const updatedModifiers = (this._actor.system.nvModifiers ?? []).map((candidate, index) => {
                  const isTarget = candidate.id === modifierId || index === Number(modifierIndex);
                  return isTarget ? { ...candidate, name, value } : candidate;
                });
                await this._actor.update({ "system.nvModifiers": updatedModifiers });
              }

              row.dataset.modifierValue = String(value);
              row.querySelector(":scope > span").textContent = modifierSource === "master"
                ? `Mestre ${modifierScope} — ${name}`
                : name;
              row.querySelector("strong").textContent = ManageNVModifiersDialog._formatValue(value);
            } catch (error) {
              ui.notifications.warn(error.message || "Não foi possível editar o modificador de NV.");
            }
          }
        },
        cancel: { label: "Cancelar" }
      },
      default: "save"
    }).render(true);
  }

  _openAddDialog() {
    const actor = this._actor;
    new Dialog({
      title: "Adicionar modificador de NV",
      content: `
        <div class="add-nv-modifier-dialog">
          <div><label>Nome <input type="text" name="name" required autofocus></label></div>
          <div><label>Valor <input type="number" name="value" value="0" step="1" required></label></div>
        </div>
      `,
      buttons: {
        add: {
          label: "Adicionar",
          callback: async (html) => {
            const name = html.find('[name="name"]').val().trim();
            const value = Number(html.find('[name="value"]').val());
            if (!name || !Number.isFinite(value)) {
              return ui.notifications.warn("Informe um nome e um valor numérico para o modificador.");
            }
            const modifiers = [...(actor.system.nvModifiers ?? []), { id: randomID(), name, value }];
            await actor.update({ "system.nvModifiers": modifiers });
            this.close();
            ManageNVModifiersDialog.create({ actor });
          }
        },
        cancel: { label: "Cancelar" }
      },
      default: "add"
    }).render(true);
  }

  _openAddMasterLocalDialog() {
    if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode adicionar modificadores locais de NV.");
    const actor = this._actor;
    new Dialog({
      title: "Adicionar modificador local do Mestre",
      content: `<div class="add-nv-modifier-dialog"><div><label>Nome <input type="text" name="name" required autofocus></label></div><div><label>Valor <input type="number" name="value" value="0" step="1" required></label></div></div>`,
      buttons: {
        add: {
          label: "Adicionar",
          callback: async (html) => {
            try {
              await MasterNVModifierService.addLocalModifier(actor, {
                name: html.find('[name="name"]').val().trim(),
                value: Number(html.find('[name="value"]').val())
              });
              this.close();
              ManageNVModifiersDialog.create({ actor });
            } catch (error) {
              ui.notifications.warn(error.message);
            }
          }
        },
        cancel: { label: "Cancelar" }
      },
      default: "add"
    }).render(true);
  }

  async _removeMasterLocalModifier(modifierId) {
    if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode remover modificadores locais de NV.");
    await MasterNVModifierService.removeLocalModifier(this._actor, modifierId);
    this.close();
    ManageNVModifiersDialog.create({ actor: this._actor });
  }

  async _removeModifier(modifierId) {
    const modifiers = (this._actor.system.nvModifiers ?? []).filter((modifier) => modifier.id !== modifierId);
    await this._actor.update({ "system.nvModifiers": modifiers });
    this.close();
    ManageNVModifiersDialog.create({ actor: this._actor });
  }
}

export default ManageNVModifiersDialog;
