import { GameSettings } from "../settings/settings.mjs";
import { AdvantageLevelApi } from "../sheets/actor-sheet.mjs";

class RollMoveDialog extends Dialog {
	constructor(dialogData = {}, options = {}) {
		super(dialogData, options);
		this.options.classes = ["my-custom-class-name"];
		this._currentResolve = null;
		this._currentItem = null
		this._advantageLevel = null
		this._newAdvantageLevel = null
	}

	static async create(item) {
		const actor = item.actor;
		const advantageLevel = AdvantageLevelApi.buildAdvantageLevel(actor)
		let newAdvantageLevel = 0

		return new Promise((resolve) => {
			const validAttributes = Object.values(item.system.attributes).filter(
				(attribute) => attribute.on === true
			);

			const options = []

			validAttributes.forEach((attribute) => {
				options.push(`
					<label>
						<input type="radio" name="option" value="${attribute.ref}" ${validAttributes.length === 1 ? "checked" : ""}>
						${attribute.name[0].toUpperCase() + attribute.name.slice(1)} (${actor.system.attributes[attribute.ref].actual})
					</label>
				`)
			});

			let content = `
				<div class="dialog-roll-move-content">
					<div class="modifier-content">
						<label>Modificador:</label>
						<input class="modifier-input" type="text" name="modifier" placeholder="Ex: +1, +2, -1, -2">
					</div>
					<div>
						<h3>Selecione o atributo</h3>
						<div class="options-container">
							${options.join("")}
						</div>
					</div>
					<div class="roll-nv-container">
						<div class="advantage-level-container">
							<div class="panel ${RollMoveDialog._getAdvantageLevelClass(advantageLevel.value)}">
									<span class="nv">${RollMoveDialog._getAdvantageLevelText(advantageLevel.value)}</span>
									<span class="val">
										<span class="actual">${advantageLevel.value} NV</span>
										<span class="changing"></span>
									</span>
							</div>
							<div class="controls">
									<button class="btn-decrease-advantage-level"> < </button>
									<button class="btn-increase-advantage-level"> > </button>
							</div>
						</div>
						<button class="default-roll-button">Rolar</button>
					</div>
				</div>
			`;

			const dlg = new this({
				title: `Rolando movimento: ${item.name}`,
				content,
				buttons: {},
				close: () => { resolve(false); }
			});

			dlg._currentResolve = resolve;
			dlg._currentItem = item
			dlg._advantageLevel = advantageLevel
			dlg._newAdvantageLevel = newAdvantageLevel
			dlg.render(true);
		});
	}

	activateListeners(html) {
		super.activateListeners(html);

		html.find(".default-roll-button").on("click", (ev) => {
			if (this._currentResolve) {
				this.rollDefault(ev);
			}
		});
		html.find('.btn-increase-advantage-level').on("click", (ev) => {
			this._newAdvantageLevel++
			this.updateNVPanel(ev)
		})
		html.find('.btn-decrease-advantage-level').on("click", (ev) => {
			this._newAdvantageLevel--
			this.updateNVPanel(ev)
		})

		// Listener para quando o atributo é selecionado
		html.find('input[name="option"]').on("change", (ev) => {
			this.updateNVPanel(ev)
		})

		// Atualizar o painel inicialmente se houver um atributo pré-selecionado
		const checkedOption = html.find('input[name="option"]:checked');
		if (checkedOption.length > 0) {
			this.updateNVPanel({ target: checkedOption[0] })
		}
	}

	rollDefault(e) {
		const options = e.target
			.closest(".window-content")
			.querySelector(".options-container")
			.querySelectorAll('[name="option"]');
		const checkedOption = [...options].find((option) => option.checked);
		if (!checkedOption) {
			return ui.notifications.warn("Escolha um atributo para rolar com o movimento!");
		}
		const chosenAttribute = checkedOption.value;
		const rollModifier = e.target
			.closest(".window-content")
			.querySelector('.modifier-input')
			.value

		// Passar apenas o NV base + ajustes manuais
		// O ItemRollManager vai somar automaticamente o NV das condições ativas para o atributo escolhido
		const advantageLevel = this._advantageLevel.value + this._newAdvantageLevel

		this._currentItem.moveRoll({
			advantageLevel,
			attribute: chosenAttribute,
			rollModifier
		});
		this._currentResolve(true)
		this.close();
	}

