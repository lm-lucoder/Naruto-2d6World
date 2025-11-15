import { ChatMessageAbilitiesResourceTemplates } from "../chat-message-templates/abilities-resource-templates.mjs";

class ManageAbilityResourceDialog extends Dialog {
	constructor(dialogData = {}, options = {}) {
		super(dialogData, options);
		this.options.classes = ["my-custom-class-name"];
		this._currentResolve = null;
		this._currentAbility = null;
		this._currentActor = null;
		this._currentResource = null;
		this._resourceModifier = 0; // Contador de modificação do recurso
	}

	static async create({ ability, resource }) {

		const content = `<div class="dialog-manage-ability-chakra-content">
			<div class="inputs-container">
				<h3>Gerenciando ${resource.name} da habilidade:</h3>
				<div class="chakra-points-section">
					<div class="chakra-points-label">${resource.name}:</div>
					<div class="chakra-points-value">
						<span class="chakra-points-value-current">${resource.value} </span>
						<span class="chakra-points-value-separator">/</span>
						<span class="chakra-points-value-max">${resource.maxValue}</span>
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
				title: `Gerenciando ${resource.name} da habilidade`,
				content,
				buttons: {},
				close: () => { resolve(false); }
			});

			dlg._currentResolve = resolve;
			dlg._currentAbility = ability;
			dlg._currentActor = ability.actor;
			dlg._currentResource = resource;
			dlg.render(true);
		});
	}

	activateListeners(html) {
		super.activateListeners(html);

		// Botão para reduzir recurso (visual apenas)
		html.find(".low-chakra-button").on("click", (e) => {
			e.preventDefault();
			this.decreaseResource(html);
		});

		// Botão para aumentar recurso (visual apenas)
		html.find(".high-chakra-button").on("click", (e) => {
			e.preventDefault();
			this.increaseResource(html);
		});

		// Botão para aplicar a mudança real
		html.find(".update-chakra-button").on("click", (e) => {
			e.preventDefault();
			this.updateResource(html);
			this._currentResolve(true);
			this.close();
		});

		html.find(".reload-all-chakra-button").on("click", (e) => {
			if (this._currentResolve) {
				e.preventDefault(e);
				this.reloadAllResource(e);
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

	decreaseResource(html) {
		const currentValue = parseInt(this._currentResource.value);
		const newValue = currentValue + this._resourceModifier - 1;

		// Não permite valores negativos
		if (newValue >= 0) {
			this._resourceModifier -= 1;
			this.updateResourceDisplay(html);
		}
	}

	increaseResource(html) {
		const maxValue = parseInt(this._currentResource.maxValue);
		const currentValue = parseInt(this._currentResource.value);
		const newValue = currentValue + this._resourceModifier + 1;

		// Não permite valores acima do máximo
		if (newValue <= maxValue) {
			this._resourceModifier += 1;
			this.updateResourceDisplay(html);
		}
	}

	updateResourceDisplay(html) {
		const currentValue = parseInt(this._currentResource.value);
		const newDisplayValue = currentValue + this._resourceModifier;

		// Atualiza o valor visual
		html.find(".chakra-points-value-current").text(newDisplayValue);

		// Atualiza o contador de modificação
		const modifierElement = html.find(".chakra-modifier-value");
		modifierElement.removeClass("modifier-positive modifier-negative modifier-neutral");

		if (this._resourceModifier === 0) {
			modifierElement.text("0").addClass("modifier-neutral");
		} else if (this._resourceModifier > 0) {
			modifierElement.text(`+${this._resourceModifier}`).addClass("modifier-positive");
		} else {
			modifierElement.text(this._resourceModifier).addClass("modifier-negative");
		}
	}

	updateResource(html) {
		if (this._resourceModifier === 0) {
			return; // Nenhuma mudança para aplicar
		}

		const currentValue = parseInt(this._currentResource.value);
		const maxValue = parseInt(this._currentResource.maxValue);
		const newResourceValue = currentValue + this._resourceModifier;

		// Valida os limites
		if (newResourceValue < 0) {
			ui.notifications.warn("O valor do recurso não pode ser menor que 0");
			return;
		}
		if (newResourceValue > maxValue) {
			ui.notifications.warn(`O valor do recurso não pode ser maior que ${maxValue}`);
			return;
		}

		// Salva o modificador antes de resetar
		const modifierValue = this._resourceModifier;

		// Atualiza o recurso no array de recursos
		const resources = this._currentAbility.system.resources || [];
		const resourceIndex = resources.findIndex(r => r.id === this._currentResource.id);

		if (resourceIndex === -1) {
			ui.notifications.error("Recurso não encontrado");
			return;
		}

		// Aplica a mudança real
		resources[resourceIndex].value = newResourceValue;
		this._currentAbility.update({
			system: {
				resources: [...resources]
			}
		});

		// Atualiza a referência local do recurso
		this._currentResource.value = newResourceValue;

		// Reseta o contador
		this._resourceModifier = 0;
		this.updateResourceDisplay(html);

		ui.notifications.info(`${this._currentResource.name} atualizado para ${newResourceValue}`);

		// Cria mensagem no chat usando template
		ChatMessageAbilitiesResourceTemplates.createResourceChangedMessage({
			actor: this._currentActor,
			ability: this._currentAbility,
			resource: this._currentResource,
			modifierValue: modifierValue,
			newResourceValue: newResourceValue
		});
	}

	reloadAllResource(e) {
		const maxValue = parseInt(this._currentResource.maxValue);
		const currentValue = parseInt(this._currentResource.value);

		if (currentValue == maxValue) {
			return ui.notifications.info(`Os pontos de ${this._currentResource.name} já estão no máximo`);
		}

		// Atualiza o recurso no array de recursos
		const resources = this._currentAbility.system.resources || [];
		const resourceIndex = resources.findIndex(r => r.id === this._currentResource.id);

		if (resourceIndex === -1) {
			ui.notifications.error("Recurso não encontrado");
			return;
		}

		// Define o valor para o máximo
		resources[resourceIndex].value = maxValue;
		this._currentAbility.update({
			system: {
				resources: [...resources]
			}
		});

		// Atualiza a referência local do recurso
		this._currentResource.value = maxValue;

		// Cria mensagem no chat usando template
		ChatMessageAbilitiesResourceTemplates.createResourceReloadedMessage({
			actor: this._currentActor,
			ability: this._currentAbility,
			resource: this._currentResource
		});
		return
	}
}


export default ManageAbilityResourceDialog
