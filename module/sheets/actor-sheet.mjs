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
					initial: "skills",
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
	getData() {
		const context = super.getData();

		const actorData = this.actor.toObject(false);

		context.system = actorData.system;
		context.flags = actorData.flags;

		if (actorData.type == "character") {
			this._prepareItems(context);
			this._prepareCharacterData(context);
		}

		if (actorData.type == "npc") {
			// this._prepareItems(context);
		}

		// Add roll data for TinyMCE editors.
		context.rollData = context.actor.getRollData();

		// Prepare active effects
		context.effects = prepareActiveEffectCategories(this.actor.effects);

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
	_prepareCharacterData(context) {}

	_prepareItems(context) {
		// Initialize containers.
		const moves = [];
		const movesByCategory = {};
		const skills = [];
		const conditions = [];
		const abilities = [];

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
				abilities.push(item);
			}
		}
		// Assign and return
		context.moves = moves;
		context.movesByCategory = movesByCategory;
		context.skills = skills;
		context.conditions = conditions;
		context.abilities = abilities;
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

		const validAttributes = Object.values(item.system.attributes).filter(
			(attribute) => attribute.on === true
		);
		const options = validAttributes.map(
			(attribute, i) => `
        <label>
          <input type="radio" name="option" value="${attribute.name}">
          ${attribute.name[0].toUpperCase() + attribute.name.slice(1)}
        </label>
        `
		);

		new Dialog({
			title: `Rolando movimento: ${item.name}`,
			content: `
          <div class="dialog-roll-move-content">
            <h3>Escolha o atributo</h3>
            <div class="options-container">
              ${options.join("")}
            </div>
          </div>
          `,
			buttons: {
				button1: {
					label: "Vantagem",
					callback: (_, e) => dialogCallback(e, 'advantage'),
				},
				button2: {
					label: "Normal",
					callback: (_, e) => dialogCallback(e, 'normal'),
				},
				button3: {
					label: "Desvantagem",
					callback: (_, e) => dialogCallback(e, 'disadvantage'),
				},
			},
		}).render(true);

		function dialogCallback(e, mode) {
			const options = e.target
				.closest(".window-content")
				.querySelector(".options-container")
				.querySelectorAll('[name="option"]');
			const checkedOption = [...options].find((option) => option.checked);
			if (!checkedOption) {
				ui.notifications.info(
					"Escolha um atributo para rolar com o movimento!"
				);
				return;
			}
			const chosenAttribute = checkedOption.value;
			item.moveRoll({
				mode,
				attribute: chosenAttribute,
			});
		}
	}
}
