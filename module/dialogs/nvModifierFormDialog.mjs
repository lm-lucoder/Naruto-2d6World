import { NVModifierService } from "../services/nv-modifier-service.mjs";

/** One native form for actor, GM and movement NV modifiers. */
export class NVModifierFormDialog {
  static async prompt({ title, modifier = {}, submitLabel = "Salvar" }) {
    const normalized = NVModifierService.normalize(modifier);
    const selected = new Set(normalized.attributes);
    const options = NVModifierService.ATTRIBUTES.map(({ ref, name }) => `
      <label class="checkbox nv-modifier-attribute-option">
        <input type="checkbox" name="attributes" value="${ref}" ${selected.has(ref) ? "checked" : ""}>
        ${name}
      </label>
    `).join("");

    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `
        <form class="standard-form nv-modifier-form">
          <div class="form-group"><label>Nome</label><input name="name" type="text" value="${foundry.utils.escapeHTML(modifier.name ?? "")}" required autofocus></div>
          <div class="form-group"><label>Valor</label><input name="value" type="number" value="${normalized.value}" step="1" required></div>
          <fieldset class="nv-modifier-attribute-fieldset">
            <legend>Atributos</legend>
            <p class="hint">Sem marcação, o modificador vale para todos os atributos.</p>
            <div class="nv-modifier-attribute-options">${options}</div>
          </fieldset>
        </form>
      `,
      ok: {
        label: submitLabel,
        callback: (_event, button) => {
          const form = button.form;
          const name = form.elements.name.value.trim();
          const value = Number(form.elements.value.value);
          if (!name || !Number.isFinite(value)) {
            ui.notifications.warn("Informe um nome e um valor numérico para o modificador.");
            return false;
          }
          return {
            name,
            value,
            attributes: [...form.querySelectorAll('[name="attributes"]:checked')].map((input) => input.value)
          };
        }
      }
    });
  }
}
