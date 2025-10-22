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

			const traditionalButtons = `
				<button type="button" class="roll-move-button" data-mode="+advantage">Grande Vantagem</button>
				<button type="button" class="roll-move-button" data-mode="advantage">Vantagem</button>
				<button type="button" class="roll-move-button" data-mode="normal">Normal</button>
				<button type="button" class="roll-move-button" data-mode="disadvantage">Desvantagem</button>
				<button type="button" class="roll-move-button" data-mode="+disadvantage">Grande Desvantagem</button>
			`;

			let content = ""
			if (item.system.rollMode === "custom") {
				content = `
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
						<div style="margin-top: 5px;">
							${traditionalButtons}
						</div>
					</div>
				`;
			} else {
				content = `
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
						<div class="traditional-buttons-container">
							<a class="show-custom-roll">Rolagem Personalizada</a>
							<div class="custom-roll-section" style="display: none;">
								${traditionalButtons}
							</div>
						</div>
					</div>
				`;
			}

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

		html.find(".roll-move-button").on("click", (ev) => {
			if (this._currentResolve) {
				this.rollClassic(ev);
			}
		});
		html.find(".default-roll-button").on("click", (ev) => {
			if (this._currentResolve) {
				this.rollDefault(ev);
			}
		});
		html.find(".show-custom-roll").on("click", (ev) => {
			const customRollSection = ev.target.closest('.traditional-buttons-container').querySelector('.custom-roll-section');
			customRollSection.style.display = customRollSection.style.display === "none" ? "block" : "none";
			const link = html.find(".show-custom-roll");
			link.textContent = customRollSection.style.display === "none" ? "Rolagem Personalizada" : "Voltar para rolagem personalizada";
			this.setPosition({ height: "auto" });
		});
		html.find('.btn-increase-advantage-level').on("click", (ev) => {
			this._newAdvantageLevel++
			this.updateNVPanel(ev)
		})
		html.find('.btn-decrease-advantage-level').on("click", (ev) => {
			this._newAdvantageLevel--
			this.updateNVPanel(ev)
		})
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

		const mode = RollMoveDialog._calculateModeByValue(this._advantageLevel.value + this._newAdvantageLevel)

		this._currentItem.moveRoll({
			mode,
			attribute: chosenAttribute,
			rollModifier
		});
		this._currentResolve(true)
		this.close();
	}

	rollClassic(e) {
		const mode = e.currentTarget.dataset.mode;
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
		this._currentItem.moveRoll({
			mode,
			attribute: chosenAttribute,
			rollModifier
		});
		this._currentResolve(true)
		this.close();
	}

	updateNVPanel(e) {
		const factor = this._advantageLevel.value + this._newAdvantageLevel
		const panel = e.target.closest('.dialog-content').querySelector('.panel')
		panel.querySelector('.nv').innerText = RollMoveDialog._getAdvantageLevelText(factor)
		panel.classList.remove(...["real-bad", "bad", "neutral", "good", "really-good"])
		const newClass = RollMoveDialog._getAdvantageLevelClass(factor)
		panel.classList.add(newClass)

		const changingSpan = panel.querySelector('.changing')
		let newText = ""
		if (this._newAdvantageLevel > 0) {
			newText = ` + ${this._newAdvantageLevel} NV`
		} else if (this._newAdvantageLevel < 0) {
			newText = ` - ${this._newAdvantageLevel.toString().replace("-", "")} NV`
		}
		changingSpan.innerText = newText


	}

	static _calculateModeByValue(paramValue) {
		const { greatDisadvantage, disadvantage, advantage, greatAdvantage } = GameSettings.getNVThresholds();

		switch (true) {
			case paramValue <= greatDisadvantage: return "+disadvantage";
			case (paramValue <= disadvantage && paramValue > greatDisadvantage): return "disadvantage";
			case (paramValue >= advantage && paramValue < greatAdvantage): return "advantage";
			case paramValue >= greatAdvantage: return "+advantage";
			default: return "normal";
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
