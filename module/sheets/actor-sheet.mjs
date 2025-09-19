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
	_onDropItem(e, data) {
		if (data.type === "Item" && !e.ctrlKey) {
			const itemId = data.uuid.split(".")[1]
			const itemName = Item.get(itemId).name
			const actorItem = this.object.items.find(item => item.name == itemName)
			if (actorItem) {
				return actorItem.updateQuantity(1)
			}
		}

		super._onDropItem(e, data)
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
		context.advantageLevel = this.object.system.advantageLevel
		context.momentum = this.object.system.momentum
		context.advantageLevel.range = this.getAdvantageLevelRange(context.advantageLevel)
		context.momentum.range = this.getMomentumRange(context.momentum)

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
		const moves = [];
		for (let item of context.items) {
			item.img = item.img || DEFAULT_TOKEN;
			if (item.type === "condition") {
				conditions.push(item);
			}
			if (item.type === "move") {
				moves.push(item);
			}
		}
		context.conditions = conditions;
		context.moves = moves;
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

		html.find(".show-item-description-window-btn").click((event) => {
			this._toggleItemDescriptionWindow(event);
		});
		html.find(".show-ability-description-window-btn").click((event) => {
			this._toggleAbilityDescriptionWindow(event);
		});

		html.find(".item-on-hand-btn").click((event) => {
			const itemId = event.target.closest("li").getAttribute("data-item-id");
			const item = this.object.items.get(itemId)
			if (item.system.onHand) {
				this.object.items.get(itemId).update({ system: { onHand: false } })
			} else {
				this.object.items.get(itemId).update({ system: { onHand: true } })
			}
		})
		html.find(".item-attribute-quantity").mousedown((e) => {
			const itemId = e.target.closest(".item-card").getAttribute('data-item-id')
			const item = this.object.items.get(itemId)
			console.log(item.system.quantity)
			if (e.button === 0) {
				if (e.shiftKey) {
					item.system.quantity += 5
					return item.update({ system: { quantity: item.system.quantity } })
				}
				item.system.quantity += 1
				return item.update({ system: { quantity: item.system.quantity } })
			}
			if (e.button === 2) {
				if (item.system.quantity == 0) {
					return ui.notifications.info(`${item.name} já está no mínimo!`);
				}
				if (e.shiftKey) {
					item.system.quantity -= 5
					if (item.system.quantity < 0) {
						item.system.quantity = 0
					}
					return item.update({ system: { quantity: item.system.quantity } })
				}
				if (e.ctrlKey) {
					return item.update({ system: { quantity: 0 } })
				}
				item.system.quantity -= 1
				return item.update({ system: { quantity: item.system.quantity } })
			}
		})
		html.find(".item-card-attribute-tag").mousedown((e) => {
			const itemId = e.target.closest(".item-card").getAttribute('data-item-id')
			const itemAttributeId = e.target.closest('.item-card-attribute-tag').getAttribute("data-attribute-id")
			const item = this.object.items.get(itemId)
			const attribute = item.system.attributes.find(attribute => attribute.id == itemAttributeId)
			if (e.button === 0) {
				if (attribute.value == attribute.maxValue) {
					return ui.notifications.info(`${attribute.name} já está no máximo!`);
				}
				if (e.ctrlKey) {
					attribute.value = attribute.maxValue
					return item.update({ system: { attributes: [...item.system.attributes] } })
				}
				if (e.shiftKey) {
					attribute.value = parseInt(attribute.value) + 5
					if (attribute.value > attribute.maxValue) {
						attribute.value = attribute.maxValue
					}
					return item.update({ system: { attributes: [...item.system.attributes] } })
				}
				attribute.value = parseInt(attribute.value) + 1
			}
			if (e.button === 2) {
				if (attribute.value == 0) {
					return ui.notifications.info(`${attribute.name} já está no mínimo!`);
				}
				if (e.ctrlKey) {
					attribute.value = 0
					return item.update({ system: { attributes: [...item.system.attributes] } })
				}
				if (e.shiftKey) {
					attribute.value = parseInt(attribute.value) - 5
					if (attribute.value < 0) {
						attribute.value = 0
					}
					return item.update({ system: { attributes: [...item.system.attributes] } })
				}
				attribute.value = parseInt(attribute.value) - 1
			}
			item.update({ system: { attributes: [...item.system.attributes] } })
		})

		html.find('.chakra-tag').mousedown((e) => {
			const itemId = e.target.closest(".item").getAttribute('data-item-id')
			const item = this.object.items.get(itemId)
			item.system.chakra.chakraPoints = parseInt(item.system.chakra.chakraPoints)
			if (e.target.classList.contains("image")) {
				const actorChakraValue = parseInt(this.object.system.chakra.value)
				const actorMaxChakraValue = parseInt(this.object.system.chakra.maxValue)
				if (actorChakraValue == 0) {
					return ui.notifications.info("Você não possui pontos de chakra para isso");
				}
				if (item.system.chakra.chakraPoints == item.system.chakra.maxChakraPoints) {
					return ui.notifications.info("Os pontos de chakra desta habilidade já estão no máximo");
				}
				item.refillChakraPointsFromActor(this.object.id)
				const speaker = ChatMessage.getSpeaker({ actor: this.object });
				ChatMessage.create({
					speaker: speaker,
					flavor: `${this.object.name} CP: ${this.object.system.chakra.value}/${this.object.system.chakra.max}`,
					content: `${this.object.name} consumiu 1 ponto de chakra e recarregou a habilidade: ${item.name}`
				});
				// item.update({system: {chakra : {chakraPoints : (item.system.chakra.maxChakraPoints) }}})
				// this.object.update({system: {chakra: {value : actorChakraValue - 1}}})
				return
			}
			if (e.button === 0) {
				if (item.system.chakra.chakraPoints == item.system.chakra.maxChakraPoints) {
					return ui.notifications.info("Os pontos de chakra desta habilidade já estão no máximo");
				}
				if (e.shiftKey) {
					item.system.chakra.chakraPoints = item.system.chakra.chakraPoints += 5
					if (item.system.chakra.chakraPoints > item.system.chakra.maxChakraPoints) {
						item.system.chakra.chakraPoints = item.system.chakra.maxChakraPoints
					}
					return item.update({ system: { chakra: { chakraPoints: item.system.chakra.chakraPoints } } })
				}
				if (e.ctrlKey) {
					item.system.chakra.chakraPoints = item.system.chakra.maxChakraPoints
					return item.update({ system: { chakra: { chakraPoints: item.system.chakra.chakraPoints } } })
				}
				item.system.chakra.chakraPoints = item.system.chakra.chakraPoints += 1
				return item.update({ system: { chakra: { chakraPoints: item.system.chakra.chakraPoints } } })
			}
			if (e.button === 2) {
				if (item.system.chakra.chakraPoints == 0) {
					return ui.notifications.info("Os pontos de chakra desta habilidade já estão no mínimo");
				}
				if (e.shiftKey) {
					item.system.chakra.chakraPoints = item.system.chakra.chakraPoints -= 5
					if (item.system.chakra.chakraPoints < 0) {
						item.system.chakra.chakraPoints = 0
					}
					return item.update({ system: { chakra: { chakraPoints: item.system.chakra.chakraPoints } } })
				}
				if (e.ctrlKey) {
					item.system.chakra.chakraPoints = 0
					return item.update({ system: { chakra: { chakraPoints: item.system.chakra.chakraPoints } } })
				}
				item.system.chakra.chakraPoints = item.system.chakra.chakraPoints -= 1
				return item.update({ system: { chakra: { chakraPoints: item.system.chakra.chakraPoints } } })
			}
		})

		html.find('.ability-resource-tag').mousedown((e) => {
			const abilityId = e.target.closest(".item").getAttribute('data-item-id')
			const ability = this.object.items.get(abilityId)
			const resourceId = e.target.closest(".ability-resource-tag").getAttribute("data-resource-id")
			const resource = ability.system.resources.find(resource => resource.id == resourceId)

			if (e.button === 0) {
				if (resource.value == resource.maxValue) {
					return ui.notifications.info("Os pontos deste recurso já estão no máximo");
				}
				if (e.shiftKey) {
					resource.value = parseInt(resource.value) + 5
					if (resource.value > resource.maxValue) {
						resource.value = resource.maxValue
					}
					return ability.update({ system: { resources: [...ability.system.resources] } })
				}
				if (e.ctrlKey) {
					resource.value = resource.maxValue
					return ability.update({ system: { resources: [...ability.system.resources] } })
				}
				resource.value = parseInt(resource.value) + 1
				return ability.update({ system: { resources: [...ability.system.resources] } })
			}
			if (e.button === 2) {
				if (resource.value == 0) {
					return ui.notifications.info("Os pontos deste recurso já estão no mínimo");
				}
				if (e.shiftKey) {
					resource.value = parseInt(resource.value) - 5
					if (resource.value < 0) {
						resource.value = 0
					}
					return ability.update({ system: { resources: [...ability.system.resources] } })
				}
				if (e.ctrlKey) {
					resource.value = 0
					return ability.update({ system: { resources: [...ability.system.resources] } })
				}
				resource.value = parseInt(resource.value) - 1
				return ability.update({ system: { resources: [...ability.system.resources] } })
			}

		})
		html.find('.item-scroll-unseal-btn').click(e => {
			const itemId = e.target.closest(".item-card").getAttribute('data-item-id')
			const scroll = this.object.items.get(itemId)
			const scrollItems = scroll.system.scroll.scrollItemsComplete.map(item => {
				const newItem = item.data.toObject()
				newItem.system.quantity = item.quantity
				return newItem
			})
			for (let i = 0; i < scrollItems.length; i++) {
				const scrollItem = scrollItems[i];
				const parent = this.object
				const itemExists = parent.items.find(item => item.name == scrollItem.name)
				if (itemExists) {
					const newQt = itemExists.system.quantity + scrollItem.system.quantity
					itemExists.update({ system: { quantity: newQt } })
				} else {
					Item.create(scrollItem, { parent })
				}
			}
			const speaker = ChatMessage.getSpeaker({ actor: this.object });
			ChatMessage.create({
				speaker: speaker,
				flavor: `${this.object.name} removeu os itens selados de dentro do pergaminho: "${scroll.name}"`,
				content: `<span>Ele conseguiu os seguintes itens:</span> 
				${scrollItems.map(item => `<p style="display:flex; align-items:center"><img src="${item.img}" style="max-width: 35px; border: none"> ${item.name} (${item.system.quantity})</p>`).join("")} 
				`
			});
			scroll.update({ system: { scroll: { scrollItems: [] } } })
		})
		html.find('.range-option-icon-advantage-level').click(e => {
			const newAdvantageLevel = parseInt(e.target.querySelector('.value').innerText)
			this.object.update({ system: { advantageLevel: { actual: newAdvantageLevel } } })
			ChatMessage.create({
				speaker: ChatMessage.getSpeaker(),
				content: `${this.object.name} alterou seu NV para: ${newAdvantageLevel}`,
			});
		})
		html.find('.range-option-icon-momentum').click(e => {
			const newMomentum = parseInt(e.target.querySelector('.value').innerText)
			this.object.update({ system: { momentum: { actual: newMomentum } } })
			ChatMessage.create({
				speaker: ChatMessage.getSpeaker(),
				content: `${this.object.name} alterou seu momentum para: ${newMomentum}`,
			});
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
		const isNPCMove = item.system.isNpcMove;
		if (isNPCMove) {
			return item.moveRollNPC();
		}
		const isRollableMove = Object.values(item.system.attributes).find(
			(attribute) => attribute.on
		);
		if (!isRollableMove) {
			return item.moveRollJustSend();
		}

		RollMoveDialog.create(item)
	}

	_toggleItemDescriptionWindow(event) {
		const itemId = event.target.closest("li").getAttribute("data-item-id");
		const windowElement = event.target
			.closest("li")
			.querySelector(".description-window");
		const item = this.actor.items.get(itemId);
		const itemAttributes = item.system.attributes;
		const itemIsScroll = item.system.scroll.isScroll
		//if (windowElement.innerHTML.trim() === "") {
		if (windowElement.innerHTML.trim() === "") {
			windowElement.classList.add("description-window-opened");
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
			}).join('')}
				</ul>
				
				`
			windowElement.innerHTML += `
				<div class="item-description">
					${item.system.description}
				</div>
			`
			if (itemIsScroll) {
				windowElement.innerHTML += `
				<div class="item-scroll-items">
					<h3>Itens Selados:</h3>
					<ul class="item-scroll-items-list">
						${item.system.scroll.scrollItemsComplete.map(item => {
					return `
							<li class="scroll-item-card" data-item-id="{{item.data.id}}">
								<div class="info">
									<img src="${item.data.img}">
									<span>${item.data.name}</span>
									<div class="scroll-item-attributes">
										<i class="fa-solid fa-sack"></i> (${item.quantity})
										<span class="slots">
											<i class="fa-solid fa-weight-hanging"></i> (${(() => {
							const result = item.data.system.slots * item.quantity
							const roundedResult = Math.round(result * 100) / 100;
							return roundedResult
						})()
						})
										</span>
									</div>
								</div>
							</li>
							`
				}).join("")}
					</ul>
				</div>
				`
			}
			;
		} else {
			windowElement.classList.remove("description-window-opened");
			windowElement.innerHTML = "";
		}
	}
	_toggleAbilityDescriptionWindow(event) {
		const itemId = event.target.closest("li").getAttribute("data-item-id");
		const windowElement = event.target
			.closest("li")
			.querySelector(".description-window");
		const ability = this.actor.items.get(itemId);
		const abilityResources = ability.system.resources;
		if (windowElement.innerHTML.trim() === "") {
			windowElement.innerHTML = `
				<ul class="ability-resources-description-list">
					${abilityResources.map(resource => {
				console.log("attribute", resource)
				return `
							<li class="ability-resource-description-card" data-item-attribute-id="${resource.id}">
								<span><b>${resource.name}:</b></span>
								<span>${resource.value} / ${resource.maxValue}</span>
							</li>
						`
			}).join('')}
				</ul>
				<div class="item-description">
					${ability.system.description}
				</div>
			`
				;
		} else {
			windowElement.innerHTML = "";
		}
	}

	_getUsedSpace(items) {
		const total = items.reduce(
			(total, item) => {
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

	getAdvantageLevelRange(advantageLevel) {
		const range = []
		for (let i = advantageLevel.min; i <= advantageLevel.max; i++) {
			range.push({
				actual: advantageLevel.actual == i,
				value: i
			})
		}
		return range
	}
	getMomentumRange(momentum) {
		const range = []
		for (let i = momentum.min; i <= momentum.max; i++) {
			range.push({
				actual: momentum.actual == i,
				value: i
			})
		}
		return range
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
