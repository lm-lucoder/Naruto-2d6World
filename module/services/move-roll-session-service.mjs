/**
 * Coordinates shared move-roll dialogs through Foundry's system socket.
 * Sessions are intentionally ephemeral and never written to world data.
 */
export class MoveRollSessionService {
  static SOCKET_EVENT = "system.naruto2d6world";

  static #sessions = new Map();
  static #dialogs = new Map();
  static #dialogFactory = null;

  static initialize({ dialogFactory }) {
    this.#dialogFactory = dialogFactory;

    game.socket.on(this.SOCKET_EVENT, (payload) => {
      if (!payload?.type?.startsWith("moveRollSession:")) return;
      this.#handleMessage(payload);
    });

    Hooks.on("renderPlayerList", () => this.renderIndicators());
    Hooks.on("renderApplication", (app) => {
      if (app.constructor.name === "PlayerList") this.renderIndicators();
    });
    Hooks.on("updateUser", (user, changes) => {
      if (changes.active !== false) return;
      const session = this.#sessions.get(user.id);
      if (session) this.#removeSession(session.id, session.userId);
    });

    // Lets a GM who has just connected discover dialogs already open for players.
    this.#emit("syncRequest", {});
  }

  static start(item, initialState) {
    const previousSession = this.#sessions.get(game.user.id);
    if (previousSession) this.#removeSession(previousSession.id, previousSession.userId);

    const session = {
      id: randomID(),
      userId: game.user.id,
      itemUuid: item.uuid,
      state: this.#cloneState(initialState)
    };

    this.#sessions.set(session.userId, session);
    this.#emit("start", { session });
    this.renderIndicators();
    return session;
  }

  static registerDialog(sessionId, dialog) {
    this.#dialogs.set(sessionId, dialog);
  }

  static unregisterDialog(sessionId, dialog) {
    if (this.#dialogs.get(sessionId) === dialog) this.#dialogs.delete(sessionId);
  }

  static update(sessionId, state) {
    const session = this.#findSession(sessionId);
    if (!session) return;

    session.state = this.#cloneState(state);
    this.#emit("update", { sessionId, state: session.state });
  }

  /** Ask the owning player's client to execute the roll with this exact state. */
  static requestRoll(sessionId, state) {
    const session = this.#findSession(sessionId);
    if (!session) return;

    session.state = this.#cloneState(state);
    this.#emit("forceRoll", { sessionId, state: session.state });
  }

  static end(sessionId) {
    const session = this.#findSession(sessionId);
    if (!session) return;

    this.#emit("end", { sessionId, userId: session.userId });
    this.#removeSession(sessionId, session.userId);
  }

  static async openForUser(userId) {
    if (!game.user.isGM) return;

    const session = this.#sessions.get(userId);
    if (!session) return ui.notifications.info("Esse jogador não está escolhendo uma rolagem de movimento.");

    const existingDialog = this.#dialogs.get(session.id);
    if (existingDialog) {
      existingDialog.bringToTop?.();
      return;
    }

    const item = await fromUuid(session.itemUuid);
    if (!item) return ui.notifications.warn("O movimento do jogador não está mais disponível.");

    Promise.resolve(this.#dialogFactory?.(item, { session, isRemote: true }))
      .catch((error) => {
        console.error("Naruto 2d6 World | Não foi possível abrir o diálogo remoto de movimento.", error);
        ui.notifications.error("Não foi possível abrir o diálogo de movimento do jogador.");
      });
  }

  static #emit(action, data) {
    game.socket.emit(this.SOCKET_EVENT, {
      type: `moveRollSession:${action}`,
      sourceUserId: game.user.id,
      ...data
    });
  }

  static #handleMessage(payload) {
    const action = payload.type.slice("moveRollSession:".length);
    const sourceUser = game.users.get(payload.sourceUserId);

    if (action === "syncRequest") {
      const ownSession = this.#sessions.get(game.user.id);
      if (ownSession?.userId === game.user.id) this.#emit("start", { session: ownSession });
      return;
    }

    if (action === "start") {
      const session = payload.session;
      if (!session?.id || !session?.userId || !session?.itemUuid) return;
      if (payload.sourceUserId !== session.userId) return;
      const previousSession = this.#sessions.get(session.userId);
      if (previousSession && previousSession.id !== session.id) {
        this.#removeSession(previousSession.id, previousSession.userId);
      }
      this.#sessions.set(session.userId, {
        ...session,
        state: this.#cloneState(session.state)
      });
      this.renderIndicators();
      return;
    }

    const session = this.#findSession(payload.sessionId);
    if (!session) return;
    const isOwner = payload.sourceUserId === session.userId;
    const isGM = Boolean(sourceUser?.isGM);
    if (!isOwner && !isGM) return;

    if (action === "update") {
      session.state = this.#cloneState(payload.state);
      if (payload.sourceUserId !== game.user.id) {
        this.#dialogs.get(session.id)?.applySessionState(session.state);
      }
      return;
    }

    if (action === "forceRoll") {
      if (!isGM) return;
      session.state = this.#cloneState(payload.state);
      if (session.userId === game.user.id && payload.sourceUserId !== game.user.id) {
        Promise.resolve(this.#dialogs.get(session.id)?.rollFromSession(session.state))
          .catch((error) => {
            console.error("Naruto 2d6 World | A rolagem remota falhou.", error);
            ui.notifications.error("Não foi possível concluir a rolagem solicitada pelo Mestre.");
          });
      }
      return;
    }

    if (action === "end") this.#removeSession(session.id, session.userId);
  }

  static #removeSession(sessionId, userId) {
    const dialog = this.#dialogs.get(sessionId);
    this.#dialogs.delete(sessionId);
    this.#sessions.delete(userId);
    dialog?.closeFromSession();
    this.renderIndicators();
  }

  static #findSession(sessionId) {
    return [...this.#sessions.values()].find((session) => session.id === sessionId);
  }

  static #cloneState(state = {}) {
    return {
      selectedAttribute: state.selectedAttribute ?? null,
      rollModifier: state.rollModifier ?? "",
      manualAdjustment: Number(state.manualAdjustment) || 0,
      disabledModifierIds: [...(state.disabledModifierIds ?? [])],
      entryValues: { ...(state.entryValues ?? {}) }
    };
  }

  /** Insert a clickable d20 only in GM clients, immediately before the player name. */
  static renderIndicators() {
    if (!game.user?.isGM) return;

    document.querySelectorAll(".players-list .player[data-user-id]").forEach((playerElement) => {
      const existing = playerElement.querySelector(":scope > .naruto-move-roll-indicator");
      const session = this.#sessions.get(playerElement.dataset.userId);

      if (!session) {
        existing?.remove();
        return;
      }

      if (existing) return;
      const playerName = playerElement.querySelector(":scope > .player-name");
      if (!playerName) return;

      const die = document.createElement("button");
      die.type = "button";
      die.className = "naruto-move-roll-indicator";
      die.setAttribute("aria-label", "Abrir rolagem de movimento");
      die.dataset.tooltip = "Abrir rolagem de movimento";
      die.innerHTML = '<i class="fa-solid fa-dice-d20" aria-hidden="true"></i>';
      die.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openForUser(playerElement.dataset.userId);
      });
      playerName.before(die);
    });
  }
}
