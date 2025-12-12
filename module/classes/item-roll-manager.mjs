/**
 * Classe para gerenciar rolagens de itens
 */
export class ItemRollManager {
  /**
   * Apply advantage level (NV) modifications to challenge dice
   * @param {number} advantageLevel - The advantage level (NV) to apply
   * @param {number} challengeDiceOne - First challenge die result
   * @param {number} challengeDiceTwo - Second challenge die result
   * @returns {Object} Modified challenge dice results
   */
  static applyAdvantageLevelToChallengeDice(advantageLevel, challengeDiceOne, challengeDiceTwo) {
    let diceOne = challengeDiceOne;
    let diceTwo = challengeDiceTwo;
    let remainingPoints = Math.abs(advantageLevel);

    if (advantageLevel === 0) {
      return { diceOne, diceTwo };
    }

    if (advantageLevel > 0) {
      // NV positivo: reduzir o maior dado até 0, depois o outro
      while (remainingPoints > 0) {
        const highest = Math.max(diceOne, diceTwo);
        const lowest = Math.min(diceOne, diceTwo);

        if (highest <= 0 && lowest <= 0) {
          // Ambos já estão no mínimo, ignorar pontos restantes
          break;
        }

        if (highest > 0) {
          const reduction = Math.min(remainingPoints, highest);
          if (diceOne === highest) {
            diceOne = Math.max(0, diceOne - reduction);
          } else {
            diceTwo = Math.max(0, diceTwo - reduction);
          }
          remainingPoints -= reduction;
        } else if (lowest > 0) {
          // Se o maior já está em 0, reduzir o menor
          const reduction = Math.min(remainingPoints, lowest);
          if (diceOne === lowest) {
            diceOne = Math.max(0, diceOne - reduction);
          } else {
            diceTwo = Math.max(0, diceTwo - reduction);
          }
          remainingPoints -= reduction;
        }
      }
    } else {
      // NV negativo: aumentar o menor dado até 10, depois o outro
      while (remainingPoints > 0) {
        const highest = Math.max(diceOne, diceTwo);
        const lowest = Math.min(diceOne, diceTwo);

        if (highest >= 10 && lowest >= 10) {
          // Ambos já estão no máximo, ignorar pontos restantes
          break;
        }

        if (lowest < 10) {
          const increase = Math.min(remainingPoints, 10 - lowest);
          if (diceOne === lowest) {
            diceOne = Math.min(10, diceOne + increase);
          } else {
            diceTwo = Math.min(10, diceTwo + increase);
          }
          remainingPoints -= increase;
        } else if (highest < 10) {
          // Se o menor já está em 10, aumentar o maior
          const increase = Math.min(remainingPoints, 10 - highest);
          if (diceOne === highest) {
            diceOne = Math.min(10, diceOne + increase);
          } else {
            diceTwo = Math.min(10, diceTwo + increase);
          }
          remainingPoints -= increase;
        }
      }
    }

    return { diceOne, diceTwo };
  }

