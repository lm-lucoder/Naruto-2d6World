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

    const customModifiers = actor.system.nvModifiers ?? [];
    for (const modifier of customModifiers) {
      const value = Number(modifier.value) || 0;
      rows.push(`
        <li class="nv-modifier-row custom">
          <span>${escapeHTML(modifier.name || "Modificador personalizado")}</span>
          <strong>${this._formatValue(value)}</strong>
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
        <p class="hint">Condições são exibidas para consulta. Apenas modificadores criados aqui podem ser removidos.</p>
        <ul class="nv-modifiers-list">${rows.join("")}</ul>
      </div>
    `;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.add-nv-modifier').on('click', () => this._openAddDialog());
    html.find('.remove-nv-modifier').on('click', (event) => this._removeModifier(event.currentTarget.dataset.modifierId));
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

  async _removeModifier(modifierId) {
    const modifiers = (this._actor.system.nvModifiers ?? []).filter((modifier) => modifier.id !== modifierId);
    await this._actor.update({ "system.nvModifiers": modifiers });
    this.close();
    ManageNVModifiersDialog.create({ actor: this._actor });
  }
}

export default ManageNVModifiersDialog;
