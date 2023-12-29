/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class BoilerplateItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
    if (this.type === 'skill') {
      this._rankSkill()
    }
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
   getRollData() {
    // If present, return the actor's roll data.
    if ( !this.actor ) return null;
    const rollData = this.actor.getRollData();
    // Grab the item's system data as well.
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? ''
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.item.formula, rollData);
      // If you need to store the value first, uncomment the next line.
      // let result = await roll.roll({async: true});
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }
  async skillRoll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');

    const label = this._getSkillLabelRollTemplate(item)

    
    
    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
      content: item.system.description ?? ''
    });
    
  }
  async abilityRoll() {
    const ability = this;

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const label = this._getAbilityLabelRollTemplate(ability);
    

    ChatMessage.create({
      speaker: speaker,
      flavor: label,
      content: ability.system.description ?? ''
    });
  }
  async moveRoll({mode, attribute}) {
    const item = this;

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = this._getMoveLabelRollTemplate({move: this, mode, attribute});
    
    const rollData = this.getRollData();

    let roll
    if (mode  === "advantage") {
      roll = new Roll(`3d6kh2 + @${attribute}`, rollData);
    }
    if (mode  === "normal") {
      roll = new Roll(`2d6 + @${attribute}`, rollData);
    }
    if (mode  === "disadvantage") {
      roll = new Roll(`3d6kl2 + @${attribute}`, rollData);
    }
    roll.toMessage({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
    });
  }
  async moveRollJustSend() {
    const item = this;

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = this._getMoveLabelRollTemplate({move: this});
    console.log(label)

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
    });
  }

  _rankSkill(){
    let name = ""
    switch (this.system.rank.value) {
      case 0:
        name = "Academia"
        break;
      case 1:
        name = "Genin"
        break;
      case 2:
        name = "Chunin"
        break;
      case 3:
        name = "Jounin Especial"
        break;
      case 4:
        name = "Jounin"
        break;
      case 5:
        name = "Kage"
        break;
      case 6:
        name = "Sennin"
        break;
      default:
        name = "Não definido"
        break;
    }
    this.system.rank.name = name
  }

  _getMoveLabelRollTemplate({move, mode, attribute}){
    let modeText
    switch (mode) {
      case "advantage":
        modeText = "Rolagem com vantagem"
        break;
      case "disadvantage":
        modeText = "Rolagem com desvantagem"
        break;
      case "normal":
        modeText = "Rolagem normal"
        break;
        
        default:
          modeText = undefined
          break;
    }
    let attributeText
    switch (attribute) {
      case "str":
        attributeText = "Força"
        break;
      case "dex":
        attributeText = "Destreza"
        break;
      case "con":
        attributeText = "Constituição"
        break;
      case "int":
        attributeText = "Inteligência"
        break;
      case "per":
        attributeText = "Percepção"
        break;
      case "cha":
        attributeText = "Carisma"
        break;
      default: 
        attributeText = undefined
        break
    }
    const hasImg = move.img != "icons/svg/item-bag.svg"
    console.log(move)
    const label = `
    <div class="moveRollChatTemplate">
      <div class="info">
        ${hasImg ? `<img src="${move.img}" name="${move.name}">` : ""}
        <div class="title">
          <h3>Movimento: ${move.name}</h3>
          ${modeText ? `<i>${modeText}</i>` : ''}
          ${attributeText ? `<i>Atributo escolhido: ${attributeText}</i>` : ''}
        </div>
      </div>
      <div class="description">
        <span class="description-text">
          ${move.system.description}
        </span>
      </div>
    </div>
    `
    return label
  }
  _getSkillLabelRollTemplate(skill){
    let rank = ''
    if(skill.parent){
      rank = `<i>Rank: ${skill.system.rank.name}</i>`
    }
    const label = `
      <div class="skillRollChatTemplate">
        <div class="info">
          <i>Perícia: ${skill.name}</i>
          ${rank}
        </div>
      </div>
    `;

    return label
  }
  _getAbilityLabelRollTemplate(ability){
    const hasImg = ability.img != "icons/svg/item-bag.svg"
    const label = `
    <div class="abilityRollChatTemplate">
      <div class="info">
        ${hasImg ? `<img src="${ability.img}" name="${ability.name}">` : ""}
        <div class="title">
          <h3>Hablidade: ${ability.name}</h3>
          <i>Nível: ${ability.system.level}</i>
        </div>
      </div>
    </div>
    `
    return label
  }
}
