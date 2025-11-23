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
		if (this.type === "skill") {
			this._rankSkill();
		}
		if (this.type === "ability") {
			this._rankAbility();
			const levelDescription = this.system.levelDescriptions.find(
				(element) => element.level == this.system.level
			);
			if (levelDescription?.description) {
				this.system.levelDescription = levelDescription.description;
			}
			if (this.system.chakra.useChakraPoints) {
				this.system.chakra.maxChakraPoints = +this.system.level * +this.system.chakra.chakraPointsPerLevel + +this.system.chakra.defaultChakraPoints
			}
			// Calcula maxValue para cada recurso baseado no nível
			if (this.system.resources && Array.isArray(this.system.resources)) {
				this.system.resources.forEach(resource => {
					if (resource.valuePerLevel !== undefined && resource.defaultValue !== undefined) {
						resource.maxValue = +this.system.level * +resource.valuePerLevel + +resource.defaultValue;
					}
				});
			}
			this.refillChakraPoints = function refillChakraPoints() {
				this.update({ system: { chakra: { chakraPoints: (this.system.chakra.maxChakraPoints) } } })
			}
			this.refillChakraPointsFromActor = function refillChakraPoints(actorId) {
				const actor = Actor.get(actorId);
				if (actor.system.chakra.value < 0) {
					return ui.notifications.info("Você não possui pontos de chakra suficientes para isso!");
				}
				actor.update({ system: { chakra: { value: parseInt(actor.system.chakra.value) - 1 } } })
				this.refillChakraPoints()
			}
		}
		if (this.type === "item") {
			this.updateQuantity = function updateQuantity(qtValue) {
				const newQt = this.system.quantity + qtValue
				this.update({ system: { quantity: newQt } })
			}
			if (this.system.scroll.isScroll) {
				this.system.scroll.scrollItemsComplete = this.ScrollAPI.getAll(this)
				this.system.scroll.scrollUsedSlots = this.ScrollAPI.getSlotsStatus(this)
			}
		}
		if (this.type === "move") {
			this.moveDescription = this._prepareMoveDescription();
		}
	}

	/**
	 * Prepare a data object which is passed to any Roll formulas which are created related to this Item
	 * @private
	 */
	getRollData() {
		// If present, return the actor's roll data.
		if (!this.actor) return null;
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
		const rollMode = game.settings.get("core", "rollMode");
		const label = `[${item.type}] ${item.name}`;

		// If there's no roll data, send a chat message.
		if (!this.system.formula) {
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
		const rollMode = game.settings.get("core", "rollMode");

		const label = this._getSkillLabelRollTemplate(item);

		ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			flavor: label,
			content: item.system.description ?? "",
		});
	}
	async abilityRoll() {
		const ability = this;

		const speaker = ChatMessage.getSpeaker({ actor: this.actor });
		const label = this._getAbilityLabelRollTemplate(ability);

		ChatMessage.create({
			speaker: speaker,
			flavor: label,
			content: ability.system.description ?? "",
		});
	}
	/**
	 * Apply advantage level (NV) modifications to challenge dice
	 * @param {number} advantageLevel - The advantage level (NV) to apply
	 * @param {number} challengeDiceOne - First challenge die result
	 * @param {number} challengeDiceTwo - Second challenge die result
	 * @returns {Object} Modified challenge dice results
	 */
	_applyAdvantageLevelToChallengeDice(advantageLevel, challengeDiceOne, challengeDiceTwo) {
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

	async moveRoll(params) {
		const { advantageLevel, attribute, rollModifier, isUpdate, oldMessage, rerollMode, oldMessageRolls, newModifiers } = params;
		if (isUpdate && rerollMode == "adjustment") {
			const label = this._getMoveLabelRollTemplate({
				move: this,
				advantageLevel,
				attribute,
				rollModifier,
				actionDiceRoll: oldMessageRolls.actionDiceResult,
				challengeDiceOneRoll: oldMessageRolls.challengeDiceOneResult,
				challengeDiceTwoRoll: oldMessageRolls.challengeDiceTwoResult,
				originalChallengeDiceOne: undefined, // Ajuste manual não tem valor original
				originalChallengeDiceTwo: undefined, // Ajuste manual não tem valor original
				newModifiers
			});
			await oldMessage.update({
				flavor: label,
			})
			return
		}
		//Lidar com a existência de configurações específicas para este movimento, vinda de condições
		let attributeModifier = 0;
		const parentConditions = this.parent.items.filter(
			(item) => item.type === "condition"
		);
		const activeConditions = parentConditions.filter(
			(condition) => condition.system.isActive
		);
		for (const activeCondition of activeConditions) {
			if (activeCondition.system?.movesConfigs) {
				Object.values(activeCondition.system.movesConfigs).forEach(
					(moveConfig) => {
						if (moveConfig.moveName === this.name) {
							attributeModifier +=
								moveConfig.attributes[attribute].value;
						}
					}
				);
			}
		}

		const rollData = this.getRollData();
		const actor = this.actor

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
		const nvValue = advantageLevel || 0;
		const modifiedDice = this._applyAdvantageLevelToChallengeDice(
			nvValue,
			originalChallengeDiceOne,
			originalChallengeDiceTwo
		);

		// Atualizar os totais dos dados de desafio
		challengeDiceOneRoll._total = modifiedDice.diceOne;
		challengeDiceTwoRoll._total = modifiedDice.diceTwo;

		const label = this._getMoveLabelRollTemplate({
			move: this,
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

		// const updateMode
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

	async moveRollJustSend() {
		const move = this;

		const speaker = ChatMessage.getSpeaker({ actor: this.actor });
		const rollMode = game.settings.get("core", "rollMode");
		const label = `<div class="rollCard">
				<h3 class="rollcard-title">Movimento: ${move.name}</h3>
				<div class="rollcard-content">
					${move.system.description}
				</div>
			</div>`.trim()

		ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			flavor: label,
		});
	}
	async moveRollNPC() {
		const move = this;

		const speaker = ChatMessage.getSpeaker({ actor: this.actor });
		const rollMode = game.settings.get("core", "rollMode");

		let MoveAttributesMessage = ""
		let canUpdateChakra = false
		let newChakraAmount = 0
		let canUpdateUses = false

		//Handle Chakra consumption for this movement
		if (this.system.npcMoveConsumesNPCChakraOnUse.on) {

			if (this.actor.system.chakra.value < this.system.npcMoveConsumesNPCChakraOnUse.value) {
				return ui.notifications.info("Você não possui chakra suficiente para realizar este movimento!");
			}

			newChakraAmount = this.actor.system.chakra.value - this.system.npcMoveConsumesNPCChakraOnUse.value;
			canUpdateChakra = true
			MoveAttributesMessage += `<p class="chat-tag chakra-info"><strong >${this.system.npcMoveConsumesNPCChakraOnUse.value} pontos de chakra foram utilizados</strong></p>`;
		}

		//Handle NPC Levels on this movement
		if (this.system.npcMoveLevel.on) {
			MoveAttributesMessage += `<p class="chat-tag"><strong>Nível do Movimento:</strong> ${this.system.npcMoveLevel.value}</p>`;
		}

		//Handle NPC Uses for this movement
		if (this.system.npcUses.on) {
			if (this.system.npcUses.min <= 0) {
				return ui.notifications.info("Você não possui mais cargas disponíveis para este movimento!");
			}

			//Handle the reduction of uses when sending to chat
			if (this.system.npcUses.consumesOnChatSending) {
				canUpdateUses = true
			}
		}


		//Handle update of charges
		if (canUpdateChakra) {
			this.actor.update({ "system.chakra.value": newChakraAmount });
		}
		if (canUpdateUses) {
			await this.update({ "system.npcUses.min": this.system.npcUses.min - 1 })
			MoveAttributesMessage += `<p class="chat-tag"><strong>Cargas Restantes:</strong> ${this.system.npcUses.min} / ${this.system.npcUses.max}</p>`;
		}

		let treatedDescription = ""

		if (move.system.moveDescription) {
			//Treat Movement description data
			/* treatedDescription = move.system.description
				.replaceAll("//Level//", new String(this.system.npcMoveLevel.value).toString())
				.replaceAll("//MinUses//", new String(this.system.npcUses.min).toString())
				.replaceAll("//MaxUses//", new String(this.system.npcUses.max).toString()) */
			treatedDescription = move.system.moveDescription

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
			<h3 class="rollcard-title">Movimento: ${move.name}</h3>
			<p class="rollcard-category">
				<i>Categoria: ${move.system.category.replace("NPC - ", "")}</i>
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

	async reloadNPCMoveUses(hardReload) {
		if (this.type !== "move") return;
		if (!this.system.npcUses.on) return;
		if (this.system.npcUses.min >= this.system.npcUses.max) {
			return ui.notifications.info("As cargas deste movimento já estão completas!")
		}

		let title = `<h3 class="rollcard-title">Recarregou movimento: "${this.name}"</h3>`
		let message = ""

		if (this.system.npcUses.consumesNPCChakraOnReload.on && !hardReload) {
			if (this.actor.system.chakra.value < this.system.npcUses.consumesNPCChakraOnReload.value) {
				return ui.notifications.info("Você não possui chakra suficiente para recarregar as cargas deste movimento!");
			}
			await this.actor.update({ "system.chakra.value": this.actor.system.chakra.value - this.system.npcUses.consumesNPCChakraOnReload.value });
			message += `
			<div class="rollcard-content">
			<p class="chat-tag chakra-info"><strong>${this.system.npcUses.consumesNPCChakraOnReload.value} pontos de chakra foram utilizados</strong></p>
			</div>
			`
		}
		await this.update({ "system.npcUses.min": this.system.npcUses.max })

		if (!hardReload) {
			const speaker = ChatMessage.getSpeaker({ actor: this.actor });
			await ChatMessage.create({
				speaker: speaker,
				content: `<div class="rollCard">
					${title}
					${message}
				</div>`
			});
		}
	}


	_rankSkill() {
		let name = "";
		switch (this.system.rank.value) {
			case "0":
				name = "Academia";
				break;
			case "1":
				name = "Genin";
				break;
			case "2":
				name = "Chunin";
				break;
			case "3":
				name = "Jounin Especial";
				break;
			case "4":
				name = "Jounin";
				break;
			case "5":
				name = "Kage";
				break;
			default:
				name = "Não definido";
				break;
		}
		this.system.rank.name = name;
	}
	_rankAbility() {
		const level = this.system.level;
		const rankMap = [
			{ level: 9, rank: "Kage" },
			{ level: 7, rank: "Jounin" },
			{ level: 5, rank: "Jounin Especial" },
			{ level: 3, rank: "Chunin" },
			{ level: 0, rank: "Genin" },
		];

		const { rank } = rankMap.find((entry) => level >= entry.level);
		this.system.rank = rank;
	}

	_getMoveLabelRollTemplate({ move, advantageLevel, attribute, rollModifier, actionDiceRoll, challengeDiceOneRoll, challengeDiceTwoRoll, originalChallengeDiceOne, originalChallengeDiceTwo, newModifiers }) {
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
				return `${modifiedValue}<span style="text-decoration: line-through; opacity: 0.6; margin-left: 4px;">${originalValue}</span>${modifiersDesc}`;
			}
			return `${modifiedValue}${modifiersDesc}`;
		};

		const challengeDiceOneDisplay = formatChallengeDice(challengeDiceOneRoll, originalChallengeDiceOne, challengeDiceAModifiersDesc);
		const challengeDiceTwoDisplay = formatChallengeDice(challengeDiceTwoRoll, originalChallengeDiceTwo, challengeDiceBModifiersDesc);

		const label = `
    <div class="rollCard" data-actor="${this.actor.id}" data-item="${this.id}" data-advantage-level="${advantageLevel || 0}" data-attribute="${attribute}" data-roll-modifier="${rollModifier}">
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
	_getSkillLabelRollTemplate(skill) {
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
	_getAbilityLabelRollTemplate(ability) {
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

	_prepareMoveDescription() {
		this.system.moveDescription = this.system.description
			.replaceAll("//Level//", new String(this.system.npcMoveLevel.value).toString())
			.replaceAll("//MinUses//", new String(this.system.npcUses.min).toString())
			.replaceAll("//MaxUses//", new String(this.system.npcUses.max).toString())
	}

	ScrollAPI = ScrollAPI
}

class ScrollAPI {
	static getAll(scroll) {
		const scrollItemsRaw = scroll.system.scroll.scrollItems
		const scrollItems = scrollItemsRaw.map((item) => {
			return {
				data: Item.get(item.id),
				quantity: item.quantity
			}
		})
		return scrollItems
	}
	static getSlotsStatus(scroll) {
		const scrollItems = scroll.system.scroll.scrollItemsComplete
		let totalSlots = 0
		scrollItems.forEach(item => {
			const itemQt = item.quantity
			totalSlots += (itemQt * item.data.system.slots)
		})
		return totalSlots
	}
}