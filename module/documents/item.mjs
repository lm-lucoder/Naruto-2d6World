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
	async moveRoll({ mode, attribute, rollModifier }) {
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
		await actionDiceRoll.evaluate({ async: true })
		await challengeDiceOneRoll.evaluate({ async: true })
		await challengeDiceTwoRoll.evaluate({ async: true })

		const label = this._getMoveLabelRollTemplate({
			move: this,
			mode,
			attribute,
			actionDiceRoll,
			challengeDiceOneRoll,
			challengeDiceTwoRoll
		});


		// Criar conteúdo do card
		// Criar uma lista de rolagens para manter interatividade
		const rolls = [actionDiceRoll, challengeDiceOneRoll, challengeDiceTwoRoll];
		const renderedRolls = await Promise.all(rolls.map(roll => roll.render()));

		// Criar a mensagem no chat com rolagens interativas
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

	async moveRollJustSend() {
		const move = this;

		const speaker = ChatMessage.getSpeaker({ actor: this.actor });
		const rollMode = game.settings.get("core", "rollMode");
		const label = `<div class="rollCard">
		<i>Utilizado por: ${this.actor.name}</i>
		<h3>Movimento: ${move.name}</h3>
		${move.system.description}
    </div>`.trim()

		ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			flavor: label,
		});
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

	_getMoveLabelRollTemplate({ move, mode, attribute, actionDiceRoll, challengeDiceOneRoll, challengeDiceTwoRoll }) {
		let successCount = 0
		let match = false

		if (actionDiceRoll.total > challengeDiceOneRoll.total) successCount++;
		if (actionDiceRoll.total > challengeDiceTwoRoll.total) successCount++;
		if (challengeDiceOneRoll.total == challengeDiceTwoRoll.total) match == true

		let message = "";
		if (match && actionDiceRoll.total > challengeDiceOneRoll.total) {
			message = "Sucesso Crítico!!!"
		} else if (match && actionDiceRoll.total <= challengeDiceOneRoll.total) {
			message = "Falha Crítica!!!"
		} else if (successCount === 2) {
			message = "Sucesso Total!";
		} else if (successCount === 1) {
			message = "Sucesso Parcial!";
		} else {
			message = "Falha!";
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

		const label = `
    <div class="rollCard">
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
			<i>Utilizado por: ${this.actor.name}</i>
			${attributeText ? `<i>Atributo escolhido: ${attributeText}</i>` : ""}
			${modeText ? `<i>${modeText}</i>` : ""}
			<i>Resultado: ${actionDiceRoll.result}</i>
		</div>
        <div class="rolls">
			<div class="actionDiceDisplayPart rollDisplayPart">
				<span class="actionDiceDisplay rollDisplay">${actionDiceRoll.total}</span>
			</div>
            <div class="challengeDicesDisplayPart rollDisplayPart">
				<span class="challengeDiceDisplay rollDisplay">${challengeDiceOneRoll.total}</span>
				<span class="challengeDiceDisplay rollDisplay">${challengeDiceTwoRoll.total}</span>
			</div>
        </div>
        <span class="resultDisplay result-${successCount}">${message}</span>
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