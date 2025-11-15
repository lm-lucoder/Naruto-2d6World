import { ItemResourceManager } from "../classes/item-resource-manager.mjs";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class BoilerplateItemSheet extends ItemSheet {
	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ["boilerplate", "sheet", "item"],
			width: 520,
			height: 480,
			tabs: [
				{
					navSelector: ".sheet-tabs",
					contentSelector: ".sheet-body",
					initial: "description",
				},
			],
			dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
		});
	}

	/** @override */
	get template() {
		const path = "systems/naruto2d6world/templates/item";
		// Return a single sheet for all item types.
		// return `${path}/item-sheet.html`;

		// Alternatively, you could use the following return statement to do a
		// unique item sheet by type, like `weapon-sheet.html`.
		return `${path}/item-${this.item.type}-sheet.html`;
	}

	/* -------------------------------------------- */



	/** @override */
	getData() {
		// Retrieve base data structure.
		const context = super.getData();
		const itemData = context.item;
		context.system = itemData.system;
		context.flags = itemData.flags;

		// Retrieve the roll data for TinyMCE editors.
		context.rollData = {};
		let actor = this.object?.parent ?? null;
		if (actor) {
			context.rollData = actor.getRollData();
		}
		if (itemData.type === "item") {
			if (itemData.system.scroll.isScroll) {
				context.scrollItems = itemData.system.scroll.scrollItemsComplete
			}
		}

		if (itemData.type === "move") {

		}
		if (itemData.type === "skill") {
			const rankChoices = {
				"0": "Academia",
				"1": "Genin",
				"2": "Chunin",
				"3": "Jounin Especial",
				"4": "Jounin",
				"5": "Kage"
			}
			context.rankChoices = rankChoices;
		}

		console.log(context);
		return context;
	}
	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		html.find(".add-condition-move-config").click(async (ev) => {
			this._addNewCondition_MoveConfig();
		});
		html.find(".remove-condition-move-config").click(async (ev) => {
			this._removeCondition_MoveConfig(ev);
		});
		html.find(".rank-choice-select").change((ev) => {
			const value = parseInt(ev.target.value);
			this.object.update({ system: { rank: { value } } });
		});
		html.find(".level-input").change(async (ev) => {
			// Quando o nível mudar, recalcula os recursos
			if (this.object.type === "ability") {
				await this.object.update({ system: { level: parseInt(ev.target.value) || 1 } });
				ItemResourceManager.recalculateAllResources(this.object);
			}
		});
		html.find(".add-level-description-btn").click(async (ev) => {
			const levelDescriptions = this.object.system.levelDescriptions
			levelDescriptions.push({ level: 0, description: "", id: randomID(7) })
			this.object.update({ system: { levelDescriptions: levelDescriptions } });
		})
		html.find(".level-description-input").blur(async (ev) => {
			const inputObjective = ev.target.getAttribute("data-input-objective")
			const levelDescriptionId = ev.target.closest("li").getAttribute("data-item-id")
			const levelDescriptions = this.object.system.levelDescriptions
			const levelDescription = levelDescriptions.find(element => element.id === levelDescriptionId)
			levelDescription[inputObjective] = ev.target.value
			this.object.update({ system: { levelDescriptions: [...levelDescriptions] } });
		})
		html.find(".level-description-remove-btn").click(async (ev) => {
			const levelDescriptionId = ev.target.closest("li").getAttribute("data-item-id")
			const levelDescriptions = this.object.system.levelDescriptions
			const toRemoveIndex = levelDescriptions.findIndex(element => element.id === levelDescriptionId)
			levelDescriptions.splice(toRemoveIndex, 1)
			this.object.update({ system: { levelDescriptions: [...levelDescriptions] } });
		})

		html.find(".add-item-attribute").click(async (ev) => {
			const attributes = this.object.system.attributes
			attributes.push({ name: "New Attribute", value: 0, maxValue: 0, id: randomID(7) })
			this.object.update({ system: { attributes } });
		})
		html.find(".item-attribute-remove-btn").click(async (ev) => {
			const id = ev.target.closest("li").getAttribute("data-item-id")
			const attributes = this.object.system.attributes
			const toRemoveIndex = attributes.findIndex(element => element.id === id)
			attributes.splice(toRemoveIndex, 1)
			this.object.update({ system: { attributes: [...attributes] } });
		})
		html.find(".item-attribute-input").blur(async (ev) => {
			const inputObjective = ev.target.getAttribute("data-input-objective")
			const id = ev.target.closest("li").getAttribute("data-item-id")
			const attributes = this.object.system.attributes
			const attribute = attributes.find(element => element.id === id)
			attribute[inputObjective] = ev.target.value
			this.object.update({ system: { attributes: [...attributes] } });
		})

		html.find(".add-ability-resource").click(async (ev) => {
			ItemResourceManager.addResource(this.object);
		})
		html.find(".ability-resource-remove-btn").click(async (ev) => {
			const id = ev.target.closest("li").getAttribute("data-item-id");
			ItemResourceManager.removeResource(this.object, id);
		})
		html.find(".ability-resource-input").blur(async (ev) => {
			const inputObjective = ev.target.getAttribute("data-input-objective");
			const id = ev.target.closest("li").getAttribute("data-item-id");
			ItemResourceManager.updateResourceField(this.object, id, inputObjective, ev.target.value);
		})
		html.find(".ability-resource-card-checkbox").change(async (e) => {
			const id = e.target.closest("li").getAttribute("data-item-id");
			ItemResourceManager.toggleResourceVisibility(this.object, id, e.target.checked);
		})
		html.find(".scroll-item-quantity").mousedown(async (e) => {
			const scroll = this.object
			const itemId = e.target.closest(".scroll-item-card").dataset.itemId
			if (e.button === 0) {
				if (e.shiftKey) {
					this.ScrollAPI.changeItemQt(scroll, itemId, 5)
					return
				}
				this.ScrollAPI.changeItemQt(scroll, itemId, 1)
			}
			if (e.button === 2) {
				if (e.shiftKey) {
					this.ScrollAPI.changeItemQt(scroll, itemId, -5)
					return
				}
				this.ScrollAPI.changeItemQt(scroll, itemId, -1)
			}
		})
		html.find(".scroll-item-delete").mousedown(async (e) => {
			const scroll = this.object
			const itemId = e.target.closest(".scroll-item-card").dataset.itemId
			this.ScrollAPI.deleteItem(scroll, itemId)
		})

		// Everything below here is only needed if the sheet is editable
		if (!this.isEditable) return;

		// Roll handlers, click handlers, etc. would go here.
	}

	_addNewCondition_MoveConfig() {
		const itemCondition = this.object;
		const newMoveConfig = {
			id: randomID(7),
			moveName: "",
			attributes: {
				bod: { value: 0, ref: "bod", name: "Físico" },
				agl: { value: 0, ref: "agl", name: "Agilidade" },
				hrt: { value: 0, ref: "hrt", name: "Coração" },
				shd: { value: 0, ref: "shd", name: "Sombra" },
				cun: { value: 0, ref: "cun", name: "Astúcia" }
			},
		};
		// if(itemCondition.system?.movesConfigs){
		// } else {
		//   itemCondition.update({system: {movesConfigs: [newMoveConfig]}})
		// }
		itemCondition.update({
			system: { movesConfigs: { [newMoveConfig.id]: newMoveConfig } },
		});
	}
	_removeCondition_MoveConfig(ev) {
		const id = ev.target
			.closest(".condition-moves-config-card")
			.getAttribute("data-id");
		const movesConfigsObj = this.object.system.movesConfigs;
		delete movesConfigsObj[id];
		this.object.update({ system: { movesConfigs: false } });
		this.object.update({
			system: { movesConfigs: { ...movesConfigsObj } },
		});
	}
	_onDrop(e) {
		const data = TextEditor.getDragEventData(e);
		if (data.type == "Item") {
			const item = Item.get(data.uuid.split('.')[1])

			if (item.type === "item") {
				if (e.target.closest(".scroll-items-list")) {
					this.ScrollAPI.add(item, this.object)
				}
			}
			//console.log(e, data, item)
		}
	}
	ScrollAPI = ScrollAPI
}

