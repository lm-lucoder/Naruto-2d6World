/**
 * Classe para templates de mensagens de chat relacionadas ao gerenciamento de chakra de habilidades
 */
export class ChatMessageAbilitiesChakraTemplates {

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
   * Cria uma mensagem de chat quando o chakra de uma habilidade é alterado
   * @param {Object} params - Parâmetros da mensagem
   * @param {Actor} params.actor - O ator que está alterando o chakra
   * @param {Item} params.ability - A habilidade cujo chakra está sendo alterado
   * @param {number} params.modifierValue - O valor do modificador (positivo ou negativo)
   * @param {number} params.newChakraValue - O novo valor de chakra após a alteração
   * @returns {Promise<ChatMessage>}
   */
  static createChakraChangedMessage({ actor, ability, modifierValue, newChakraValue }) {
    const modifierAbs = Math.abs(modifierValue);
    const speaker = ChatMessage.getSpeaker().alias;
    const header = this._abilityHeader(ability);
    let messageText = "";

    const chakraChangeDisplay = `
    <span class="chat-tag resource-change-display">
      <img src="systems/naruto2d6world/assets/icons/chakraIcon.png" name="CP">
      <span class="chakra-change-value">${modifierValue < 0 ? "-" : "+"} ${modifierAbs}</span>
    </span>
    `;

    if (modifierValue < 0) {
      // Chakra foi reduzido'
      messageText = `
      ${chakraChangeDisplay}
      <span class="description-text">${actor.name} <strong>consumiu ${modifierAbs} ponto(s) de chakra</strong> da habilidade.</span>
      `;
    } else if (modifierValue > 0) {
      // Chakra foi aumentado
      messageText = `
      ${chakraChangeDisplay}
      <span class="description-text">${actor.name} <strong>aumentou ${modifierAbs} ponto(s) de chakra</strong> na habilidade.</span>
      `;
    }

    const content = `${header}<div class="resource-message-content">${messageText}</div>`;

    return ChatMessage.create({
      speaker: speaker,
      flavor: `${actor.name} CP: ${actor.system.chakra.value}/${actor.system.chakra.max}`,
      content: this._getChatContent(content)
    });
  }

  /**
   * Cria uma mensagem de chat quando o chakra de uma habilidade é recarregado completamente
   * @param {Object} params - Parâmetros da mensagem
   * @param {Actor} params.actor - O ator que está recarregando o chakra
   * @param {Item} params.ability - A habilidade cujo chakra está sendo recarregado
   * @returns {Promise<ChatMessage>}
   */
  static createChakraReloadedMessage({ actor, ability }) {
    const speaker = ChatMessage.getSpeaker().alias;
    const header = this._abilityHeader(ability);
    const messageText = `
    <span class="chat-tag chakra-info">1 ponto de chakra foi utilizado</span>
    <span class="description-text">${actor.name} Recarregou a habilidade.</span>
    `;
    const content = `${header}<div class="resource-message-content">${messageText}</div>`;

    return ChatMessage.create({
      speaker: speaker,
      flavor: `${actor.name} CP: ${actor.system.chakra.value}/${actor.system.chakra.max}`,
      content: this._getChatContent(content)
    });
  }
}

