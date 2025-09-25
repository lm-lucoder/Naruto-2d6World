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
			this.refillChakraPoints = function refillChakraPoints() {
				this.update({ system: { chakra: { chakraPoints: (this.system.chakra.maxChakraPoints) } } })
			}
			this.refillChakraPointsFromActor = function refillChakraPoints(actorId) {
				const actor = Actor.get(actorId);
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
	async moveRoll({ mode, attribute, rollModifier, isUpdate, oldMessage, rerollMode, oldMessageRolls }) {
		const item = this;
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

		// const speaker = ChatMessage.getSpeaker({ actor: this.actor });
		// const rollMode = game.settings.get("core", "rollMode");

		const rollData = this.getRollData();
		const actor = this.actor


		const actionDiceRoll = new Roll(
			`1d6 + @${attribute} ${attributeModifier ? "+" + attributeModifier : ""} ${rollModifier ? "+" + rollModifier : ""}`
				.trim().replaceAll("\n", ""),
			rollData
		);

		let challengeDiceOneRoll
		let challengeDiceTwoRoll
		if (mode === "+advantage") {
			challengeDiceOneRoll = new Roll("3d10kl1")
			challengeDiceTwoRoll = new Roll("3d10kl1")
		}
		if (mode === "advantage") {
			challengeDiceOneRoll = new Roll("2d10kl1")
			challengeDiceTwoRoll = new Roll("2d10kl1")
		}
		if (mode === "normal") {
			challengeDiceOneRoll = new Roll("1d10")
			challengeDiceTwoRoll = new Roll("1d10")

		}
		if (mode === "disadvantage") {
			challengeDiceOneRoll = new Roll("2d10kh1")
			challengeDiceTwoRoll = new Roll("2d10kh1")

		}
		if (mode === "+disadvantage") {
			challengeDiceOneRoll = new Roll("3d10kh1")
			challengeDiceTwoRoll = new Roll("3d10kh1")
		}

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

		const label = this._getMoveLabelRollTemplate({
			move: this,
			mode,
			attribute,
			rollModifier,
			actionDiceRoll,
			challengeDiceOneRoll,
			challengeDiceTwoRoll,
			rerollMode
		});


		// Criar conteúdo do card
		// Criar uma lista de rolagens para manter interatividade
		const rolls = [actionDiceRoll, challengeDiceOneRoll, challengeDiceTwoRoll];
		const renderedRolls = await Promise.all(rolls.map(roll => roll.render()));

		// const updateMode
		// Criar a mensagem no chat com rolagens interativas
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

	_getMoveLabelRollTemplate({ move, mode, attribute, rollModifier, actionDiceRoll, challengeDiceOneRoll, challengeDiceTwoRoll, rerollMode }) {
		let successCount = 0
		let match = false
		let resultType = ""

		if (actionDiceRoll.total > challengeDiceOneRoll.total) successCount++;
		if (actionDiceRoll.total > challengeDiceTwoRoll.total) successCount++;
		if (challengeDiceOneRoll.total == challengeDiceTwoRoll.total) match == true

		let message = "";
		if (match && actionDiceRoll.total > challengeDiceOneRoll.total) {
			message = "Sucesso Crítico!!!"
			resultType = "strong"
		} else if (match && actionDiceRoll.total <= challengeDiceOneRoll.total) {
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

		let modeText;
		switch (mode) {
			case "+advantage":
				modeText = "Rolagem com Grande vantagem!";
				break;
			case "+disadvantage":
				modeText = "Rolagem com grande desvantagem!";
				break;
			case "advantage":
				modeText = "Rolagem com vantagem";
				break;
			case "disadvantage":
				modeText = "Rolagem com desvantagem";
				break;
			case "normal":
				modeText = "Rolagem normal";
				break;

			default:
				modeText = undefined;
				break;
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
				actor.system.momentum.actual >= challengeDiceOneRoll.total ||
				actor.system.momentum.actual >= challengeDiceTwoRoll.total
			) && (
				challengeDiceOneRoll.total > 0 || challengeDiceTwoRoll.total > 0
			) && !(
				actionDiceRoll.total > challengeDiceOneRoll.total &&
				actionDiceRoll.total > challengeDiceTwoRoll.total
			) && !(
				(actor.system.momentum.actual > challengeDiceOneRoll.total &&
					actionDiceRoll.total > challengeDiceOneRoll.total) && (
					actor.system.momentum.actual < challengeDiceTwoRoll.total
				) ||
				(actor.system.momentum.actual > challengeDiceTwoRoll.total &&
					actionDiceRoll.total > challengeDiceTwoRoll.total) && (
					actor.system.momentum.actual < challengeDiceOneRoll.total
				)
			)
		)
		const momentumButton = `<button class="reroll-dice" data-reroll-mode="momentum" data-message-id="{{messageId}}"><img class="icon-image burn-momentum-icon" src="systems/naruto2d6world/assets/icons/burnMomentum.png" name="MomentumImage"></button>`
		const isFireWillPossible = (actor.system.fireWill.value > 0)
		const fireWillButton = `<button class="reroll-dice" data-reroll-mode="fireWill" data-message-id="{{messageId}}"><img class="icon-image" src="systems/naruto2d6world/assets/icons/fireWillIcon.png" name="FireWillImage"></button>`
		const label = `
    <div class="rollCard" data-actor="${this.actor.id}" data-item="${this.id}" data-mode="${mode}" data-attribute="${attribute}" data-roll-modifier="${rollModifier}">
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
			${modeText ? `<i>${modeText}</i>` : ""}
		</div>
        <div class="rolls">
			<div class="actionDiceDisplayPart rollDisplayPart">
				<span class="actionDiceDisplay rollDisplay">${actionDiceRoll.total}</span>
			</div>
            <div class="challengeDicesDisplayPart rollDisplayPart">
				<span class="challengeDiceDisplay challengeDiceOneDisplay rollDisplay">${challengeDiceOneRoll.total}</span>
				<span class="challengeDiceDisplay challengeDiceTwoDisplay rollDisplay">${challengeDiceTwoRoll.total}</span>
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
          <h3>Hablidade: ${ability.name}</h3>
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