  /**
   * Handle clickable rolls.
   * @param {Item} item - The item to roll
   */
  static async roll(item) {
    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: item.actor });
    const rollMode = game.settings.get("core", "rollMode");
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!item.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? "",
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = item.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.item.formula, rollData);
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }

  /**
   * Roll a skill
   * @param {Item} item - The skill item to roll
   */
  static async skillRoll(item) {
    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: item.actor });
    const rollMode = game.settings.get("core", "rollMode");

    const label = ItemRollManager.getSkillLabelRollTemplate(item);

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
      content: item.system.description ?? "",
    });
  }

  /**
   * Roll an ability
   * @param {Item} item - The ability item to roll
   */
  static async abilityRoll(item) {
    const speaker = ChatMessage.getSpeaker({ actor: item.actor });
    const label = ItemRollManager.getAbilityLabelRollTemplate(item);

    ChatMessage.create({
      speaker: speaker,
      flavor: label,
      content: item.system.description ?? "",
    });
  }

  /**
   * Roll a move with full mechanics
   * @param {Item} item - The move item to roll
   * @param {Object} params - Roll parameters
   */
  static async moveRoll(item, params) {
    const { advantageLevel, attribute, rollModifier, isUpdate, oldMessage, rerollMode, oldMessageRolls, newModifiers, originalChallengeDiceOne: preservedOriginalOne, originalChallengeDiceTwo: preservedOriginalTwo } = params;

    if (isUpdate && rerollMode == "adjustment") {
      const label = ItemRollManager.getMoveLabelRollTemplate({
        move: item,
        advantageLevel,
        attribute,
        rollModifier,
        actionDiceRoll: oldMessageRolls.actionDiceResult,
        challengeDiceOneRoll: oldMessageRolls.challengeDiceOneResult,
        challengeDiceTwoRoll: oldMessageRolls.challengeDiceTwoResult,
        originalChallengeDiceOne: preservedOriginalOne, // Preservar valor original da mensagem anterior
        originalChallengeDiceTwo: preservedOriginalTwo, // Preservar valor original da mensagem anterior
        newModifiers
      });
      await oldMessage.update({
        flavor: label,
      })
      return
    }

    //Lidar com a existência de configurações específicas para este movimento, vinda de condições
    let attributeModifier = 0;
    let attributeNV = 0; // NV adicional do atributo das condições
    const parentConditions = item.parent.items.filter(
      (conditionItem) => conditionItem.type === "condition"
    );
    const activeConditions = parentConditions.filter(
      (condition) => condition.system.isActive
    );
    for (const activeCondition of activeConditions) {
      // Coletar NV global (aplica a todos os atributos)
      const globalNV = parseInt(activeCondition.system?.globalNV) || 0;
      if (globalNV !== 0) {
        attributeNV += globalNV;
      }

      // Coletar modificadores de atributo específicos
      const nvValue = activeCondition.system?.attributes?.[attribute]?.nv;
      if (nvValue !== undefined && nvValue !== null) {
        attributeNV += parseInt(nvValue) || 0;
      }

      // Coletar modificadores específicos de movimento
      if (activeCondition.system?.movesConfigs) {
        Object.values(activeCondition.system.movesConfigs).forEach(
          (moveConfig) => {
            if (moveConfig.moveName === item.name) {
              attributeModifier +=
                moveConfig.attributes[attribute].value;
            }
          }
        );
      }
    }

    const rollData = item.getRollData();
    const actor = item.actor

    const actionDiceRoll = new Roll(
      `1d6 + @${attribute} ${attributeModifier ? "+" + attributeModifier : ""} ${rollModifier ? "+" + rollModifier : ""}`
        .trim().replaceAll("\n", ""),
      rollData
    );

    // Sempre rolar 1d10 para ambos os dados de desafio
    let challengeDiceOneRoll = new Roll("1d10");
    let challengeDiceTwoRoll = new Roll("1d10");

    if ((rerollMode == "momentum")) {
      const momentumValue = actor.system.momentum.actual
      if (momentumValue >= oldMessageRolls.challengeDiceOneResult) {
        challengeDiceOneRoll._total = 0
      } else {
        challengeDiceOneRoll._total = oldMessageRolls.challengeDiceOneResult
      }
      if (momentumValue >= oldMessageRolls.challengeDiceTwoResult) {
        challengeDiceTwoRoll._total = 0
      } else {
        challengeDiceTwoRoll._total = oldMessageRolls.challengeDiceTwoResult
      }
      actionDiceRoll._total = oldMessageRolls.actionDiceResult

    } else {
      await actionDiceRoll.evaluate({ async: true })
      await challengeDiceOneRoll.evaluate({ async: true })
      await challengeDiceTwoRoll.evaluate({ async: true })
    }

    // Armazenar valores originais antes de aplicar NV
    const originalChallengeDiceOne = challengeDiceOneRoll.total;
    const originalChallengeDiceTwo = challengeDiceTwoRoll.total;

    // Aplicar modificações de NV aos dados de desafio
    // Somar o NV base com o NV adicional do atributo das condições
    const nvValue = (advantageLevel || 0) + attributeNV;
    const modifiedDice = ItemRollManager.applyAdvantageLevelToChallengeDice(
      nvValue,
      originalChallengeDiceOne,
      originalChallengeDiceTwo
    );

    // Atualizar os totais dos dados de desafio
    challengeDiceOneRoll._total = modifiedDice.diceOne;
    challengeDiceTwoRoll._total = modifiedDice.diceTwo;

    const label = ItemRollManager.getMoveLabelRollTemplate({
      move: item,
      advantageLevel: nvValue,
      attribute,
      rollModifier,
      actionDiceRoll: actionDiceRoll.total,
      challengeDiceOneRoll: challengeDiceOneRoll.total,
      challengeDiceTwoRoll: challengeDiceTwoRoll.total,
      originalChallengeDiceOne,
      originalChallengeDiceTwo,
      rerollMode
    });

    // Criar conteúdo do card
    // Criar uma lista de rolagens para manter interatividade
    const rolls = [actionDiceRoll, challengeDiceOneRoll, challengeDiceTwoRoll];
    const renderedRolls = await Promise.all(rolls.map(roll => roll.render()));

    // Criar a mensagem no chat com rolagens interativas
    if (isUpdate) {
      if (rerollMode == "momentum") {
        await oldMessage.update({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker(),
          flavor: label,
          rolls: rolls,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
          content: `<h4 style="font-size: 16px;color:rgb(65, 65, 65);text-align: center;margin-top: 5px; font-weight: bold;">Momentum queimado!</h4>`
        })

        actor.resetMomentum();

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker(),
          content: `<i>${actor.name} queimou o momentum!</i>`
        })
      } else if (rerollMode == "fireWill") {
        if (actor.system.fireWill.value >= 1) {
          await oldMessage.update({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            flavor: label,
            rolls: rolls,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            content: `
							<details class="move-card-roll-details">
								<summary style="font-size: 12px;color: #807f7b;text-align: center;margin-top: 5px;"><i>Detalhes da Rolagem</i></summary>
								<blockquote>${renderedRolls.join('')}</blockquote>
							</details>
						`
          })
          actor.update({ 'system.fireWill.value': actor.system.fireWill.value - 1 })
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker(),
            content: `<i>${actor.name} refez uma rolagem utilizando a vontade do fogo!</i>`
          })
        } else {
          ui.notifications.info("Você não possui pontos de vontade do fogo disponíveis!")
        }

      } else if (rerollMode == "free") {
        await oldMessage.update({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker(),
          flavor: label,
          rolls: rolls,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
          content: `
						<details class="move-card-roll-details">
							<summary style="font-size: 12px;color: #807f7b;text-align: center;margin-top: 5px;"><i>Detalhes da Rolagem</i></summary>
							<blockquote>${renderedRolls.join('')}</blockquote>
						</details>
					`
        })
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker(),
          content: `<i>${actor.name} refez uma rolagem de forma livre!</i>`
        })
      }
    } else {
      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker(),
        flavor: label,
        rolls: rolls,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        content: `
					<details class="move-card-roll-details">
						<summary style="font-size: 12px;color: #807f7b;text-align: center;margin-top: 5px;"><i>Detalhes da Rolagem</i></summary>
						<blockquote>${renderedRolls.join('')}</blockquote>
					</details>
				`
      });
    }
  }

  /**
   * Send a move to chat without rolling
   * @param {Item} item - The move item
   */
  static async moveRollJustSend(item) {
    const speaker = ChatMessage.getSpeaker({ actor: item.actor });
    const rollMode = game.settings.get("core", "rollMode");
    const label = `<div class="rollCard">
				<h3 class="rollcard-title">Movimento: ${item.name}</h3>
				<div class="rollcard-content">
					${item.system.description}
				</div>
			</div>`.trim()

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
    });
  }

  /**
   * Roll an NPC move
   * @param {Item} item - The NPC move item
   */
  static async moveRollNPC(item) {
    const speaker = ChatMessage.getSpeaker({ actor: item.actor });
    const rollMode = game.settings.get("core", "rollMode");

    let MoveAttributesMessage = ""
    let canUpdateChakra = false
    let newChakraAmount = 0
    let canUpdateUses = false

    //Handle Chakra consumption for this movement
    if (item.system.npcMoveConsumesNPCChakraOnUse.on) {

      if (item.actor.system.chakra.value < item.system.npcMoveConsumesNPCChakraOnUse.value) {
        return ui.notifications.info("Você não possui chakra suficiente para realizar este movimento!");
      }

      newChakraAmount = item.actor.system.chakra.value - item.system.npcMoveConsumesNPCChakraOnUse.value;
      canUpdateChakra = true
      MoveAttributesMessage += `<p class="chat-tag chakra-info"><strong >${item.system.npcMoveConsumesNPCChakraOnUse.value} pontos de chakra foram utilizados</strong></p>`;
    }

    //Handle NPC Levels on this movement
    if (item.system.npcMoveLevel.on) {
      MoveAttributesMessage += `<p class="chat-tag"><strong>Nível do Movimento:</strong> ${item.system.npcMoveLevel.value}</p>`;
    }

    //Handle NPC Uses for this movement
    if (item.system.npcUses.on) {
      if (item.system.npcUses.min <= 0) {
        return ui.notifications.info("Você não possui mais cargas disponíveis para este movimento!");
      }

      //Handle the reduction of uses when sending to chat
      if (item.system.npcUses.consumesOnChatSending) {
        canUpdateUses = true
      }
    }

    //Handle update of charges
    if (canUpdateChakra) {
      item.actor.update({ "system.chakra.value": newChakraAmount });
    }
    if (canUpdateUses) {
      await item.update({ "system.npcUses.min": item.system.npcUses.min - 1 })
      MoveAttributesMessage += `<p class="chat-tag"><strong>Cargas Restantes:</strong> ${item.system.npcUses.min} / ${item.system.npcUses.max}</p>`;
    }

    let treatedDescription = ""

    if (item.system.moveDescription) {
      treatedDescription = item.system.moveDescription

      const regex = /\[\[(.*?)\]\]/g;
      const operations = [...treatedDescription.matchAll(regex)]
      if (operations.length > 0) {
        for (const operation of operations) {
          const string = operation[0];
          const expression = operation[1];
          let result = ""
          try {
            result = new Function('return ' + expression)()
          } catch (error) {
            result = "Error in expression"
          }
          treatedDescription = treatedDescription.replace(string, result)
        }
      };
    }

    const label = `<div class="rollCard">
			<h3 class="rollcard-title">Movimento: ${item.name}</h3>
			<p class="rollcard-category">
				<i>Categoria: ${item.system.category.replace("NPC - ", "")}</i>
			</p>
			<div class="rollcard-content">
				${MoveAttributesMessage}
				${treatedDescription || ""}
			</div>
    </div>`.trim()

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
    });
  }

  /**
   * Get the move label roll template
   * @param {Object} params - Template parameters
   * @returns {string} HTML template string
   */
  static getMoveLabelRollTemplate({ move, advantageLevel, attribute, rollModifier, actionDiceRoll, challengeDiceOneRoll, challengeDiceTwoRoll, originalChallengeDiceOne, originalChallengeDiceTwo, newModifiers }) {
    let successCount = 0
    let match = false
    let resultType = ""

    //modifiers in case of manual adjustment after rolls
    let actualActionDiceRoll = +actionDiceRoll
    let actualChallengeDiceOneRoll = +challengeDiceOneRoll
    let actualChallengeDiceTwoRoll = +challengeDiceTwoRoll
    if (newModifiers) {
      actualActionDiceRoll = +actionDiceRoll + (newModifiers.actionDiceModifier ? parseInt(newModifiers.actionDiceModifier) : 0)
      actualChallengeDiceOneRoll = +challengeDiceOneRoll + (newModifiers.challengeDiceAModifier ? parseInt(newModifiers.challengeDiceAModifier) : 0)
      actualChallengeDiceTwoRoll = +challengeDiceTwoRoll + (newModifiers.challengeDiceBModifier ? parseInt(newModifiers.challengeDiceBModifier) : 0)
    }

    if (actualActionDiceRoll > actualChallengeDiceOneRoll) successCount++;
    if (actualActionDiceRoll > actualChallengeDiceTwoRoll) successCount++;
    if (actualChallengeDiceOneRoll == actualChallengeDiceTwoRoll) match == true

    let message = "";
    if (match && actualActionDiceRoll > actualChallengeDiceOneRoll) {
      message = "Sucesso Crítico!!!"
      resultType = "strong"
    } else if (match && actualActionDiceRoll <= actualChallengeDiceOneRoll) {
      message = "Falha Crítica!!!"
      resultType = "miss"
    } else if (successCount === 2) {
      message = "Sucesso Total!";
      resultType = "strong"
    } else if (successCount === 1) {
      message = "Sucesso Parcial!";
      resultType = "weak"
    } else {
      message = "Falha!";
      resultType = "miss"
    }

    // Mostrar NV aplicado se diferente de 0
    let nvText = "";
    if (advantageLevel !== undefined && advantageLevel !== 0) {
      const nvSign = advantageLevel > 0 ? "+" : "";
      nvText = `NV: ${nvSign}${advantageLevel}`;
    }

    let attributeText
    switch (attribute) {
      case "bod":
        attributeText = "Físico";
        break;
      case "agl":
        attributeText = "Agilidade";
        break;
      case "hrt":
        attributeText = "Coração";
        break;
      case "shd":
        attributeText = "Sombra";
        break;
      case "cun":
        attributeText = "Astúcia";
        break;
      default:
        attributeText = undefined;
        break;
    }

    const moveResultDescription = move.system?.results?.[resultType] || ""

    const actor = move.actor
    const freeRerollIcon = `<button class="reroll-dice" data-reroll-mode="free"><img class="icon-image" src="systems/naruto2d6world/assets/icons/reRollIcon.png" name="reRollImage"></button>`
    const isMomentumPossible = (
      (
        actor.system.momentum.actual >= actualChallengeDiceOneRoll ||
        actor.system.momentum.actual >= actualChallengeDiceTwoRoll
      ) && (
        actualChallengeDiceOneRoll > 0 || actualChallengeDiceTwoRoll > 0
      ) && !(
        actualActionDiceRoll > actualChallengeDiceOneRoll &&
        actualActionDiceRoll > actualChallengeDiceTwoRoll
      ) && !(
        (actor.system.momentum.actual > actualChallengeDiceOneRoll &&
          actualActionDiceRoll > actualChallengeDiceOneRoll) && (
          actor.system.momentum.actual < actualChallengeDiceTwoRoll
        ) ||
        (actor.system.momentum.actual > actualChallengeDiceTwoRoll &&
          actualActionDiceRoll > actualChallengeDiceTwoRoll) && (
          actor.system.momentum.actual < actualChallengeDiceOneRoll
        )
      )
    )

    const momentumButton = `<button class="reroll-dice" data-reroll-mode="momentum" data-message-id="{{messageId}}"><img class="icon-image burn-momentum-icon" src="systems/naruto2d6world/assets/icons/burnMomentum.png" name="MomentumImage"></button>`
    const isFireWillPossible = (actor.system.fireWill.value > 0)
    const fireWillButton = `<button class="reroll-dice" data-reroll-mode="fireWill" data-message-id="{{messageId}}"><img class="icon-image" src="systems/naruto2d6world/assets/icons/fireWillIcon.png" name="FireWillImage"></button>`
    const actionDiceModifiersDesc = newModifiers?.actionDiceModifier ? ` ${parseInt(newModifiers?.actionDiceModifier) > 0 ? "+" : ""} ${parseInt(newModifiers?.actionDiceModifier) != 0 ? parseInt(newModifiers?.actionDiceModifier) : ""}` : ""
    const challengeDiceAModifiersDesc = newModifiers?.challengeDiceAModifier ? ` ${parseInt(newModifiers?.challengeDiceAModifier) > 0 ? "+" : ""} ${parseInt(newModifiers?.challengeDiceAModifier) != 0 ? parseInt(newModifiers?.challengeDiceAModifier) : ""}` : ""
    const challengeDiceBModifiersDesc = newModifiers?.challengeDiceBModifier ? ` ${parseInt(newModifiers?.challengeDiceBModifier) > 0 ? "+" : ""} ${parseInt(newModifiers?.challengeDiceBModifier) != 0 ? parseInt(newModifiers?.challengeDiceBModifier) : ""}` : ""

    // Formatar exibição dos dados de desafio com valor original riscado quando diferente
    const formatChallengeDice = (modifiedValue, originalValue, modifiersDesc) => {
      if (originalValue !== undefined && originalValue !== null && originalValue !== modifiedValue) {
        return `<span style="text-decoration: line-through; opacity: 0.6; margin-right: 4px;">${originalValue}</span>${modifiedValue}${modifiersDesc}`;
      }
      return `${modifiedValue}${modifiersDesc}`;
    };

    const challengeDiceOneDisplay = formatChallengeDice(challengeDiceOneRoll, originalChallengeDiceOne, challengeDiceAModifiersDesc);
    const challengeDiceTwoDisplay = formatChallengeDice(challengeDiceTwoRoll, originalChallengeDiceTwo, challengeDiceBModifiersDesc);

    const label = `
    <div class="rollCard" data-actor="${move.actor.id}" data-item="${move.id}" data-advantage-level="${advantageLevel || 0}" data-attribute="${attribute}" data-roll-modifier="${rollModifier}">
		<details class="moveDescriptionArea">
			<summary class="rollCardTitle collapsible-trigger">
				<a>Movimento: ${move.name}</a>
			</summary>
			<blockquote class="movementDescriptionArea collapsible-content">
				<div>
					${move.system.description}
				</div>
			</blockquote>
		</details>
		<div class="moveDetailsArea">
			${attributeText ? `<i>Atributo escolhido: ${attributeText}</i>` : ""}
			${nvText ? `<i>${nvText}</i>` : ""}
		</div>
    <div class="rolls">
			<div class="actionDiceDisplayPart rollDisplayPart">
				<span class="actionDiceDisplay rollDisplay" data-action-dice-value="${actionDiceRoll}">${actionDiceRoll}${actionDiceModifiersDesc}</span>
			</div>
      <div class="challengeDicesDisplayPart rollDisplayPart">
				<span class="challengeDiceDisplay challengeDiceOneDisplay rollDisplay" data-challenge-dice-one-value="${challengeDiceOneRoll}" ${originalChallengeDiceOne !== undefined && originalChallengeDiceOne !== null && originalChallengeDiceOne !== challengeDiceOneRoll ? `data-challenge-dice-one-original="${originalChallengeDiceOne}"` : ''}>
					${challengeDiceOneDisplay}
				</span>
				<span class="challengeDiceDisplay challengeDiceTwoDisplay rollDisplay" data-challenge-dice-two-value="${challengeDiceTwoRoll}" ${originalChallengeDiceTwo !== undefined && originalChallengeDiceTwo !== null && originalChallengeDiceTwo !== challengeDiceTwoRoll ? `data-challenge-dice-two-original="${originalChallengeDiceTwo}"` : ''}>
					${challengeDiceTwoDisplay}
				</span>
				<a><i class="fas fa-cog btn-adjust-roll-result"></i></a>
			</div>
    </div>
    <span class="resultDisplay result-${successCount}">${message}</span>
		<div class="reroll-buttons">
			${freeRerollIcon}
			${isMomentumPossible ? momentumButton : ""}
			${isFireWillPossible ? fireWillButton : ""}
		</div>
		${moveResultDescription ? `
			<div class="move-result-description">
				<hr><strong>Resultado do Movimento:</strong>
				${moveResultDescription.replaceAll("<p></p>", "")}
			</div>` : ""}
    </div>
`.trim();

    return label
  }

  /**
   * Get the skill label roll template
   * @param {Item} skill - The skill item
   * @returns {string} HTML template string
   */
  static getSkillLabelRollTemplate(skill) {
    let rank = "";
    if (skill.parent) {
      rank = `<i>Rank: ${skill.system.rank.name}</i>`;
    }
    const label = `
      <div class="skillRollChatTemplate">
        <div class="info">
          <i>Perícia: ${skill.name}</i>
          ${rank}
        </div>
      </div>
    `;

    return label;
  }

  /**
   * Get the ability label roll template
   * @param {Item} ability - The ability item
   * @returns {string} HTML template string
   */
  static getAbilityLabelRollTemplate(ability) {
    const hasImg = ability.img != "icons/svg/item-bag.svg";
    const label = `
    <div class="abilityRollChatTemplate">
      <div class="info">
        ${hasImg ? `<img src="${ability.img}" name="${ability.name}">` : ""}
        <div class="title">
          <h3>Habilidade: ${ability.name}</h3>
          <i>Nível: ${ability.system.level}</i>
        </div>
      </div>
    </div>
    `;
    return label;
  }
}

