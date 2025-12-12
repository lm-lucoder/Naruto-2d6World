class ManageItemQuantityDialog extends Dialog {
	constructor(dialogData = {}, options = {}) {
		super(dialogData, options);
		this.options.classes = ["my-custom-class-name"];
		this._currentResolve = null;
		this._currentItem = null;
		this._currentActor = null;
		this._quantityModifier = 0; // Contador de modificação da quantidade
	}

	static async create({ item }) {

		const content = `<div class="dialog-manage-item-quantity-content">
			<div class="inputs-container">
				<h3>Gerenciando quantidade do item:</h3>
				<div class="quantity-section">
					<div class="quantity-label">${item.name}:</div>
					<div class="quantity-value">
						<span class="quantity-value-current">${item.system.quantity || 0} </span>
					</div>
					<div class="quantity-modifier-display">
						<span class="quantity-modifier-label">Modificação:</span>
						<span class="quantity-modifier-value modifier-neutral">0</span>
					</div>
				</div>
				<div class="buttons-container">
					<div class="quantity-buttons-container">
						<button type="button" class="low-quantity-button"><<</button>
						<button type="button" class="update-quantity-button">Alterar</button>
						<button type="button" class="high-quantity-button">>></button>
					</div>
					<div class="main-buttons-container">
						<button type="button" class="cancel-button">Cancelar</button>
					</div>
				</div>
			</div>
		</div>`;

		return new Promise((resolve) => {
			const dlg = new this({
				title: `Gerenciando quantidade de ${item.name}`,
				content,
				buttons: {},
				close: () => { resolve(false); }
			});

			dlg._currentResolve = resolve;
			dlg._currentItem = item;
			dlg._currentActor = item.parent;
			dlg.render(true);
		});
	}

	activateListeners(html) {
		super.activateListeners(html);

		// Botão para reduzir quantidade (visual apenas)
		html.find(".low-quantity-button").on("click", (e) => {
			e.preventDefault();
			this.decreaseQuantity(html);
		});

		// Botão para aumentar quantidade (visual apenas)
		html.find(".high-quantity-button").on("click", (e) => {
			e.preventDefault();
			this.increaseQuantity(html);
		});

		// Botão para aplicar a mudança real
		html.find(".update-quantity-button").on("click", (e) => {
			e.preventDefault();
			this.updateQuantity(html);
			this._currentResolve(true);
			this.close();
		});

		html.find(".reset-quantity-button").on("click", (e) => {
			if (this._currentResolve) {
				e.preventDefault(e);
				this.resetQuantity(e);
				this._currentResolve(true);
				this.close();
			}
		});
		html.find(".cancel-button").on("click", (e) => {
			if (this._currentResolve) {
				this._currentResolve(false);
				this.close();
			}
		});

	}

	decreaseQuantity(html) {
		const currentValue = parseInt(this._currentItem.system.quantity || 0);
		const newValue = currentValue + this._quantityModifier - 1;

		// Não permite valores negativos
		if (newValue >= 0) {
			this._quantityModifier -= 1;
			this.updateQuantityDisplay(html);
		}
	}

	increaseQuantity(html) {
		const currentValue = parseInt(this._currentItem.system.quantity || 0);
		const newValue = currentValue + this._quantityModifier + 1;

		// Permite aumentar sem limite máximo
		this._quantityModifier += 1;
		this.updateQuantityDisplay(html);
	}

	updateQuantityDisplay(html) {
		const currentValue = parseInt(this._currentItem.system.quantity || 0);
		const newDisplayValue = currentValue + this._quantityModifier;

		// Atualiza o valor visual
		html.find(".quantity-value-current").text(newDisplayValue);

		// Atualiza o contador de modificação
		const modifierElement = html.find(".quantity-modifier-value");
		modifierElement.removeClass("modifier-positive modifier-negative modifier-neutral");

		if (this._quantityModifier === 0) {
			modifierElement.text("0").addClass("modifier-neutral");
		} else if (this._quantityModifier > 0) {
			modifierElement.text(`+${this._quantityModifier}`).addClass("modifier-positive");
		} else {
			modifierElement.text(this._quantityModifier).addClass("modifier-negative");
		}
	}

	updateQuantity(html) {
		if (this._quantityModifier === 0) {
			return; // Nenhuma mudança para aplicar
		}

		const currentValue = parseInt(this._currentItem.system.quantity || 0);
		const newQuantityValue = currentValue + this._quantityModifier;

		// Valida os limites
		if (newQuantityValue < 0) {
			ui.notifications.warn("A quantidade não pode ser menor que 0");
			return;
		}

		// Salva o modificador antes de resetar
		const modifierValue = this._quantityModifier;

		// Aplica a mudança real
		this._currentItem.update({
			system: {
				quantity: newQuantityValue
			}
		});

		// Reseta o contador
		this._quantityModifier = 0;
		this.updateQuantityDisplay(html);

		ui.notifications.info(`${this._currentItem.name} quantidade atualizada para ${newQuantityValue}`);

		// Cria mensagem no chat
		const speaker = ChatMessage.getSpeaker({ actor: this._currentActor });
		ChatMessage.create({
			speaker: speaker,
			flavor: `${this._currentActor.name} alterou a quantidade de ${this._currentItem.name}`,
			content: `<span style="display:flex; align-items:center">
				<img src="${this._currentItem.img}" style="max-width: 35px; border: none; margin-right: 5px"> 
				<span>Quantidade: ${currentValue} ${modifierValue > 0 ? '+' : ''}${modifierValue !== 0 ? modifierValue : ''} = ${newQuantityValue}</span>
			</span>`
		});
	}

	resetQuantity(e) {
		const currentValue = parseInt(this._currentItem.system.quantity || 0);

		if (currentValue == 0) {
			return ui.notifications.info(`A quantidade de ${this._currentItem.name} já está em 0`);
		}

		// Define a quantidade para 0
		this._currentItem.update({
			system: {
				quantity: 0
			}
		});

		// Cria mensagem no chat
		const speaker = ChatMessage.getSpeaker({ actor: this._currentActor });
		ChatMessage.create({
			speaker: speaker,
			flavor: `${this._currentActor.name} zerou a quantidade de ${this._currentItem.name}`,
			content: `<span style="display:flex; align-items:center">
				<img src="${this._currentItem.img}" style="max-width: 35px; border: none; margin-right: 5px"> 
				<span>Quantidade zerada (era ${currentValue})</span>
			</span>`
		});
		return
	}
}


export default ManageItemQuantityDialog

