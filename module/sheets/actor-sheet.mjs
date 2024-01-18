import RollMoveDialog from "../dialogs/rollMoveDialog.mjs";
import {
	onManageActiveEffect,
	prepareActiveEffectCategories,
} from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class BoilerplateActorSheet extends ActorSheet {
	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ["boilerplate", "sheet", "actor"],
			// template: "systems/boilerplate/templates/actor/actor-sheet.html",
			width: 700,
			height: 700,
			tabs: [
				{
					navSelector: ".sheet-tabs",
					contentSelector: ".sheet-body",
					initial: "description",
				},
				{
					navSelector: ".att-cond-tabs",
					contentSelector: ".att-cond-body",
					initial: "attributes",
				},
			],
		});
	}

	/** @override */
	get template() {
		return `systems/naruto2d6world/templates/actor/actor-${this.actor.type}-sheet.html`;
	}

	/* -------------------------------------------- */

	/** @override */
	async getData() {
		const context = super.getData();

		const actorData = this.actor.toObject(false);

		context.system = actorData.system;
		context.flags = actorData.flags;

		if (actorData.type == "character") {
			this._prepareCharacterItems(context);
			await this._prepareCharacterData(context);
		}

		if (actorData.type == "npc") {
			// this._prepareItems(context);
			this._prepareNPCItems(context)
		}

		// Add roll data for TinyMCE editors.
		context.rollData = context.actor.getRollData();

		// Prepare active effects

		console.log(context);
		return context;
	}

	/**
	 * Organize and classify Items for Character sheets.
	 *
	 * @param {Object} actorData The actor to prepare.
	 *
	 * @return {undefined}
	 */
	async _prepareCharacterData(context) {
		context.effects = prepareActiveEffectCategories(this.actor.effects);
		context.space = {};
		context.space.usedSpace = this._getUsedSpace(context.gear);
		context.space.maxSpace = this._getMaxSpace(context.gear);
		context.space.isAboveSpace = this._getIsAboveSpaceCondition(
			context.space
		);

		for (const item of context.gear) {
			await this._prepareDescriptionData(item);
		}
		for (const move of context.moves) {
			await this._prepareDescriptionData(move);
		}
	}

	_prepareCharacterItems(context) {
		// Initialize containers.
		const moves = [];
		const movesByCategory = {};
		const skills = [];
		const conditions = [];
		const abilities = [];
		const abilitiesByCategory = {};
		const gear = [];
		const gearByCategory = {};

		// Iterate through items, allocating to containers
		for (let item of context.items) {
			item.img = item.img || DEFAULT_TOKEN;
			// Append to gear.
			if (item.type === "move") {
				moves.push(item);
				if (movesByCategory[item.system.category]) {
					movesByCategory[item.system.category].items.push(item);
				} else {
					movesByCategory[item.system.category] = {
						name: item.system.category,
						items: [item],
					};
				}
			}
			// Append to features.
			else if (item.type === "skill") {
				skills.push(item);
			} else if (item.type === "condition") {
				conditions.push(item);
			} else if (item.type === "ability") {
				if (abilitiesByCategory[item.system.category]) {
					abilitiesByCategory[item.system.category].items.push(item);
				} else {
					abilitiesByCategory[item.system.category] = {
						name: item.system.category,
						items: [item],
					};
				}
				abilities.push(item);
			} else if (item.type === "item") {
				gear.push(item);
				if (gearByCategory[item.system.category]) {
					gearByCategory[item.system.category].items.push(item);
				} else {
					gearByCategory[item.system.category] = {
						name: item.system.category,
						items: [item],
					};
				}
			}
		}
		// Assign and return
		context.moves = moves;
		context.movesByCategory = movesByCategory;
		context.skills = skills;
		context.conditions = conditions;
		context.abilities = abilities;
		context.abilitiesByCategory = abilitiesByCategory;
		context.gear = gear;
		context.gearByCategory = gearByCategory;
	}
	_prepareNPCItems(context) {
		const conditions = [];
		for (let item of context.items) {
			item.img = item.img || DEFAULT_TOKEN;
			 if (item.type === "condition") {
				conditions.push(item);
			} 
		}
		context.conditions = conditions;
	}

	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		// Render the item sheet for viewing/editing prior to the editable check.
		html.find(".item-edit").click((ev) => {
			const li = $(ev.currentTarget).parents(".item");
			const item = this.actor.items.get(li.data("itemId"));
			item.sheet.render(true);
		});

		// -------------------------------------------------------------
		// Everything below here is only needed if the sheet is editable
		if (!this.isEditable) return;

		// Add Inventory Item
		html.find(".item-create").click(this._onItemCreate.bind(this));

		// Delete Inventory Item
		html.find(".item-delete").click((ev) => {
			const li = $(ev.currentTarget).parents(".item");
			console.log(li.data("itemId"));
			const item = this.actor.items.get(li.data("itemId"));
			item.delete();
			li.slideUp(200, () => this.render(false));
		});

		// Active Effect management
		html.find(".effect-control").click((ev) =>
			onManageActiveEffect(ev, this.actor)
		);

		// Rollable abilities.
		html.find(".rollable").click(this._onRoll.bind(this));

		html.find(".rollableWithDialog").click((event) => {
			this._onRollMove(event);
		});

		html.find(".condition-card-checkbox").click((event) => {
			const conditionId = event.target
				.closest(".condition-card")
				.getAttribute("data-item-id");
			const condition = this.actor.items.get(conditionId);
			condition.update({
				system: { isActive: !condition.system.isActive },
			});
		});

		html.find(".show-description-window-btn").click((event) => {
			this._toggleDescriptionWindow(event);
		});

		html.find(".item-on-hand-btn").click((event) => {
			const itemId = event.target.closest("li").getAttribute("data-item-id");
			const item = this.object.items.get(itemId)
			if (item.system.onHand) {
				this.object.items.get(itemId).update({system: {onHand: false}})
			} else {
				this.object.items.get(itemId).update({system: {onHand: true}})
			}
		})
		html.find(".item-card-attribute-tag").mousedown((e) => {
			const itemId = e.target.closest(".item-card").getAttribute('data-item-id')
			const itemAttributeId = e.target.closest('.item-card-attribute-tag').getAttribute("data-attribute-id")
			const item = this.object.items.get(itemId)
			const attribute = item.system.attributes.find(attribute => attribute.id == itemAttributeId)
			if (e.shiftKey) {
				attribute.value = attribute.maxValue
				return item.update({system: {attributes : [... item.system.attributes]}})
			}
			if (e.button === 0) {
				attribute.value = parseInt(attribute.value) + 1
			} else if (e.button === 2) {
				attribute.value = parseInt(attribute.value) - 1
			}
			item.update({system: {attributes : [... item.system.attributes]}})
		})

		// Drag events for macros.
		if (this.actor.isOwner) {
			let handler = (ev) => this._onDragStart(ev);
			html.find("li.item").each((i, li) => {
				if (li.classList.contains("inventory-header")) return;
				li.setAttribute("draggable", true);
				li.addEventListener("dragstart", handler, false);
			});
		}
	}

	/**
	 * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
	 * @param {Event} event   The originating click event
	 * @private
	 */
	async _onItemCreate(event) {
		event.preventDefault();
		const header = event.currentTarget;
		// Get the type of item to create.
		const type = header.dataset.type;
		// Grab any data associated with this control.
		const data = duplicate(header.dataset);
		// Initialize a default name.
		const name = `New ${type.capitalize()}`;
		// Prepare the item object.
		const itemData = {
			name: name,
			type: type,
			system: data,
		};
		// Remove the type from the dataset since it's in the itemData.type prop.
		delete itemData.system["type"];

		// Finally, create the item!
		return await Item.create(itemData, { parent: this.actor });
	}

	/**
	 * Handle clickable rolls.
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onRoll(event) {
		event.preventDefault();
		const element = event.currentTarget;
		const dataset = element.dataset;
		console.log("chegou")
		// Handle item rolls.
		if (dataset.rollType) {
			if (dataset.rollType == "item") {
				const itemId = element.closest(".item").dataset.itemId;
				const item = this.actor.items.get(itemId);
				if (item) return item.roll();
			}
			if (dataset.rollType == "skill") {
				const itemId = element.closest(".item").dataset.itemId;
				const item = this.actor.items.get(itemId);
				if (item) return item.skillRoll();
			}
			if (dataset.rollType == "move") {
				const itemId = element.closest(".item").dataset.itemId;
				const item = this.actor.items.get(itemId);
				if (item) return item.moveRoll();
			}
			if (dataset.rollType == "ability") {
				const itemId = element.closest(".item").dataset.itemId;
				const item = this.actor.items.get(itemId);
				if (item) return item.abilityRoll();
			}
		}

		// Handle rolls that supply the formula directly.
		if (dataset.roll) {
			let label = dataset.label ? `[ability] ${dataset.label}` : "";
			let roll = new Roll(dataset.roll, this.actor.getRollData());
			roll.toMessage({
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: label,
				rollMode: game.settings.get("core", "rollMode"),
			});
			return roll;
		}
	}
	_onRollMove(event) {
		const target = event.currentTarget;
		const li = target.closest("li");
		const item = this.object.items.find(
			(item) => item.id === li.dataset.itemId
		);
		const isRollableMove = Object.values(item.system.attributes).find(
			(attribute) => attribute.on
		);
		if (!isRollableMove) {
			return item.moveRollJustSend();
		}

		RollMoveDialog.create(item)
	}

	_toggleDescriptionWindow(event) {
		const itemId = event.target.closest("li").getAttribute("data-item-id");
		const windowElement = event.target
			.closest("li")
			.querySelector(".description-window");
		const item = this.actor.items.get(itemId);
		const itemAttributes = item.system.attributes;
		if (windowElement.innerHTML.trim() === "") {
			windowElement.innerHTML = `
				<ul class="item-attributes-list">
					${itemAttributes.map(attribute => {
						console.log("attribute", attribute)
						return `
						<li class="item-attribute-card" data-item-attribute-id="${attribute.id}">
							<span><b>${attribute.name}:</b></span>
							<span>${attribute.value} / ${attribute.maxValue}</span>
						</li>
						`
						/* return `
						<li class="item-attribute-card" data-item-attribute-id="${attribute.id}">
							<span><b>${attribute.name}:</b></span>
							<input class="item-attribute-card-input" value="${attribute.value}" data-objective="value"/>
							<input class="item-attribute-card-input" value="${attribute.maxValue}" data-objective="maxValue"/>
						</li>
						` */
					}).join('')}
				</ul>
				<div class="item-description">
					${item.system.description}
				</div>
			`
			;
		} else {
			windowElement.innerHTML = "";
		}
	}

	_getUsedSpace(items) {
		const total = items.reduce(
			(total, item) =>{
				if (item.system.considerSlots && !item.system.onHand) {
					return total + item.system.slots * item.system.quantity
				} else {
					return 0
				}
			},
			0
		);
		const roundedTotal = Math.round(total * 100) / 100; //Somente 2 casas decimais
		return roundedTotal;
	}

	_getMaxSpace(items) {
		let total = items.reduce(
			(total, item) =>
				total + item.system.slots_bonus * item.system.quantity,
			0
		);
		total += this.object.system.params.space;
		return total;
	}

	_getIsAboveSpaceCondition({ usedSpace, maxSpace }) {
		console.log(usedSpace, maxSpace);
		return usedSpace > maxSpace;
	}

	async _prepareDescriptionData(item) {
		item.description = await TextEditor.enrichHTML(
			item.system.description,
			{
				async: true,
				secrets: this.object.isOwner,
				relativeTo: this.object,
			}
		);
	}
}
