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
	async _onDrop(e) {
		const data = TextEditor.getDragEventData(e);
		if (data.type == "Item") {
			// Usar fromDropData para funcionar tanto com world items quanto owned items
			const item = await Item.fromDropData(data);
			if (!item) return;

			if (item.type === "item") {
				const scrollList = e.target?.closest?.(".scroll-items-list");
				if (scrollList) {
					// Prevenir o comportamento padrão do drop
					e.preventDefault();
					e.stopPropagation();
					// Adicionar ao scroll (isso vai remover do ator se necessário)
					await this.ScrollAPI.add(item, this.object);
					return false;
				}
			}
		}
	}
	ScrollAPI = ScrollAPI
}

class ScrollAPI {
	static async add(item, scroll) {
		console.log(scroll)
		const scrollItems = scroll.system.scroll.scrollItems

		// Se o item pertence a um ator, capturar a quantidade antes de processar
		const itemParent = item.parent;
		const isOwnedItem = itemParent && itemParent instanceof Actor;
		const itemQuantity = isOwnedItem ? (item.system.quantity || 1) : 1;

		const itemSlotsWeight = item.system.slots;
		const totalSlotsNeeded = itemSlotsWeight * itemQuantity;
		const canAdd = (scroll.system.scroll.scrollUsedSlots + totalSlotsNeeded) <= scroll.system.scroll.scrollMaxSlots
		if (!canAdd) return ui.notifications.info(`Não é possível adicionar! Isso iria extrapolar o limite de espaço do pergaminho`);

		let itemToUse = item;

		if (isOwnedItem) {
			// Verificar se já existe um item com o mesmo nome no mundo
			const existingWorldItem = game.items.find(worldItem => worldItem.name === item.name && worldItem.type === item.type);
			
			if (existingWorldItem) {
				// Usar o item existente do mundo
				itemToUse = existingWorldItem;
			} else {
				// Criar uma cópia do item como world item
				const itemData = item.toObject();
				// Remover o _id para criar um novo item
				delete itemData._id;
				// Criar o item como world item (sem parent)
				const worldItem = await Item.create(itemData);
				itemToUse = worldItem;
			}

			// Remover o item owned do ator
			await item.delete();
		}

		const itemAlreadyExists = scrollItems.find(scrollItem => scrollItem.id == itemToUse.id)
		if (itemAlreadyExists) {
			itemAlreadyExists.quantity += itemQuantity
		} else {
			scrollItems.push({
				quantity: itemQuantity,
				id: itemToUse.id
			})
		}
		await scroll.update({ system: { scroll: { scrollItems: [...scrollItems] } } });

		// Criar mensagem de chat
		const scrollParent = scroll.parent;
		const speaker = scrollParent ? ChatMessage.getSpeaker({ actor: scrollParent }) : ChatMessage.getSpeaker();
		ChatMessage.create({
			speaker: speaker,
			flavor: `${scrollParent ? scrollParent.name : "Alguém"} selou um item no pergaminho: "${scroll.name}"`,
			content: `<span>O seguinte item foi selado:</span> 
			<p style="display:flex; align-items:center"><img src="${itemToUse.img}" style="max-width: 35px; border: none"> ${itemToUse.name} (${itemQuantity})</p>
			`
		});
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
