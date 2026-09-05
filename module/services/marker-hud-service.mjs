/** Displays NPC markers in Foundry's right UI column for every connected user. */
export class MarkerHudService {
  static SOCKET_EVENT = "system.naruto2d6world";
  static PANEL_ID = "naruto-marker-hud";

  static #markers = [];
  static #expandedMarkerIds = new Set();
  static #publishTimer = null;

  static initialize() {
    game.socket.on(this.SOCKET_EVENT, (payload) => {
      if (!payload?.type?.startsWith("markerHud:")) return;
      this.#handleSocketMessage(payload);
    });

    Hooks.on("canvasReady", () => this.render());
    Hooks.on("createItem", (item) => this.#handleDocumentChange(item));
    Hooks.on("updateItem", (item) => this.#handleDocumentChange(item));
    Hooks.on("deleteItem", (item) => this.#handleDocumentChange(item));
    Hooks.on("createActor", (actor) => this.#handleActorChange(actor));
    Hooks.on("deleteActor", (actor) => this.#handleActorChange(actor));

    this.render();
    if (game.user.isGM) this.publish();
    else this.requestSnapshot();
  }

  static requestSnapshot() {
    this.#emit("request", {});
  }

  static publish() {
    if (!game.user.isGM) return;
    const markers = game.actors.contents
      .filter((actor) => actor.type === "npc")
      .flatMap((actor) => actor.items
        .filter((item) => item.type === "marker" && item.system.isActive)
        .map((item) => ({
          id: item.uuid,
          name: String(item.name ?? "Marcador"),
          isActive: Boolean(item.system.isActive),
          category: String(item.system.category ?? ""),
          represents: String(item.system.represents ?? ""),
          effect: String(item.system.effect ?? ""),
          pressure: String(item.system.pressure ?? ""),
          broke: String(item.system.broke ?? ""),
          originName: String(actor.name ?? ""),
          originImage: String(actor.img ?? "icons/svg/mystery-man.svg"),
          originUuid: actor.uuid,
          sort: Number(item.sort) || 0
        })))
      .sort((left, right) => (
        left.originName.localeCompare(right.originName) ||
        left.sort - right.sort ||
        left.name.localeCompare(right.name)
      ));

    this.#setMarkers(markers);
    this.#emit("snapshot", { markers });
  }

  static #handleSocketMessage(payload) {
    const action = payload.type.slice("markerHud:".length);
    if (action === "request") {
      if (game.user.isGM) this.#queuePublish();
      return;
    }

    if (action !== "snapshot") return;
    if (!game.users.get(payload.sourceUserId)?.isGM || !Array.isArray(payload.markers)) return;
    this.#setMarkers(payload.markers);
  }

  static #handleDocumentChange(item) {
    if (item.type !== "marker" || item.parent?.type !== "npc") return;
    if (game.user.isGM) this.#queuePublish();
    else this.requestSnapshot();
  }

  static #handleActorChange(actor) {
    if (actor.type !== "npc") return;
    if (game.user.isGM) this.#queuePublish();
    else this.requestSnapshot();
  }

  static #queuePublish() {
    clearTimeout(this.#publishTimer);
    this.#publishTimer = setTimeout(() => this.publish(), 50);
  }

  static #emit(action, data) {
    game.socket.emit(this.SOCKET_EVENT, {
      type: `markerHud:${action}`,
      sourceUserId: game.user.id,
      ...data
    });
  }

  static #setMarkers(markers) {
    this.#markers = markers.filter((marker) => marker.isActive).map((marker) => ({
      id: String(marker.id),
      name: String(marker.name ?? "Marcador"),
      isActive: Boolean(marker.isActive),
      category: String(marker.category ?? ""),
      represents: String(marker.represents ?? ""),
      effect: String(marker.effect ?? ""),
      pressure: String(marker.pressure ?? ""),
      broke: String(marker.broke ?? ""),
      originName: String(marker.originName ?? ""),
      originImage: String(marker.originImage ?? "icons/svg/mystery-man.svg"),
      originUuid: String(marker.originUuid ?? "")
    }));
    this.render();
  }

  static render() {
    const column = document.querySelector("#ui-right-column-1");
    if (!column) return;

    let panel = document.getElementById(this.PANEL_ID);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = this.PANEL_ID;
      panel.className = "naruto-marker-hud flexcol";
      panel.setAttribute("aria-label", "Marcadores de NPC");
      column.append(panel);
    }

    panel.replaceChildren();
    panel.hidden = this.#markers.length === 0;

    for (const marker of this.#markers) {
      const card = document.createElement("article");
      card.className = `naruto-marker-hud-card${marker.isActive ? " active" : ""}`;
      card.dataset.markerId = marker.id;

      const header = document.createElement("div");
      header.className = "naruto-marker-hud-header";

      const expandButton = document.createElement("button");
      expandButton.type = "button";
      expandButton.className = "naruto-marker-hud-expand";
      expandButton.dataset.tooltip = "Expandir/recolher marcador";
      expandButton.setAttribute("aria-label", "Expandir/recolher marcador");

      const name = document.createElement("span");
      name.className = "naruto-marker-hud-name";
      name.textContent = marker.name;

      const origin = document.createElement("button");
      origin.type = "button";
      origin.className = "naruto-marker-hud-origin";
      origin.setAttribute("aria-label", `Abrir ficha de ${marker.originName}`);
      origin.dataset.tooltipDirection = "LEFT";
      const escapedName = foundry.utils.escapeHTML(marker.originName);
      const escapedImage = foundry.utils.escapeHTML(marker.originImage);
      origin.dataset.tooltip = `<div class="naruto-marker-origin-tooltip-content"><img src="${escapedImage}" alt=""><span>${escapedName}</span></div>`;

      const originImage = document.createElement("img");
      originImage.className = "naruto-marker-hud-origin-image";
      originImage.src = marker.originImage;
      originImage.alt = marker.originName;

      origin.append(originImage);
      origin.addEventListener("click", async () => {
        if (!marker.originUuid) return;
        try {
          const actor = await fromUuid(marker.originUuid);
          actor?.sheet?.render(true);
        } catch (_error) {
          // A player without permission simply cannot open the actor sheet.
        }
      });

      const details = document.createElement("div");
      details.className = "naruto-marker-hud-details";
      details.hidden = !this.#expandedMarkerIds.has(marker.id);

      const originText = document.createElement("p");
      originText.className = "naruto-marker-hud-origin-name";
      const originName = document.createElement("strong");
      originName.textContent = marker.originName;
      originText.append(originName);
      details.append(originText);

      details.append(document.createElement("hr"));
      const category = document.createElement("p");
      category.className = "naruto-marker-hud-category";
      category.textContent = `Categoria - ${marker.category || "Sem categoria"}`;
      details.append(category);

      for (const [label, value] of [
        ["Representa", marker.represents],
        ["Efeito", marker.effect],
        ["Pressão", marker.pressure],
        ["Quebrar", marker.broke]
      ]) {
        details.append(document.createElement("hr"));
        const field = document.createElement("p");
        const fieldLabel = document.createElement("strong");
        fieldLabel.textContent = `${label}: `;
        field.append(fieldLabel, document.createTextNode(value));
        details.append(field);
      }

      const setExpanded = (expanded) => {
        details.hidden = !expanded;
        expandButton.setAttribute("aria-expanded", String(expanded));
        expandButton.innerHTML = `<i class="fa-solid fa-chevron-${expanded ? "up" : "down"}" aria-hidden="true"></i>`;
        if (expanded) this.#expandedMarkerIds.add(marker.id);
        else this.#expandedMarkerIds.delete(marker.id);
      };
      setExpanded(!details.hidden);
      expandButton.addEventListener("click", () => setExpanded(details.hidden));

      header.append(expandButton, name, origin);
      card.append(header, details);
      panel.append(card);
    }
  }
}