	/**
	 * Calcula o NV adicional das condições ativas para um atributo específico
	 * @param {string} attribute - O atributo a ser verificado
	 * @returns {number} O NV adicional das condições
	 */
	_getConditionNV(attribute) {
		if (!this._currentItem?.parent) return 0;

		let attributeNV = 0;
		const parentConditions = this._currentItem.parent.items.filter(
			(conditionItem) => conditionItem.type === "condition"
		);
		const activeConditions = parentConditions.filter(
			(condition) => condition.system.isActive
		);

		for (const activeCondition of activeConditions) {
			const nvValue = activeCondition.system?.attributes?.[attribute]?.nv;
			if (nvValue !== undefined && nvValue !== null) {
				attributeNV += parseInt(nvValue) || 0;
			}
		}

		return attributeNV;
	}

	/**
	 * Obtém o atributo atualmente selecionado
	 * @param {HTMLElement} target - Elemento que disparou o evento
	 * @returns {string|null} O atributo selecionado ou null
	 */
	_getSelectedAttribute(target) {
		const windowContent = target.closest('.window-content') || target.closest('.dialog-content');
		if (!windowContent) return null;

		const checkedOption = windowContent.querySelector('input[name="option"]:checked');
		return checkedOption ? checkedOption.value : null;
	}

	updateNVPanel(e) {
		const selectedAttribute = this._getSelectedAttribute(e.target);
		const conditionNV = selectedAttribute ? this._getConditionNV(selectedAttribute) : 0;
		const baseNV = this._advantageLevel.value;
		const manualAdjustment = this._newAdvantageLevel;
		const totalNV = baseNV + conditionNV + manualAdjustment;

		const panel = e.target.closest('.dialog-content')?.querySelector('.panel') ||
			e.target.closest('.window-content')?.querySelector('.panel');
		if (!panel) return;

		panel.querySelector('.nv').innerText = RollMoveDialog._getAdvantageLevelText(totalNV);
		panel.classList.remove(...["real-bad", "bad", "neutral", "good", "really-good"]);
		const newClass = RollMoveDialog._getAdvantageLevelClass(totalNV);
		panel.classList.add(newClass);

		const actualSpan = panel.querySelector('.actual');
		const changingSpan = panel.querySelector('.changing');

		// Mostrar o NV base
		actualSpan.innerText = `${baseNV} NV`;

		// Mostrar ajustes manuais e NV das condições
		let changingText = "";
		if (conditionNV !== 0) {
			changingText += conditionNV > 0 ? ` +${conditionNV}` : ` ${conditionNV}`;
			changingText += " (condições)";
		}
		if (manualAdjustment !== 0) {
			if (changingText) changingText += " | ";
			changingText += manualAdjustment > 0 ? ` +${manualAdjustment}` : ` ${manualAdjustment}`;
			changingText += " (manual)";
		}
		changingSpan.innerText = changingText;
	}

	static _getAdvantageLevelClass(paramValue) {
		const { greatDisadvantage, disadvantage, advantage, greatAdvantage } = GameSettings.getNVThresholds();

		switch (true) {
			case paramValue <= greatDisadvantage: return "real-bad";
			case (paramValue <= disadvantage && paramValue > greatDisadvantage): return "bad";
			//case paramValue === 0: return "neutral";
			case (paramValue >= advantage && paramValue < greatAdvantage): return "good";
			case paramValue >= greatAdvantage: return "really-good";
			default: return "neutral";
		}
	}

	static _getAdvantageLevelText(paramValue) {
		const { greatDisadvantage, disadvantage, advantage, greatAdvantage } = GameSettings.getNVThresholds();

		switch (true) {
			case paramValue <= greatDisadvantage: return "Grande Desvantagem";
			case (paramValue <= disadvantage && paramValue > greatDisadvantage): return "Desvantagem";
			case (paramValue >= advantage && paramValue < greatAdvantage): return "Vantagem";
			case paramValue >= greatAdvantage: return "Grande Vantagem";
			default: return "Normal";
		}
	}
}


export default RollMoveDialog
