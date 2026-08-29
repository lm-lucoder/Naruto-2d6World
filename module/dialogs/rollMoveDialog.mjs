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
									<span class="val actual">${advantageLevel.value} NV</span>
							</div>
							<div class="nv-breakdown" aria-label="Composição do Nível de Vantagem"></div>
							<div class="controls">
									<button type="button" class="btn-decrease-advantage-level"> < </button>
									<button type="button" class="btn-increase-advantage-level"> > </button>
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

		// Atualizar o painel inicialmente (mostra valores globais mesmo sem atributo selecionado)
		// Se houver atributo pré-selecionado, também mostra os valores específicos
		const panel = html.find('.panel')[0];
		if (panel) {
			const checkedOption = html.find('input[name="option"]:checked');
			if (checkedOption.length > 0) {
				this.updateNVPanel({ target: checkedOption[0] })
			} else {
				// Atualizar sem atributo selecionado para mostrar apenas valores globais
				this.updateNVPanel({ target: panel })
			}
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

		// Passar NV base e ajuste manual separadamente
		// O ItemRollManager vai somar automaticamente o NV das condições ativas para o atributo escolhido
		const baseAdvantageLevel = this._advantageLevel.value; // NV base do personagem
		const manualAdjustment = this._newAdvantageLevel; // Ajuste manual do diálogo
		const advantageLevel = baseAdvantageLevel + manualAdjustment; // Total para passar

		this._currentItem.moveRoll({
			advantageLevel,
			baseAdvantageLevel, // NV base do personagem
			manualAdjustment, // Ajuste manual do diálogo
			baseNVInfo: this._advantageLevel.reasons,
			attribute: chosenAttribute,
			rollModifier
		});
		this._currentResolve(true)
		this.close();
	}

	/**
	 * Obtém informações de NV de todas as condições ativas, agrupadas por condição
	 * @param {string|null} attribute - O atributo selecionado (null se nenhum)
	 * @returns {Array} Array de objetos com {name, totalNV} para cada condição
	 */
	_getConditionsNVInfo(attribute) {
		if (!this._currentItem?.parent) return [];

		const conditionsInfo = [];
		const parentConditions = this._currentItem.parent.items.filter(
			(conditionItem) => conditionItem.type === "condition"
		);
		const activeConditions = parentConditions.filter(
			(condition) => condition.system.isActive
		);

		for (const activeCondition of activeConditions) {
			// Coletar NV global
			const globalNV = parseInt(activeCondition.system?.globalNV) || 0;

			// Coletar NV específico do atributo (se houver atributo selecionado)
			let attributeNV = 0;
			if (attribute) {
				const nvValue = activeCondition.system?.attributes?.[attribute]?.nv;
				if (nvValue !== undefined && nvValue !== null) {
					attributeNV = parseInt(nvValue) || 0;
				}
			}

			// Só adiciona se houver algum NV (global ou específico)
			const totalNV = globalNV + attributeNV;
			if (totalNV !== 0) {
				conditionsInfo.push({
					name: activeCondition.name,
					totalNV: totalNV
				});
			}
		}

		return conditionsInfo;
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
		const baseNV = this._advantageLevel.value;
		const manualAdjustment = this._newAdvantageLevel;

		// Obter informações de NV de todas as condições (global + específico do atributo somados por condição)
		const conditionsInfo = this._getConditionsNVInfo(selectedAttribute);

		// Calcular NV total das condições
		const totalConditionNV = conditionsInfo.reduce((sum, condition) => sum + condition.totalNV, 0);

		const masterGlobalNV = game.settings.get("naruto2d6world", "master-global-nv") || 0;

		// Calcular NV total final. Deve espelhar o cálculo aplicado pelo motor de rolagem.
		const totalNV = baseNV + totalConditionNV + manualAdjustment + masterGlobalNV;

		const panel = e.target.closest('.dialog-content')?.querySelector('.panel') ||
			e.target.closest('.window-content')?.querySelector('.panel');
		if (!panel) return;

		panel.querySelector('.nv').innerText = RollMoveDialog._getAdvantageLevelText(totalNV);
		panel.classList.remove(...["real-bad", "bad", "neutral", "good", "really-good"]);
		const newClass = RollMoveDialog._getAdvantageLevelClass(totalNV);
		panel.classList.add(newClass);

		panel.querySelector('.actual').innerText = `${totalNV > 0 ? "+" : ""}${totalNV} NV`;

		const breakdown = panel.parentElement.querySelector('.nv-breakdown');
		this._renderNVBreakdown(breakdown, {
			baseNVInfo: this._advantageLevel.reasons,
			conditionsInfo,
			manualAdjustment,
			masterGlobalNV
		});
	}

	/** Renderiza uma tag vertical para cada origem que compõe o NV total. */
	_renderNVBreakdown(container, { baseNVInfo, conditionsInfo, manualAdjustment, masterGlobalNV }) {
		if (!container) return;
		container.replaceChildren();

		const entries = [
			...baseNVInfo.map((entry) => ({ label: entry.reason === "Base" ? "NV base" : entry.reason, value: entry.value })),
			...conditionsInfo.map((condition) => ({ label: condition.name, value: condition.totalNV })),
			...(manualAdjustment !== 0 ? [{ label: "Ajuste manual", value: manualAdjustment }] : []),
			...(masterGlobalNV !== 0 ? [{ label: "NV Mestre", value: masterGlobalNV }] : [])
		];

		for (const entry of entries) {
			const tag = document.createElement('div');
			tag.classList.add('nv-breakdown-tag', entry.value > 0 ? 'positive' : entry.value < 0 ? 'negative' : 'neutral');

			const label = document.createElement('span');
			label.classList.add('label');
			label.textContent = entry.label;

			const value = document.createElement('span');
			value.classList.add('value');
			value.textContent = `${entry.value > 0 ? '+' : ''}${entry.value} NV`;

			tag.append(label, value);
			container.append(tag);
		}
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
