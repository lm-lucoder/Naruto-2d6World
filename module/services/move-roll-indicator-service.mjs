/**
 * Synchronizes the short-lived "choosing a move roll" state with every GM.
 *
 * The state intentionally lives in memory: it is UI feedback, not world data,
 * and must disappear if the player closes the roll dialog.
 */
export class MoveRollIndicatorService {
  static SOCKET_EVENT = "system.naruto2d6world";

  static #rollingUserIds = new Set();

  static initialize() {
    game.socket.on(this.SOCKET_EVENT, (payload) => {
      if (payload?.type !== "moveRollIndicator") return;
      this.#setRolling(payload.userId, payload.isRolling);
    });

    Hooks.on("renderPlayerList", () => this.render());
    Hooks.on("renderApplication", (app) => {
      if (app.constructor.name === "PlayerList") this.render();
    });
  }

  /** Mark the current user as deciding a move roll. */
  static start() {
    this.#broadcast(true);
  }

  /** Clear the current user's move-roll indicator. Safe to call more than once. */
  static stop() {
    this.#broadcast(false);
  }

  static #broadcast(isRolling) {
    const payload = {
      type: "moveRollIndicator",
      userId: game.user.id,
      isRolling
    };

    // Socket events are not guaranteed to be echoed to the sender.
    this.#setRolling(payload.userId, payload.isRolling);
    game.socket.emit(this.SOCKET_EVENT, payload);
  }

  static #setRolling(userId, isRolling) {
    if (!userId) return;
    if (isRolling) this.#rollingUserIds.add(userId);
    else this.#rollingUserIds.delete(userId);
    this.render();
  }

  /** Insert the indicator only in GM clients, immediately before the player name. */
  static render() {
    if (!game.user?.isGM) return;

    document.querySelectorAll(".players-list .player[data-user-id]").forEach((playerElement) => {
      const indicator = playerElement.querySelector(":scope > .naruto-move-roll-indicator");
      const isRolling = this.#rollingUserIds.has(playerElement.dataset.userId);

      if (!isRolling) {
        indicator?.remove();
        return;
      }

      if (indicator) return;

      const playerName = playerElement.querySelector(":scope > .player-name");
      if (!playerName) return;

      const die = document.createElement("span");
      die.className = "naruto-move-roll-indicator";
      die.setAttribute("aria-label", "Escolhendo rolagem de movimento");
      die.dataset.tooltip = "Escolhendo rolagem de movimento";
      die.innerHTML = '<i class="fa-solid fa-dice-d20" aria-hidden="true"></i>';
      playerName.before(die);
    });
  }
}
