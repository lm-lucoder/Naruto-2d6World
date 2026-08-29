import ManageAbilityChakraDialog from "../dialogs/manageAbilityChakraDialog.mjs";
import ManageAbilityResourceDialog from "../dialogs/manageAbilityResourceDialog.mjs";
import ManageItemQuantityDialog from "../dialogs/manageItemQuantityDialog.mjs";
import ManageNVModifiersDialog from "../dialogs/manageNVModifiersDialog.mjs";
import RollMoveDialog from "../dialogs/rollMoveDialog.mjs";
import UpgradeNPCMoveDialog from "../dialogs/upgradeNPCMoveDialog.mjs";
import {
	onManageActiveEffect,
	prepareActiveEffectCategories,
} from "../helpers/effects.mjs";
import { ItemResourceManager } from "../classes/item-resource-manager.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class BoilerplateActorSheet extends ActorSheet {
	constructor(...args) {
		super(...args);

		// Sets para rastrear quais elementos têm descrições expandidas
		this._expandedItems = new Set();
		this._expandedAbilities = new Set();
		this._expandedMoves = new Set();
	}

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
	async _onDropItem(e, data) {
		// Verificar se o drop está acontecendo em uma região de scroll do item-sheet
		// Se sim, não processar aqui (deixar o item-sheet tratar)
		const scrollList = e.target?.closest?.(".scroll-items-list");
		if (scrollList) {
			// Verificar se está em uma janela de item-sheet (não no próprio actor-sheet)
			const itemSheet = scrollList.closest(".item-sheet");
			if (itemSheet) {
				return false; // Deixar o item-sheet processar
			}
		}

		// Verificar se o drop está na região de scroll dentro da descrição do item no actor-sheet
		const itemScrollList = e.target?.closest?.(".item-scroll-items-list");
		if (itemScrollList) {
			// Esta é a região de scroll dentro da descrição do item no actor-sheet
			// Processar o drop para adicionar ao pergaminho
			if (data.type === "Item") {
				// Encontrar qual pergaminho está aberto
				// Primeiro tenta pegar de um scroll-item-card existente
				let scrollId = null;
				const scrollItemCard = itemScrollList.querySelector(".scroll-item-card");
				if (scrollItemCard) {
					scrollId = scrollItemCard.getAttribute('data-scroll-id');
				} else {
					// Se não houver scroll-item-card (lista vazia), pega do elemento pai que contém o item
					const scrollItemElement = itemScrollList.closest("li.item");
					if (scrollItemElement) {
						scrollId = scrollItemElement.getAttribute('data-item-id');
					}
				}

				if (scrollId) {
					const scroll = this.object.items.get(scrollId);
					if (scroll && scroll.system.scroll.isScroll) {
						// Usar fromDropData para funcionar tanto com world items quanto owned items
						const item = await Item.fromDropData(data);
						if (item && item.type === "item") {
							// Prevenir o comportamento padrão do drop
							e.preventDefault();
							e.stopPropagation();
							// Adicionar ao scroll usando a mesma lógica do item-sheet
							await this._addItemToScroll(item, scroll);
							// Recarregar a janela de descrição para atualizar a lista
							const scrollItemElement = itemScrollList.closest("li.item");
							if (scrollItemElement) {
								const event = new Event('click');
								scrollItemElement.querySelector('.show-item-description-window-btn').dispatchEvent(event);
							}
							return false;
						}
					}
				}
			}
			return false;
		}

		if (data.type === "Item" && e.ctrlKey) {
			const itemId = data.uuid.split(".")[1]
			const itemName = Item.get(itemId).name
			const actorItem = this.object.items.find(item => item.name == itemName)
			if (actorItem) {
				return actorItem.updateQuantity(1)
			}
		}

		// Verificar se o item já pertence ao ator e se o data não tem id
		// Isso acontece quando arrasta um item que já pertence ao ator
		// e o FoundryVTT tenta fazer um sort, mas o data não tem a estrutura correta
		if (data.type === "Item" && !data.id) {
			const itemId = data.uuid?.split(".")[1];
			if (itemId) {
				const item = Item.get(itemId);
				// Se o item já pertence ao ator e não está sendo arrastado para scroll, não fazer sort (vai dar erro)
				if (item && item.parent === this.actor) {
					// Verificar novamente se não está em uma região de scroll
					const isInScroll = e.target?.closest?.(".scroll-items-list") || e.target?.closest?.(".item-scroll-items-list");
					if (!isInScroll) {
						return false;
					}
				}
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
		context.user = game.user

		if (actorData.type == "character") {
			this._prepareCharacterItems(context);
			await this._prepareCharacterData(context);
		}

		if (actorData.type == "npc") {
			this._prepareCharacterItems(context);
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
		context.momentum = this.object.system.momentum
		context.momentum.range = this.getMomentumRange(context.momentum)

		AdvantageLevelApi.buildAdvantageLevelContext(context)

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
				// Preparar dados da condição com modificadores e NVs
				this._prepareConditionData(item);
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

		console.log(context);
	}
	_prepareNPCItems(context) {
		const conditions = [];
		const moves = [];
		for (let item of context.items) {
			item.img = item.img || DEFAULT_TOKEN;
			if (item.type === "condition") {
				// Preparar dados da condição com modificadores e NVs
				this._prepareConditionData(item);
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
	async _render(force, options) {
		await super._render(force, options);
		// Restaurar estado das descrições expandidas após renderização
		this._restoreExpandedDescriptions();
	}

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
		html.find(".item-delete").click(async (ev) => {
			const li = $(ev.currentTarget).parents(".item");
			const itemId = li.data("itemId");
			const item = this.actor.items.get(itemId);

			if (!item) return;

			if (ev.shiftKey) {
				item.delete();
				li.slideUp(200, () => this.render(false));
				return;
			}
			await Dialog.confirm({
				title: "Confirmar Exclusão",
				content: `<p>Deseja realmente deletar <strong>${item.name}</strong>?</p>`,
				yes: () => {
					item.delete();
					li.slideUp(200, () => this.render(false));
				},
				defaultYes: false
			});
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
		html.find(".show-move-description-window-btn").click((event) => {
			this._toggleMoveDescriptionWindow(event);
		});
		html.find(".item-quantity-manage-btn").click((event) => {
			const itemId = event.target.closest("li").getAttribute("data-item-id");
			const item = this.object.items.get(itemId);
			if (item && item.type === "item") {
				ManageItemQuantityDialog.create({ item: item });
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
				return ManageAbilityChakraDialog.create({ ability: item })
			}
			if (e.button === 0 && game.user.isGM) {
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
			if (e.button === 2 && game.user.isGM) {
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
			const abilityId = e.target.closest(".item").getAttribute('data-item-id');
			const ability = this.object.items.get(abilityId);
			const resourceId = e.target.closest(".ability-resource-tag").getAttribute("data-resource-id");
			const resource = ability.system.resources.find(resource => resource.id == resourceId);

			// Se clicou no valor (span.data), abre o dialog
			if (e.target.classList.contains("data") || e.target.closest(".data")) {
				return ManageAbilityResourceDialog.create({ ability: ability, resource: resource });
			}

			// Comportamento padrão para aumentar/diminuir
			if (e.button === 0 && game.user.isGM) {
				if (e.shiftKey) {
					return ItemResourceManager.increaseResourceValue(ability, resourceId, 5);
				}
				if (e.ctrlKey) {
					return ItemResourceManager.setResourceToMax(ability, resourceId);
				}
				return ItemResourceManager.increaseResourceValue(ability, resourceId, 1);
			}
			if (e.button === 2 && game.user.isGM) {
				if (e.shiftKey) {
					return ItemResourceManager.decreaseResourceValue(ability, resourceId, 5);
				}
				if (e.ctrlKey) {
					return ItemResourceManager.setResourceToZero(ability, resourceId);
				}
				return ItemResourceManager.decreaseResourceValue(ability, resourceId, 1);
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
				flavor: `${this.object.name} liberou todos os itens do pergaminho: "${scroll.name}"`,
				content: `<span>Os seguintes itens foram liberados:</span> 
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
		html.find('.move-card-number-change').mousedown(e => {
			const moveId = e.target.closest(".move-card").getAttribute('data-item-id');
			const reference = e.target.getAttribute('data-number-reference');
			const move = this.object.items.get(moveId)
			const attributePath = "system." + reference
			if (e.button === 0) {
				// Clique esquerdo
				const actualValue = this._getByPath(move, attributePath);
				move.update({ [attributePath]: +actualValue + 1 })
			}
			if (e.button === 2) {
				// Clique direito
				const actualValue = this._getByPath(move, attributePath);
				move.update({ [attributePath]: +actualValue - 1 })
			}
		});
		html.find('.item-npc-movement-reload-uses').click(e => {
			const moveId = e.target.closest(".move-card").getAttribute('data-item-id');
			const move = this.object.items.get(moveId);
			move.reloadNPCMoveUses(e.shiftKey);
		})
		html.find('.iniciativa-checkbox').change(e => {
			const isChecked = e.target.checked;
			this.object.update({ "system.iniciativa": isChecked });
			if (isChecked) {
				const speaker = ChatMessage.getSpeaker({ actor: this.object }).alias;
				ChatMessage.create({
					speaker: speaker,
					content: `${this.object.name} declarou iniciativa!`,
				});
			} else {
				const speaker = ChatMessage.getSpeaker({ actor: this.object }).alias;
				ChatMessage.create({
					speaker: speaker,
					content: `${this.object.name} perdeu a iniciativa!`,
				});
			}
		})
		html.find('.btn-increase-advantage-level').click(e => {
			this.object.update({ "system.advantageLevel.actual": this.object.system.advantageLevel.actual + 1 })
		})
		html.find('.btn-decrease-advantage-level').click(e => {
			this.object.update({ "system.advantageLevel.actual": this.object.system.advantageLevel.actual - 1 })
		})
		html.find('.advantage-level-display').on('click keydown', (event) => {
			if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
			event.preventDefault();
			ManageNVModifiersDialog.create({ actor: this.actor });
		})
		html.find('.btn-increase-speed-level').click(e => {
			this.object.update({ "system.speed_level": (this.object.system.speed_level ?? 0) + 1 })
		})
		html.find('.btn-decrease-speed-level').click(e => {
			this.object.update({ "system.speed_level": (this.object.system.speed_level ?? 0) - 1 })
		})
		// Botão de upgrade de movimentos de NPC
		html.find('#btn-upgrade-npc-moves').click((e) => {
			e.preventDefault();
			UpgradeNPCMoveDialog.create({ actor: this.actor });
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
			// Adicionar ao Set de itens expandidos
			this._expandedItems.add(itemId);

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
				const hasScrollItems = item.system.scroll.scrollItemsComplete && item.system.scroll.scrollItemsComplete.length > 0;

				if (hasScrollItems) {
					windowElement.innerHTML += `
				<div class="item-scroll-items">
					<h3>Itens Selados:</h3>
					<ul class="item-scroll-items-list">
						${item.system.scroll.scrollItemsComplete.map(scrollItem => {
						return `
							<li class="scroll-item-card" data-item-id="${scrollItem.data.id}" data-scroll-id="${itemId}">
								<div class="info">
									<img src="${scrollItem.data.img}">
									<span>${scrollItem.data.name}</span>
									<div class="scroll-item-attributes">
										<i class="fa-solid fa-sack"></i> (${scrollItem.quantity})
										<span class="slots">
											<i class="fa-solid fa-weight-hanging"></i> (${(() => {
								const result = scrollItem.data.system.slots * scrollItem.quantity
								const roundedResult = Math.round(result * 100) / 100;
								return roundedResult
							})()
							})
										</span>
									</div>
								</div>
								<div class="control">
									<a class="scroll-item-unseal-btn"><i class="fa-solid fa-unlock"></i> Liberar</a>
								</div>
							</li>
							`
					}).join("")}
					</ul>
				</div>
				`
					// Adicionar listener para os botões Unseal criados dinamicamente
					windowElement.querySelectorAll('.scroll-item-unseal-btn').forEach(btn => {
						btn.addEventListener('click', async (e) => {
							const scrollItemCard = e.target.closest(".scroll-item-card");
							const scrollItemId = scrollItemCard.getAttribute('data-item-id');
							const scrollId = scrollItemCard.getAttribute('data-scroll-id');
							const scroll = this.object.items.get(scrollId);

							if (!scroll || !scrollItemId) return;

							// Encontrar o item no pergaminho
							const scrollItems = scroll.system.scroll.scrollItems;
							const scrollItemIndex = scrollItems.findIndex(item => item.id === scrollItemId);

							if (scrollItemIndex === -1) return;

							const scrollItem = scrollItems[scrollItemIndex];
							const worldItem = Item.get(scrollItemId);

							if (!worldItem) {
								return ui.notifications.error("Item não encontrado no mundo!");
							}

							// Criar uma cópia do item para o ator
							const itemData = worldItem.toObject();
							delete itemData._id;
							itemData.system.quantity = scrollItem.quantity;

							// Verificar se o ator já tem um item com o mesmo nome
							const existingItem = this.object.items.find(item => item.name === worldItem.name);

							if (existingItem) {
								// Se já existe, apenas aumentar a quantidade
								const newQuantity = existingItem.system.quantity + scrollItem.quantity;
								await existingItem.update({ system: { quantity: newQuantity } });
							} else {
								// Se não existe, criar novo item
								await Item.create(itemData, { parent: this.object });
							}

							// Remover do pergaminho
							scrollItems.splice(scrollItemIndex, 1);
							await scroll.update({ system: { scroll: { scrollItems: [...scrollItems] } } });

							// Criar mensagem de chat
							const speaker = ChatMessage.getSpeaker({ actor: this.object });
							ChatMessage.create({
								speaker: speaker,
								flavor: `${this.object.name} liberou um item do pergaminho: "${scroll.name}"`,
								content: `<span>O seguinte item foi liberado:</span> 
							<p style="display:flex; align-items:center"><img src="${worldItem.img}" style="max-width: 35px; border: none"> ${worldItem.name} (${scrollItem.quantity})</p>
							`
							});

							// Recarregar a janela de descrição
							const scrollItemElement = scrollItemCard.closest("li.item");
							if (scrollItemElement) {
								const event = new Event('click');
								scrollItemElement.querySelector('.show-item-description-window-btn').dispatchEvent(event);
							}

							ui.notifications.info(`${worldItem.name} foi removido do pergaminho e adicionado ao inventário!`);
						});
					});
				} else {
					windowElement.innerHTML += `
				<div class="item-scroll-items">
					<h3>Itens Selados:</h3>
					<p class="empty-scroll-message item-scroll-items-list">Ainda não há itens neste pergaminho. Arraste aqui um item da sua ficha para selar dentro do pergaminho.</p>
				</div>
				`
				}
			}
			;
		} else {
			// Remover do Set de itens expandidos
			this._expandedItems.delete(itemId);

			windowElement.classList.remove("description-window-opened");
			windowElement.innerHTML = "";
		}
	}

	/**
	 * Adiciona um item ao pergaminho (similar ao ScrollAPI.add do item-sheet)
	 * @param {Item} item - O item a ser adicionado
	 * @param {Item} scroll - O pergaminho onde o item será adicionado
	 */
	async _addItemToScroll(item, scroll) {
		const scrollItems = scroll.system.scroll.scrollItems;

		// Se o item pertence a um ator, capturar a quantidade antes de processar
		const itemParent = item.parent;
		const isOwnedItem = itemParent && itemParent instanceof Actor;
		const itemQuantity = isOwnedItem ? (item.system.quantity || 1) : 1;

		const itemSlotsWeight = item.system.slots;
		const totalSlotsNeeded = itemSlotsWeight * itemQuantity;
		const canAdd = (scroll.system.scroll.scrollUsedSlots + totalSlotsNeeded) <= scroll.system.scroll.scrollMaxSlots
		if (!canAdd) {
			ui.notifications.info(`Não é possível adicionar! Isso iria extrapolar o limite de espaço do pergaminho`);
			return;
		}

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
		const speaker = ChatMessage.getSpeaker({ actor: this.object });
		ChatMessage.create({
			speaker: speaker,
			flavor: `${this.object.name} selou um item no pergaminho: "${scroll.name}"`,
			content: `<span>O seguinte item foi selado:</span> 
			<p style="display:flex; align-items:center"><img src="${itemToUse.img}" style="max-width: 35px; border: none"> ${itemToUse.name} (${itemQuantity})</p>
			`
		});
	}

	_toggleMoveDescriptionWindow(event) {
		const itemId = event.target.closest("li").getAttribute("data-item-id");
		const windowElement = event.target
			.closest("li")
			.querySelector(".description-window");
		const move = this.actor.items.get(itemId);
		if (windowElement.innerHTML.trim() === "") {
			// Adicionar ao Set de moves expandidos
			this._expandedMoves.add(itemId);

			windowElement.innerHTML = `
				<div class="item-description">
					${move.system.description}
				</div>
			`;
		} else {
			// Remover do Set de moves expandidos
			this._expandedMoves.delete(itemId);

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
			// Adicionar ao Set de abilities expandidas
			this._expandedAbilities.add(itemId);

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
			// Remover do Set de abilities expandidas
			this._expandedAbilities.delete(itemId);

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

	_getByPath(obj, path) {
		return path.split('.').reduce((acc, part) => acc && acc[part], obj);
	}

	/**
	 * Prepara os dados da condição para exibição, extraindo apenas atributos com modificadores ou NVs
	 * @param {Object} condition - A condição a ser preparada
	 */
	_prepareConditionData(condition) {
		const attributeNames = {
			bod: "Fís",
			agl: "Agl",
			hrt: "Cor",
			shd: "Som",
			cun: "Ast"
		};

		condition.effects = [];

		// Adicionar valores globais se existirem
		const globalMod = parseInt(condition.system?.globalMod) || 0;
		const globalNV = parseInt(condition.system?.globalNV) || 0;

		if (globalMod !== 0 || globalNV !== 0) {
			condition.effects.push({
				name: "Global",
				mod: globalMod !== 0 ? globalMod : null,
				nv: globalNV !== 0 ? globalNV : null,
				isGlobal: true
			});
		}

		// Adicionar valores específicos por atributo
		if (condition.system?.attributes) {
			for (const [attrKey, attrData] of Object.entries(condition.system.attributes)) {
				const mod = parseInt(attrData.mod) || 0;
				const nv = parseInt(attrData.nv) || 0;

				// Só adiciona se tiver mod ou nv diferente de zero
				if (mod !== 0 || nv !== 0) {
					condition.effects.push({
						name: attributeNames[attrKey] || attrKey,
						mod: mod !== 0 ? mod : null, // null para não mostrar no template
						nv: nv !== 0 ? nv : null
					});
				}
			}
		}
	}

	/**
	 * Restaura o estado das descrições expandidas após a re-renderização
	 * @private
	 */
	_restoreExpandedDescriptions() {
		if (!this.element || !this.element.length) return;

		// Restaurar itens expandidos
		this._expandedItems.forEach(itemId => {
			// Verificar se o item ainda existe no ator
			if (!this.actor.items.get(itemId)) {
				this._expandedItems.delete(itemId);
				return;
			}

			const itemElement = this.element.find(`li.item[data-item-id="${itemId}"]`);
			if (itemElement.length) {
				const btn = itemElement.find('.show-item-description-window-btn');
				if (btn.length) {
					// Simular clique para abrir a descrição
					btn[0].click();
				}
			}
		});

		// Restaurar abilities expandidas
		this._expandedAbilities.forEach(abilityId => {
			// Verificar se a ability ainda existe no ator
			if (!this.actor.items.get(abilityId)) {
				this._expandedAbilities.delete(abilityId);
				return;
			}

			const abilityElement = this.element.find(`li.item[data-item-id="${abilityId}"]`);
			if (abilityElement.length) {
				const btn = abilityElement.find('.show-ability-description-window-btn');
				if (btn.length) {
					btn[0].click();
				}
			}
		});

		// Restaurar moves expandidos
		this._expandedMoves.forEach(moveId => {
			// Verificar se o move ainda existe no ator
			if (!this.actor.items.get(moveId)) {
				this._expandedMoves.delete(moveId);
				return;
			}

			const moveElement = this.element.find(`li.item[data-item-id="${moveId}"]`);
			if (moveElement.length) {
				const btn = moveElement.find('.show-move-description-window-btn');
				if (btn.length) {
					btn[0].click();
				}
			}
		});
	}

}

export class AdvantageLevelApi {
	static buildAdvantageLevelContext(context) {
		const baseLevel = context.actor.system.advantageLevel.actual;
		context.actualAdvantageLevel = {
			value: 0,
			reasons: []
		}
		this.addAdvantageLevelContext(context, baseLevel, "Base")
		for (const modifier of context.actor.system.nvModifiers ?? []) {
			this.addAdvantageLevelContext(context, Number(modifier.value) || 0, modifier.name || "Modificador personalizado")
		}

		context.actualAdvantageLevel.finalReason = context.actualAdvantageLevel.reasons.map(reasonObj => {
			return `${reasonObj.reason} (${reasonObj.value > 0 ? "+" : ""}${reasonObj.value})`
		}).join(", ")
	}

	static addAdvantageLevelContext(context, value, reason) {
		context.actualAdvantageLevel.reasons.push({ value, reason })
		context.actualAdvantageLevel.value += value
	}

	static buildAdvantageLevel(actor) {
		const baseLevel = actor.system.advantageLevel.actual;
		const data = {
			value: 0,
			reasons: [
				{ value: baseLevel, reason: "Base" }
			]
		}
		for (const modifier of actor.system.nvModifiers ?? []) {
			data.reasons.push({ value: Number(modifier.value) || 0, reason: modifier.name || "Modificador personalizado" })
		}
		data.value = data.reasons.reduce((total, reason) => total + reason.value, 0)
		return data
	}

	static addAdvantageLevel(data, value, reason) {
		data.reasons.push({ value, reason })
		data.value += value
		return data
	}
}
