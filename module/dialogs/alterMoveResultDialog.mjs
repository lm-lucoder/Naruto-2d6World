class AlterMoveResultDialog extends Dialog {
	constructor(dialogData = {}, options = {}) {
		super(dialogData, options);
		this.options.classes = ["my-custom-class-name"];
		this._currentResolve = null;
		this._currentMessageData = null
		this._currentMessageCard = null

	}

	static async create({ messageData, messageCard }) {

		const content = `<div class="dialog-alter-move-content">
			<div class="inputs-container">
				<h3>Faça as alterações necessárias:</h3>
				<div class="action-dice-section">
					<label>Modificador do dado de ação:</label>
					<input class="modifier-action-dice-input" type="text" name="modifier" placeholder="Ex: +1, +2, -1, -2">
				</div>
				<div class="challenge-dice-a-section">
					<label>Modificador do dado de desafio A:</label>
					<input class="modifier-challenge-dice-a-input" type="text" name="modifier" placeholder="Ex: +1, +2, -1, -2">
				</div>
				<div class="challenge-dice-b-section">
					<label>Modificador do dado de desafio B:</label>
					<input class="modifier-challenge-dice-b-input" type="text" name="modifier" placeholder="Ex: +1, +2, -1, -2">
				</div>
			</div>
			<div class=""buttons-container">
				<button type="button" class="submit-button">Alterar</button>
				<button type="button" class="cancel-button">Cancelar</button>
			</div>
		</div>`;


		return new Promise((resolve) => {
			const dlg = new this({
				title: `Alterando rolagem do movimento`,
				content,
				buttons: {},
				close: () => { resolve(false); }
			});

			dlg._currentResolve = resolve;
			dlg._currentMessageData = messageData
			dlg._currentMessageCard = messageCard
			dlg.render(true);
		});
	}

	activateListeners(html) {
		super.activateListeners(html);

		html.find(".submit-button").on("click", (e) => {
			if (this._currentResolve) {
				e.preventDefault(e);
				this.submitChange(e);
				this._currentResolve(true);
			}
		});
		html.find(".cancel-button").on("click", (e) => {
			if (this._currentResolve) {
				this._currentResolve(false);
			}
		});

	}

	submitChange(e) {
		const dialogContent = e.target.closest(".dialog-alter-move-content");
		const actionDiceModifier = dialogContent.querySelector(".modifier-action-dice-input").value;
		const challengeDiceAModifier = dialogContent.querySelector(".modifier-challenge-dice-a-input").value;
		const challengeDiceBModifier = dialogContent.querySelector(".modifier-challenge-dice-b-input").value;

		const move = this._currentMessageData.move
		move.moveRoll({
			...this._currentMessageData,
			modifiers: {
				actionDiceModifier,
				challengeDiceAModifier,
				challengeDiceBModifier
			}
		})

	}
}


export default AlterMoveResultDialog
