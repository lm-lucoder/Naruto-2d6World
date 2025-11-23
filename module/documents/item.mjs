import { ItemRollManager } from "../classes/item-roll-manager.mjs";

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
		return ItemRollManager.roll(this);
	}

	async skillRoll() {
		return ItemRollManager.skillRoll(this);
	}

	async abilityRoll() {
		return ItemRollManager.abilityRoll(this);
	}

	async moveRoll(params) {
		return ItemRollManager.moveRoll(this, params);
	}

	async moveRollJustSend() {
		return ItemRollManager.moveRollJustSend(this);
	}

	async moveRollNPC() {
		return ItemRollManager.moveRollNPC(this);
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