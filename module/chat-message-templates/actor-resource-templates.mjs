/** Chat cards emitted when an actor's core resource changes. */
export class ChatMessageActorResourceTemplates {
  static async createResourceChangedMessage({ actor, resource, value, difference }) {
    const name = actor.token?.name ?? actor.name;
    const image = actor.img || "icons/svg/mystery-man.svg";
    const escapedName = foundry.utils.escapeHTML(name);
    const escapedImage = foundry.utils.escapeHTML(image);
    const escapedIcon = foundry.utils.escapeHTML(resource.icon);
    const numericDifference = Number(difference) || 0;
    const differenceLabel = numericDifference === 0
      ? "0"
      : `${numericDifference < 0 ? "-" : "+"} ${Math.abs(numericDifference)}`;
    const imageTooltip = foundry.utils.escapeHTML(`
      <img class="actor-resource-tooltip-image" src="${escapedImage}" alt="${escapedName}">
    `.trim());

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="actor-resource-change-card">
          <img class="actor-resource-change-portrait" src="${escapedImage}" alt="${escapedName}"
            data-tooltip-html="${imageTooltip}" data-tooltip-class="actor-resource-image-tooltip">
          <div class="actor-resource-change-copy">
            <strong>${escapedName}</strong>
            <span class="actor-resource-change-indicator" data-tooltip="${foundry.utils.escapeHTML(resource.label)}">
              <img src="${escapedIcon}" alt="">
              <strong>${differenceLabel}</strong>
            </span>
            <span>O valor de ${foundry.utils.escapeHTML(resource.label)} foi alterado para ${value}.</span>
          </div>
        </div>
      `
    });
  }
}
