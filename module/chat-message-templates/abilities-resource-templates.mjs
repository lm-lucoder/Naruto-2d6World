/**
 * Classe para templates de mensagens de chat relacionadas ao gerenciamento de recursos de habilidades
 */
export class ChatMessageAbilitiesResourceTemplates {

  static _getChatContent(content) {
    return `
    <div class="abilityRollChatTemplate">
      ${content}
    </div>
    `
  }
  /**
   * Gera o header padrão seguindo a estrutura do abilityRollChatTemplate
   * @param {Item} ability - A habilidade
   * @returns {string} HTML do header
   */
  static _abilityHeader(ability) {
    const hasImg = ability.img != "icons/svg/item-bag.svg";
    return `
      <div class="info">
        ${hasImg ? `<img src="${ability.img}" name="${ability.name}">` : ""}
        <div class="title">
          <h3>${ability.name}</h3>
        </div>
      </div>`;
  }

  /**
   * Cria uma mensagem de chat quando o recurso de uma habilidade é alterado
   * @param {Object} params - Parâmetros da mensagem
   * @param {Actor} params.actor - O ator que está alterando o recurso
   * @param {Item} params.ability - A habilidade cujo recurso está sendo alterado
   * @param {Object} params.resource - O recurso que está sendo alterado
   * @param {number} params.modifierValue - O valor do modificador (positivo ou negativo)
   * @param {number} params.newResourceValue - O novo valor do recurso após a alteração
   * @returns {Promise<ChatMessage>}
   */
  static createResourceChangedMessage({ actor, ability, resource, modifierValue, newResourceValue }) {
    const modifierAbs = Math.abs(modifierValue);
    const speaker = ChatMessage.getSpeaker().alias;
    const header = this._abilityHeader(ability);
    let messageText = "";

    const resourceChangeDisplay = `
    <span class="chat-tag resource-change-display">
      <span class="resource-name">${resource.name}</span>
      <span class="resource-change-value">${modifierValue < 0 ? "-" : "+"} ${modifierAbs}</span>
    </span>
    `;

    if (modifierValue < 0) {
      // Recurso foi reduzido
      messageText = `
      ${resourceChangeDisplay}
      <span class="description-text">${actor.name} consumiu ${modifierAbs} ponto(s) de ${resource.name} da habilidade.</span>
      `;
    } else if (modifierValue > 0) {
      // Recurso foi aumentado
      messageText = `
      ${resourceChangeDisplay}
      <span class="description-text">${actor.name} aumentou ${modifierAbs} ponto(s) de ${resource.name} da habilidade.</span>
      `;
    }

    const content = `${header}<div class="resource-message-content">${messageText}</div>`;

    return ChatMessage.create({
      speaker: speaker,
      content: this._getChatContent(content)
    });
  }

  /**
   * Cria uma mensagem de chat quando o recurso de uma habilidade é recarregado completamente
   * @param {Object} params - Parâmetros da mensagem
   * @param {Actor} params.actor - O ator que está recarregando o recurso
   * @param {Item} params.ability - A habilidade cujo recurso está sendo recarregado
   * @param {Object} params.resource - O recurso que está sendo recarregado
   * @returns {Promise<ChatMessage>}
   */
  static createResourceReloadedMessage({ actor, ability, resource }) {
    const speaker = ChatMessage.getSpeaker().alias;
    const header = this._abilityHeader(ability);
    const messageText = `
    <span class="chat-tag resource-info">${resource.name} foi recarregado</span>
    <span class="description-text">${actor.name} recarregou ${resource.name} para o máximo.</span>
    `;
    const content = `${header}<div class="resource-message-content">${messageText}</div>`;

    return ChatMessage.create({
      speaker: speaker,
      content: this._getChatContent(content)
    });
  }
}

