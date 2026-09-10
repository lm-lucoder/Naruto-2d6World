import { ChatMessageActorResourceTemplates } from "../chat-message-templates/actor-resource-templates.mjs";

/** Native dialog and update API shared by actor sheets and the character tracker. */
export default class ManageActorResourceDialog {
  static RESOURCES = Object.freeze({
    wounds: {
      label: "Ferimentos",
      path: "system.wounds.value",
      icon: "systems/naruto2d6world/assets/icons/woundIcon.png",
      maxPath: "system.wounds.max",
      specialAction: "regenerate"
    },
    chakra: {
      label: "Chakra",
      path: "system.chakra.value",
      icon: "systems/naruto2d6world/assets/icons/chakraIcon.png",
      maxPath: "system.chakra.max",
      specialAction: "reload"
    },
    pressure: {
      label: "Pressão",
      path: "system.pressure",
      icon: "icons/svg/light.svg",
      maxPath: "system.pressureMax",
      specialAction: "reload"
    },
    armor: {
      label: "Armadura",
      path: "system.armor.value",
      icon: "systems/naruto2d6world/assets/icons/shieldIcon.png",
      maxPath: "system.armor.max"
    },
    momentum: {
      label: "Momentum",
      path: "system.momentum.actual",
      icon: "systems/naruto2d6world/assets/icons/momentumIcon.png"
    },
    fireWill: {
      label: "Vontade do Fogo",
      path: "system.fireWill.value",
      icon: "systems/naruto2d6world/assets/icons/fireWillIcon.png",
      maxPath: "system.fireWill.max",
      specialAction: "reload"
    }
  });

  static async create({ actor, resourceKey }) {
    const resource = this.RESOURCES[resourceKey];
    if (!actor?.isOwner || !resource) return;

    const maximum = this.getMaximum(actor, resource);
    const specialActionLabel = this.getSpecialActionLabel(resource);
    const dialog = new foundry.applications.api.DialogV2({
      classes: ["dialog", "actor-resource-dialog-window"],
      window: { title: "Mudar valor" },
      position: { width: 320 },
      form: { closeOnSubmit: false },
      content: `
        <div class="actor-resource-dialog">
          <div class="actor-resource-dialog-inputs">
            <h3>
              <span>Gerenciando:</span>
              <img class="actor-resource-dialog-icon" src="${foundry.utils.escapeHTML(resource.icon)}" alt="">
            </h3>
            <div class="actor-resource-dialog-section">
              <span class="actor-resource-dialog-label">${foundry.utils.escapeHTML(resource.label)}</span>
              <div class="actor-resource-dialog-value">
                <input name="value" type="number" value="${this.getValue(actor, resource)}" step="1" aria-label="${foundry.utils.escapeHTML(resource.label)}" autofocus>
                ${maximum === null ? "" : `<span>/</span><span>${maximum}</span>`}
              </div>
            </div>
            ${specialActionLabel ? `<div class="actor-resource-dialog-special-actions"><button type="button" data-special-action="${resource.specialAction}">${specialActionLabel}</button></div>` : ""}
          </div>
        </div>
      `,
      buttons: [
        {
          action: "decrease",
          label: "<<",
          callback: (_event, button) => this.adjustDialogInput(button.form, -1)
        },
        {
          action: "apply",
          label: "Alterar",
          icon: "fa-solid fa-check",
          default: true,
          callback: async (_event, button, application) => {
            const value = button.form.elements.value.valueAsNumber;
            if (!Number.isFinite(value)) {
              ui.notifications.warn("Informe um valor numérico válido.");
              return;
            }
            await this.setValue({ actor, resourceKey, value });
            await application.close({ submitted: true });
          }
        },
        {
          action: "increase",
          label: ">>",
          callback: (_event, button) => this.adjustDialogInput(button.form, 1)
        }
      ]
    });
    // DialogV2 only consumes a `render` callback through DialogV2.wait(). This
    // dialog is instantiated directly to keep its arrow buttons open, so bind
    // the native application render event explicitly.
    dialog.addEventListener("render", () => this.activateSpecialAction(dialog, actor, resourceKey));
    return dialog.render({ force: true });
  }

  static adjustDialogInput(form, amount) {
    const input = form.elements.value;
    const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : 0;
    input.value = value + amount;
    input.focus();
    input.select();
  }

  static activateSpecialAction(application, actor, resourceKey) {
    const button = application.element?.querySelector("[data-special-action]");
    if (!button) return;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const changed = await this.applySpecialAction({ actor, resourceKey });
      if (changed) await application.close({ submitted: true });
    });
  }

  static async applySpecialAction({ actor, resourceKey }) {
    const resource = this.RESOURCES[resourceKey];
    if (!actor?.isOwner || !resource?.specialAction) return false;

    const currentValue = this.getValue(actor, resource);
    const targetValue = resource.specialAction === "regenerate"
      ? 0
      : this.getMaximum(actor, resource);
    if (targetValue === null) return false;
    if (currentValue === targetValue) {
      const message = resource.specialAction === "regenerate"
        ? "Os ferimentos já estão regenerados."
        : `${resource.label} já está no máximo.`;
      ui.notifications.info(message);
      return false;
    }

    await this.setValue({ actor, resourceKey, value: targetValue });
    return true;
  }

  static async changeBy({ actor, resourceKey, amount }) {
    const resource = this.RESOURCES[resourceKey];
    if (!actor?.isOwner || !resource) return;
    return this.setValue({ actor, resourceKey, value: this.getValue(actor, resource) + amount });
  }

  static async setValue({ actor, resourceKey, value }) {
    const resource = this.RESOURCES[resourceKey];
    if (!actor?.isOwner || !resource || !Number.isFinite(value)) return;

    const previousValue = this.getValue(actor, resource);
    await actor.update({ [resource.path]: value });
    const currentValue = this.getValue(actor, resource);
    return ChatMessageActorResourceTemplates.createResourceChangedMessage({
      actor,
      resource,
      value: currentValue,
      difference: currentValue - previousValue
    });
  }

  static getValue(actor, resource) {
    const value = Number(foundry.utils.getProperty(actor, resource.path));
    return Number.isFinite(value) ? value : 0;
  }

  static getMaximum(actor, resource) {
    if (!resource.maxPath) return null;
    const value = Number(foundry.utils.getProperty(actor, resource.maxPath));
    return Number.isFinite(value) ? value : 0;
  }

  static getSpecialActionLabel(resource) {
    if (resource.specialAction === "reload") return "Recarregar tudo";
    if (resource.specialAction === "regenerate") return "Regenerar";
    return null;
  }
}
