/** Chat cards emitted when an actor declares or removes initiative. */
export class ChatMessageInitiativeTemplates {
  static async createInitiativeChangedMessage({ actor, hasInitiative }) {
    const name = actor.token?.name ?? actor.name;
    const image = actor.img || "icons/svg/mystery-man.svg";
    const escapedName = foundry.utils.escapeHTML(name);
    const escapedImage = foundry.utils.escapeHTML(image);
    const imageTooltip = foundry.utils.escapeHTML(`
      <img class="initiative-tooltip-image" src="${escapedImage}" alt="${escapedName}">
    `.trim());
    const status = hasInitiative ? "Possui a iniciativa!" : "Sem iniciativa!";

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="initiative-change-card ${hasInitiative ? "has-initiative" : "without-initiative"}">
          <img class="initiative-change-portrait" src="${escapedImage}" alt="${escapedName}"
            data-tooltip-html="${imageTooltip}" data-tooltip-class="initiative-image-tooltip">
          <div class="initiative-change-copy">
            <span class="initiative-status">${status}</span>
          </div>
        </div>
      `
    });
  }
}