class ScrollAPI {
	static add(item, scroll) {
		console.log(scroll)
		const scrollItems = scroll.system.scroll.scrollItems
		const itemSlotsWeight = item.system.slots;
		const canAdd = (scroll.system.scroll.scrollUsedSlots + itemSlotsWeight) <= scroll.system.scroll.scrollMaxSlots
		if (!canAdd) return ui.notifications.info(`Não é possível adicionar! Isso iria extrapolar o limite de espaço do pergaminho`);
		const itemAlreadyExists = scrollItems.find(scrollItem => scrollItem.id == item.id)
		if (itemAlreadyExists) {
			itemAlreadyExists.quantity += 1
		} else {
			scrollItems.push({
				quantity: 1,
				id: item.id
			})
		}
		scroll.update({ system: { scroll: { scrollItems: [...scrollItems] } } })
	}
	static changeItemQt(scroll, itemId, sum) {
		console.log(scroll)
		const scrollUsedSlots = scroll.system.scroll.scrollUsedSlots
		const scrollCapacity = scroll.system.scroll.scrollMaxSlots
		const scrollItems = scroll.system.scroll.scrollItems
		const item = scrollItems.find(item => item.id === itemId)
		const itemQuantity = item.quantity
		const result = itemQuantity + sum
		if (sum > 0) {
			console.log(itemQuantity)
			console.log(result)
			console.log(scrollCapacity)
			if (scrollUsedSlots >= scrollCapacity) {
				return ui.notifications.info(`Não é possível alterar a quantidade! Isso iria extrapolar o limite de espaço do pergaminho`);
			}
		}
		if (result < 0) {
			item.quantity = 0
			return scroll.update({ system: { scroll: { scrollItems: [...scrollItems] } } })
		}
		item.quantity = parseInt(item.quantity) + sum
		scroll.update({ system: { scroll: { scrollItems: [...scrollItems] } } })
	}
	static deleteItem(scroll, itemId) {
		const scrollItems = scroll.system.scroll.scrollItems
		const itemIndex = scrollItems.findIndex(item => item.id === itemId)
		scrollItems.splice(itemIndex, 1)
		scroll.update({ system: { scroll: { scrollItems: [...scrollItems] } } })
	}
}
