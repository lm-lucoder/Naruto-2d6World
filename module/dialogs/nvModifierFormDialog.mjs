import { NVModifierService } from "../services/nv-modifier-service.mjs";

/** One native form for actor, GM and movement NV modifiers. */
export class NVModifierFormDialog {
  static async prompt({ title, modifier = {}, submitLabel = "Salvar", actor = null, movementNames = null }) {
    const normalized = NVModifierService.normalize(modifier);
    const selected = new Set(normalized.attributes);
    const attributeOptions = NVModifierService.ATTRIBUTES.map(({ ref, name }) => `
      <label class="checkbox nv-modifier-attribute-option">
        <input type="checkbox" name="attributes" value="${ref}" ${selected.has(ref) ? "checked" : ""}>
        ${name}
      </label>
    `).join("");
    const availableMovements = NVModifierService.normalizeMoves(
      movementNames ?? (actor ? NVModifierService.getActorMovementNames(actor) : NVModifierService.getWorldMovementNames())
    ).sort((left, right) => left.localeCompare(right, game.i18n?.lang ?? "pt-BR"));
    const movementOptions = availableMovements.map((name) => (
      `<option value="${foundry.utils.escapeHTML(name)}">${foundry.utils.escapeHTML(name)}</option>`
    )).join("");
    const movementRows = normalized.moves.map((name) => this._buildMovementRowHTML(name)).join("");

    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `
        <div class="standard-form nv-modifier-form">
          <div class="form-group"><label>Nome</label><input name="name" type="text" value="${foundry.utils.escapeHTML(modifier.name ?? "")}" required autofocus></div>
          <div class="form-group"><label>Valor</label><input name="value" type="number" value="${normalized.value}" step="1" required></div>
          <fieldset class="nv-modifier-attribute-fieldset">
            <legend>Atributos</legend>
            <p class="hint">Sem marcação, o modificador vale para todos os atributos.</p>
            <div class="nv-modifier-attribute-options">${attributeOptions}</div>
          </fieldset>
          <fieldset class="nv-modifier-movement-fieldset">
            <legend>Movimentos</legend>
            <p class="hint">Sem movimentos na lista, o modificador vale para todos os movimentos.</p>
            <select class="nv-modifier-movement-select" aria-label="Adicionar movimento">
              <option value="">Selecione um movimento da ficha</option>
              ${movementOptions}
            </select>
            <div class="nv-modifier-movement-drop-zone" data-tooltip="Arraste um movimento para esta região">
              <p class="nv-modifier-movement-drop-hint"><i class="fa-solid fa-arrow-down"></i> Arraste movimentos para cá</p>
              <ol class="nv-modifier-movement-list">${movementRows}</ol>
            </div>
          </fieldset>
        </div>
      `,
      render: (_event, dialog) => this._activateMovementControls(dialog),
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
            attributes: [...form.querySelectorAll('[name="attributes"]:checked')].map((input) => input.value),
            moves: [...form.querySelectorAll(".nv-modifier-movement-row")].map((row) => row.dataset.movementName)
          };
        }
      }
    });
  }

  static _buildMovementRowHTML(name) {
    const escaped = foundry.utils.escapeHTML(name);
    return `
      <li class="nv-modifier-movement-row" data-movement-name="${escaped}">
        <span>${escaped}</span>
        <button type="button" class="nv-modifier-remove-movement" data-tooltip="Remover movimento" aria-label="Remover ${escaped}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </li>
    `;
  }

  static _activateMovementControls(dialog) {
    const root = dialog.element;
    const select = root?.querySelector(".nv-modifier-movement-select");
    const dropZone = root?.querySelector(".nv-modifier-movement-drop-zone");
    const list = root?.querySelector(".nv-modifier-movement-list");
    if (!select || !dropZone || !list) return;

    const updateEmptyState = () => dropZone.classList.toggle("empty", !list.querySelector(".nv-modifier-movement-row"));
    const addMovement = (name) => {
      const normalizedName = String(name ?? "").trim();
      if (!normalizedName) return;
      const exists = [...list.querySelectorAll(".nv-modifier-movement-row")]
        .some((row) => row.dataset.movementName === normalizedName);
      if (exists) return ui.notifications.info(`O movimento ${normalizedName} já está configurado neste modificador.`);

      const wrapper = document.createElement("div");
      wrapper.innerHTML = this._buildMovementRowHTML(normalizedName).trim();
      list.append(wrapper.firstElementChild);
      updateEmptyState();
    };

    select.addEventListener("change", () => {
      addMovement(select.value);
      select.value = "";
    });
    list.addEventListener("click", (event) => {
      const button = event.target.closest(".nv-modifier-remove-movement");
      if (!button) return;
      button.closest(".nv-modifier-movement-row")?.remove();
      updateEmptyState();
    });

    const dragDrop = new foundry.applications.ux.DragDrop({
      dragSelector: null,
      dropSelector: ".nv-modifier-movement-drop-zone",
      permissions: { dragstart: () => false, drop: () => true },
      callbacks: {
        dragenter: () => dropZone.classList.add("drag-over"),
        dragleave: (event) => {
          if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("drag-over");
        },
        drop: async (event) => {
          dropZone.classList.remove("drag-over");
          const data = TextEditor.getDragEventData(event);
          if (data.type !== "Item") return ui.notifications.warn("Apenas movimentos podem ser adicionados a este modificador de NV.");
          const item = await Item.fromDropData(data);
          if (!item || item.type !== "move") return ui.notifications.warn("Apenas movimentos podem ser adicionados a este modificador de NV.");
          addMovement(item.name);
        }
      }
    });
    dragDrop.bind(root);
    dialog._nvModifierMovementDragDrop = dragDrop;
    updateEmptyState();
  }
}
