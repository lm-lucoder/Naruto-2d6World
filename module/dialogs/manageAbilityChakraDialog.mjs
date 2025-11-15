import { ChatMessageTemplates } from "../chat-message-templates/abilities-chakra-templates.mjs";

class ManageAbilityChakraDialog extends Dialog {
	constructor(dialogData = {}, options = {}) {
		super(dialogData, options);
		this.options.classes = ["my-custom-class-name"];
		this._currentResolve = null;
		this._currentAbility = null;
		this._currentActor = null;
		this._chakraModifier = 0; // Contador de modificação do chakra
	}

	static async create({ ability }) {

		const content = `<div class="dialog-manage-ability-chakra-content">
			<div class="inputs-container">
				<h3>Gerenciando Chakra da habilidade:</h3>
				<div class="chakra-points-section">
					<div class="chakra-points-label">Chakra Points:</div>
					<div class="chakra-points-value">
						<span class="chakra-points-value-current">${ability.system.chakra.chakraPoints} </span>
						<span class="chakra-points-value-separator">/</span>
						<span class="chakra-points-value-max">${ability.system.chakra.maxChakraPoints}</span>
					</div>
					<div class="chakra-modifier-display">
						<span class="chakra-modifier-label">Modificação:</span>
						<span class="chakra-modifier-value modifier-neutral">0</span>
					</div>
				</div>
				<div class="buttons-container">
					<div class="chakra-buttons-container">
						<button type="button" class="low-chakra-button"><<</button>
						<button type="button" class="update-chakra-button">Alterar</button>
						<button type="button" class="high-chakra-button">>></button>
					</div>
					<div class="main-buttons-container">
						<button type="button" class="reload-all-chakra-button">Recarregar Tudo</button>
						<button type="button" class="cancel-button">Cancelar</button>
					</div>
				</div>
			</div>
		</div>`;

		return new Promise((resolve) => {
			const dlg = new this({
				title: `Gerenciando Chakra da habilidade`,
				content,
				buttons: {},
				close: () => { resolve(false); }
			});

			dlg._currentResolve = resolve;
			dlg._currentAbility = ability;
			dlg._currentActor = ability.actor;
			dlg.render(true);
		});
	}

	activateListeners(html) {
		super.activateListeners(html);

		// Botão para reduzir chakra (visual apenas)
		html.find(".low-chakra-button").on("click", (e) => {
			e.preventDefault();
			this.decreaseChakra(html);
		});

		// Botão para aumentar chakra (visual apenas)
		html.find(".high-chakra-button").on("click", (e) => {
			e.preventDefault();
			this.increaseChakra(html);
		});

		// Botão para aplicar a mudança real
		html.find(".update-chakra-button").on("click", (e) => {
			e.preventDefault();
			this.updateChakra(html);
			this._currentResolve(true);
			this.close();
		});

		html.find(".reload-all-chakra-button").on("click", (e) => {
			if (this._currentResolve) {
				e.preventDefault(e);
				this.reloadAllChakra(e);
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

	decreaseChakra(html) {
		const currentChakra = parseInt(this._currentAbility.system.chakra.chakraPoints);
		const newValue = currentChakra + this._chakraModifier - 1;

		// Não permite valores negativos
		if (newValue >= 0) {
			this._chakraModifier -= 1;
			this.updateChakraDisplay(html);
		}
	}

	increaseChakra(html) {
		const maxChakra = parseInt(this._currentAbility.system.chakra.maxChakraPoints);
		const currentChakra = parseInt(this._currentAbility.system.chakra.chakraPoints);
		const newValue = currentChakra + this._chakraModifier + 1;

		// Não permite valores acima do máximo
		if (newValue <= maxChakra) {
			this._chakraModifier += 1;
			this.updateChakraDisplay(html);
		}
	}

	updateChakraDisplay(html) {
		const currentChakra = parseInt(this._currentAbility.system.chakra.chakraPoints);
		const newDisplayValue = currentChakra + this._chakraModifier;

		// Atualiza o valor visual
		html.find(".chakra-points-value-current").text(newDisplayValue);

		// Atualiza o contador de modificação
		const modifierElement = html.find(".chakra-modifier-value");
		modifierElement.removeClass("modifier-positive modifier-negative modifier-neutral");

		if (this._chakraModifier === 0) {
			modifierElement.text("0").addClass("modifier-neutral");
		} else if (this._chakraModifier > 0) {
			modifierElement.text(`+${this._chakraModifier}`).addClass("modifier-positive");
		} else {
			modifierElement.text(this._chakraModifier).addClass("modifier-negative");
		}
	}

	updateChakra(html) {
		if (this._chakraModifier === 0) {
			return; // Nenhuma mudança para aplicar
		}

		const currentChakra = parseInt(this._currentAbility.system.chakra.chakraPoints);
		const maxChakra = parseInt(this._currentAbility.system.chakra.maxChakraPoints);
		const newChakraValue = currentChakra + this._chakraModifier;

		// Valida os limites
		if (newChakraValue < 0) {
			ui.notifications.warn("O valor de chakra não pode ser menor que 0");
			return;
		}
		if (newChakraValue > maxChakra) {
			ui.notifications.warn(`O valor de chakra não pode ser maior que ${maxChakra}`);
			return;
		}

		// Salva o modificador antes de resetar
		const modifierValue = this._chakraModifier;

		// Aplica a mudança real
		this._currentAbility.update({
			system: {
				chakra: {
					chakraPoints: newChakraValue
				}
			}
		});

		// Reseta o contador
		this._chakraModifier = 0;
		this.updateChakraDisplay(html);

		ui.notifications.info(`Chakra atualizado para ${newChakraValue}`);

		// Cria mensagem no chat usando template
		ChatMessageTemplates.createChakraChangedMessage({
			actor: this._currentActor,
			ability: this._currentAbility,
			modifierValue: modifierValue,
			newChakraValue: newChakraValue
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
			newModifiers: {
				actionDiceModifier,
				challengeDiceAModifier,
				challengeDiceBModifier
			}
		})

	}

	reloadAllChakra(e) {
		const actor = this._currentActor
		const actorChakraValue = parseInt(actor.system.chakra.value)
		if (actorChakraValue == 0) {
			return ui.notifications.info("Você não possui pontos de chakra para isso");
		}
		if (this._currentAbility.system.chakra.chakraPoints == this._currentAbility.system.chakra.maxChakraPoints) {
			return ui.notifications.info("Os pontos de chakra desta habilidade já estão no máximo");
		}
		this._currentAbility.refillChakraPointsFromActor(actor.id)

		// Cria mensagem no chat usando template
		ChatMessageTemplates.createChakraReloadedMessage({
			actor: actor,
			ability: this._currentAbility
		});
		return
	}
}


export default ManageAbilityChakraDialog
