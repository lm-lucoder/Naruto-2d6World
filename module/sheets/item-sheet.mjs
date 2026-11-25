import { ItemResourceManager } from "../classes/item-resource-manager.mjs";
import { NVModifierService } from "../services/nv-modifier-service.mjs";
import { NVModifierFormDialog } from "../dialogs/nvModifierFormDialog.mjs";
import ActivateAbilityDialog from "../dialogs/activateAbilityDialog.mjs";

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
		if (["technique", "effect"].includes(this.item.type)) return `${path}/item-sheet.html`;
		return `${path}/item-${this.item.type}-sheet.html`;
	}

	/* -------------------------------------------- */



	/** @override */
	async getData() {
		// Retrieve base data structure.
		const context = await super.getData();
		const itemData = context.item;
		context.system = itemData.system;
		context.flags = itemData.flags;
		context.isTechniqueOrEffect = ["technique", "effect"].includes(itemData.type);
		context.isEffect = itemData.type === "effect";
		if (context.isTechniqueOrEffect) {
			context.linkedMoves = await Promise.all((itemData.system.moves ?? []).map(async name => ({
				name, item: await this._resolveAbilityReference("move", name)
			})));
			context.activationNVModifiers = (itemData.system.nvModifiers ?? []).map((modifier, index) => ({
				...NVModifierService.normalize(modifier),
				index,
				attributeLabel: NVModifierService.getAttributeLabel(modifier),
				movementLabel: NVModifierService.getMovementLabel(modifier)
			}));
		}

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
			context.moveNVModifiers = (itemData.system.nvModifiers ?? []).map((modifier, index) => ({
				...NVModifierService.normalize(modifier),
				index,
				attributeLabel: NVModifierService.getAttributeLabel(modifier),
				movementLabel: NVModifierService.getMovementLabel(modifier)
			}));
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
		if (itemData.type === "ability") {
			context.hasActor = this.object.parent instanceof Actor;
			context.enrichedDescription = await TextEditor.enrichHTML(itemData.system.description ?? "", { documents: true, secrets: this.object.isOwner, relativeTo: this.object, rollData: context.rollData });
			context.allowTechniques = itemData.system.techniquesEnabled !== false;
			const level = Math.max(0, Number(itemData.system.level) || 0);
			context.techniques = await Promise.all((itemData.system.techniques ?? []).map(async (entry) => {
				const item = await this._resolveAbilityReference("technique", entry.name);
				return {
					...entry,
					item,
					enrichedDescription: item ? await TextEditor.enrichHTML(item.system.description ?? "", { documents: true, secrets: this.object.isOwner, relativeTo: item, rollData: context.rollData }) : "",
					acquired: Number(entry.level) <= level
				};
			}));
			const effectsPerLevel = Math.max(0, Math.floor(Number(itemData.system.effectsPerLevel) || 0));
			const displayLevels = Math.max(level, Number(itemData.system.maxLevel) || 0);
			const effectColumnLabel = index => {
				let label = "";
				for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
					label = String.fromCharCode(65 + (number - 1) % 26) + label;
				}
				return label;
			};
			context.effectColumns = Array.from({ length: effectsPerLevel }, (_, index) => ({ label: effectColumnLabel(index) }));
			context.effectRows = await Promise.all(Array.from({ length: displayLevels }, async (_, levelIndex) => {
				const slotLevel = levelIndex + 1;
				const available = slotLevel <= level;
				const slots = await Promise.all(context.effectColumns.map(async (_, columnIndex) => {
					const index = levelIndex * effectsPerLevel + columnIndex;
					const name = itemData.system.effectSlots?.[index] || "";
					return { index, level: slotLevel, available, name, item: await this._resolveAbilityReference("effect", name) };
				}));
				return { level: slotLevel, available, slots };
			}));
			const hasActiveTechnique = context.allowTechniques && context.techniques.some(entry => entry.acquired && entry.item?.system.canActivate === true);
			const hasActiveEffect = itemData.system.effectsEnabled && context.effectRows.some(row => row.available && row.slots.some(slot => slot.item && slot.item.system.canActivate !== false));
			context.showActivationButton = Boolean(itemData.system.canActivate && (hasActiveTechnique || hasActiveEffect));
		}

		console.log(context);
		return context;
	}

	async _resolveAbilityReference(type, name) {
		if (!name) return null;
		const worldItem = game.items.find(item => item.type === type && item.name === name);
		if (worldItem) return worldItem;
		for (const pack of game.packs.filter(pack => pack.documentName === "Item")) {
			try {
				const index = await pack.getIndex({ fields: ["type"] });
				const match = index.find(entry => entry.type === type && entry.name === name);
				if (match) return await pack.getDocument(match._id);
			} catch (error) {
				console.warn(`Não foi possível consultar ${pack.collection}`, error);
			}
		}
		return null;
	}
	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);
		html.find(".add-additional-cost").click(async () => {
			const additional = [...(this.object.system.cost?.additional ?? []), { id: randomID(7), name: "", amount: 0 }];
			await this.object.update({ "system.cost.additional": additional });
		});
		html.find(".remove-additional-cost").click(async event => {
			const id = event.currentTarget.closest("[data-cost-id]").dataset.costId;
			await this.object.update({ "system.cost.additional": (this.object.system.cost?.additional ?? []).filter(cost => cost.id !== id) });
		});
		html.find(".additional-cost-name, .additional-cost-amount").change(async event => {
			const id = event.currentTarget.closest("[data-cost-id]").dataset.costId;
			const field = event.currentTarget.classList.contains("additional-cost-name") ? "name" : "amount";
			const value = field === "name" ? event.currentTarget.value : Math.max(0, Number(event.currentTarget.value) || 0);
			const additional = (this.object.system.cost?.additional ?? []).map(cost => cost.id === id ? { ...cost, [field]: value } : cost);
			await this.object.update({ "system.cost.additional": additional });
		});
		html.find(".remove-linked-move").click(async event => {
			const name = event.currentTarget.closest("[data-move-name]").dataset.moveName;
			await this.object.update({ "system.moves": (this.object.system.moves ?? []).filter(move => move !== name) });
		});
		html.find(".activate-ability").click(() => {
			ActivateAbilityDialog.createForAbility(this.object);
		});
		html.find(".add-ability-technique").click(async () => {
			await this.object.update({ "system.techniques": [...(this.object.system.techniques ?? []), { id: randomID(7), level: 1, name: "" }] });
		});
		html.find(".ability-technique-level").change(async event => {
			const id = event.currentTarget.closest("[data-technique-id]").dataset.techniqueId;
			const techniques = (this.object.system.techniques ?? []).map(entry => entry.id === id
				? { ...entry, level: Math.max(1, Math.floor(Number(event.currentTarget.value) || 1)) } : entry);
			await this.object.update({ "system.techniques": techniques });
		});
		html.find(".remove-ability-technique").click(async event => {
			const id = event.currentTarget.closest("[data-technique-id]").dataset.techniqueId;
			await this.object.update({ "system.techniques": (this.object.system.techniques ?? []).filter(entry => entry.id !== id) });
		});
		const techniqueList = html.find(".ability-technique-config-list");
		const reorderType = "application/x-naruto-technique-order";
		const clearReorderStyles = () => techniqueList.find(".ability-reference-row").removeClass("is-dragging drag-over-before drag-over-after");
		techniqueList.find(".ability-technique-reorder-handle").on("dragstart", event => {
			const row = event.currentTarget.closest("[data-technique-index]");
			const transfer = event.originalEvent.dataTransfer;
			transfer.setData(reorderType, JSON.stringify({ abilityUuid: this.object.uuid, index: Number(row.dataset.techniqueIndex) }));
			transfer.effectAllowed = "move";
			row.classList.add("is-dragging");
		});
		techniqueList.find(".ability-technique-reorder-handle").on("dragend", clearReorderStyles);
		techniqueList.on("dragover", event => {
			if (!Array.from(event.originalEvent.dataTransfer.types).includes(reorderType)) return;
			const row = event.target.closest("[data-technique-index]");
			if (!row) return;
			event.preventDefault();
			event.originalEvent.dataTransfer.dropEffect = "move";
			techniqueList.find(".ability-reference-row").removeClass("drag-over-before drag-over-after");
			row.classList.add(event.originalEvent.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? "drag-over-before" : "drag-over-after");
		});
		techniqueList.on("drop", async event => {
			const payload = event.originalEvent.dataTransfer.getData(reorderType);
			if (!payload) return;
			event.preventDefault();
			event.stopPropagation();
			const row = event.target.closest("[data-technique-index]");
			clearReorderStyles();
			if (!row) return;
			let source;
			try { source = JSON.parse(payload); } catch { return; }
			if (source.abilityUuid !== this.object.uuid) return;
			const techniques = [...(this.object.system.techniques ?? [])];
			const sourceIndex = source.index;
			const targetIndex = Number(row.dataset.techniqueIndex);
			if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) || sourceIndex < 0 || sourceIndex >= techniques.length || targetIndex < 0 || targetIndex >= techniques.length) return;
			let insertAt = targetIndex + (event.originalEvent.clientY >= row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? 1 : 0);
			const [technique] = techniques.splice(sourceIndex, 1);
			if (sourceIndex < insertAt) insertAt--;
			techniques.splice(insertAt, 0, technique);
			if (insertAt !== sourceIndex) await this.object.update({ "system.techniques": techniques });
		});
		html.find(".clear-ability-effect").click(async event => {
			const index = Number(event.currentTarget.closest("[data-effect-slot]").dataset.effectSlot);
			const slots = [...(this.object.system.effectSlots ?? [])];
			slots[index] = null;
			await this.object.update({ "system.effectSlots": slots });
		});
		html.find(".ability-reference-open").click(event => {
			const name = event.currentTarget.dataset.name;
			const type = event.currentTarget.dataset.type;
			this._resolveAbilityReference(type, name).then(item => item?.sheet.render(true));
		});
		html.find(".ability-technique-send-chat").click(async event => {
			const name = event.currentTarget.dataset.name;
			const technique = await this._resolveAbilityReference("technique", name);
			if (technique) await technique.sendTechniqueToChat({ actor: this.object.parent instanceof Actor ? this.object.parent : null });
			else ui.notifications.warn(`${name} não foi encontrado.`);
		});

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

		html.find(".add-move-nv-modifier").click(() => this._addMoveNVModifier());
		html.find(".edit-move-nv-modifier").click((event) => this._editMoveNVModifier(Number(event.currentTarget.closest("[data-modifier-index]").dataset.modifierIndex)));
		html.find(".remove-move-nv-modifier").click((event) => this._removeMoveNVModifier(Number(event.currentTarget.closest("[data-modifier-index]").dataset.modifierIndex)));
		const activationOrigin = this.object.type === "effect" ? "do efeito" : "da técnica";
		html.find(".add-activation-nv-modifier").click(() => this._addMoveNVModifier(activationOrigin));
		html.find(".edit-activation-nv-modifier").click(event => this._editMoveNVModifier(Number(event.currentTarget.closest("[data-modifier-index]").dataset.modifierIndex), activationOrigin));
		html.find(".remove-activation-nv-modifier").click(event => this._removeMoveNVModifier(Number(event.currentTarget.closest("[data-modifier-index]").dataset.modifierIndex), activationOrigin));
	}

	async _addMoveNVModifier(origin = "do movimento") {
		const result = await NVModifierFormDialog.prompt({ title: `Adicionar NV ${origin}`, submitLabel: "Adicionar", actor: this.object.actor });
		if (!result) return;
		await this.object.update({ "system.nvModifiers": [...(this.object.system.nvModifiers ?? []), { id: randomID(), ...result }] });
	}

	async _editMoveNVModifier(index, origin = "do movimento") {
		const modifiers = [...(this.object.system.nvModifiers ?? [])];
		const modifier = modifiers[index];
		if (!modifier) return;
		const result = await NVModifierFormDialog.prompt({ title: `Editar NV ${origin}`, modifier, actor: this.object.actor });
		if (!result) return;
		modifiers[index] = { ...modifier, ...result, id: modifier.id || randomID() };
		await this.object.update({ "system.nvModifiers": modifiers });
	}

	async _removeMoveNVModifier(index, origin = "do movimento") {
		const modifiers = [...(this.object.system.nvModifiers ?? [])];
		const modifier = modifiers[index];
		if (!modifier) return;
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: `Remover NV ${origin}` },
			content: `<p>Remover <strong>${foundry.utils.escapeHTML(modifier.name || "Modificador de NV")}</strong> deste movimento?</p>`,
			yes: { label: "Remover", icon: "fa-solid fa-trash" },
			no: { label: "Cancelar" }
		});
		if (!confirmed) return;
		modifiers.splice(index, 1);
		await this.object.update({ "system.nvModifiers": modifiers });
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
			if (["technique", "effect"].includes(this.object.type) && e.target?.closest?.(".linked-moves-drop")) {
				e.preventDefault();
				e.stopPropagation();
				if (item.type !== "move") return ui.notifications.warn("Arraste um item do tipo Movimento.");
				const moves = this.object.system.moves ?? [];
				if (!moves.includes(item.name)) await this.object.update({ "system.moves": [...moves, item.name] });
				return false;
			}
			if (this.object.type === "ability") {
				const techniqueRow = e.target?.closest?.("[data-technique-id]");
				const effectRow = e.target?.closest?.("[data-effect-slot]");
				if (techniqueRow || effectRow) {
					e.preventDefault();
					e.stopPropagation();
					const expectedType = techniqueRow ? "technique" : "effect";
					if (item.type !== expectedType) {
						ui.notifications.warn(`Arraste um item do tipo ${expectedType === "technique" ? "Técnica" : "Efeito"}.`);
						return false;
					}
					if (techniqueRow) {
						const id = techniqueRow.dataset.techniqueId;
						const techniques = (this.object.system.techniques ?? []).map(entry => entry.id === id ? { ...entry, name: item.name } : entry);
						await this.object.update({ "system.techniques": techniques });
					} else {
						if (effectRow.dataset.effectAvailable !== "true") {
							ui.notifications.warn("Este slot de efeito ainda não foi liberado.");
							return false;
						}
						const tags = value => String(value ?? "").split(";").map(tag => tag.trim().toLocaleLowerCase("pt-BR")).filter(Boolean);
						const acceptedTags = tags(this.object.system.effectTags);
						const effect = await this._resolveAbilityReference("effect", item.name) ?? item;
						if (acceptedTags.length && !tags(effect.system.tags).some(tag => acceptedTags.includes(tag))) {
							ui.notifications.warn("Este efeito não possui uma tag aceita por esta habilidade.");
							return false;
						}
						const index = Number(effectRow.dataset.effectSlot);
						const slots = [...(this.object.system.effectSlots ?? [])];
						slots[index] = item.name;
						await this.object.update({ "system.effectSlots": slots });
					}
					return false;
				}
			}

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
