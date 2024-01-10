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

		if (itemData.type === "move") {
			
		}
		if (itemData.type === "skill") {
			// const rankChoices = [
			// 	{ name: "Academia", value: 0 },
			// 	{ name: "Genin", value: 1 },
			// 	{ name: "Chunin", value: 2 },
			// 	{ name: "Jounin Especial", value: 3 },
			// 	{ name: "Jounin", value: 4 },
			// 	{ name: "Kage", value: 5 },
			// ];
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
		html.find(".add-level-description-btn").click(async (ev) => {
			const levelDescriptions = this.object.system.levelDescriptions
			levelDescriptions.push({level: 0, description: "", id: randomID(7)})
			this.object.update({system: {levelDescriptions: levelDescriptions} });
		})
		html.find(".level-description-input").blur(async (ev) => {
			const inputObjective = ev.target.getAttribute("data-input-objective")
			const levelDescriptionId = ev.target.closest("li").getAttribute("data-item-id")
			const levelDescriptions = this.object.system.levelDescriptions
			const levelDescription = levelDescriptions.find(element => element.id === levelDescriptionId)
			levelDescription[inputObjective] = ev.target.value
			this.object.update({system: {levelDescriptions: [...levelDescriptions]} });
		})
		html.find(".level-description-remove-btn").click(async (ev) => {
			const levelDescriptionId = ev.target.closest("li").getAttribute("data-item-id")
			const levelDescriptions = this.object.system.levelDescriptions
			const toRemoveIndex = levelDescriptions.findIndex(element => element.id === levelDescriptionId)
			levelDescriptions.splice(toRemoveIndex, 1)
			this.object.update({system: {levelDescriptions: [...levelDescriptions]} });
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
				str: { value: 0, name: "str" },
				dex: { value: 0, name: "dex" },
				con: { value: 0, name: "con" },
				int: { value: 0, name: "int" },
				per: { value: 0, name: "per" },
				car: { value: 0, name: "car" },
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
}
