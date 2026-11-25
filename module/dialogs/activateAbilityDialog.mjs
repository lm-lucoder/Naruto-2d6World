import RollMoveDialog from "./rollMoveDialog.mjs";

class ActivateAbilityDialog extends Dialog {
	static async createForAbility(ability) {
		if (!(ability.parent instanceof Actor)) return;
		const level = Math.max(0, Number(ability.system.level) || 0);
		const effectsPerLevel = Math.max(0, Math.floor(Number(ability.system.effectsPerLevel) || 0));
		const effectNames = ability.system.effectsEnabled ? (ability.system.effectSlots ?? []).slice(0, level * effectsPerLevel).filter(Boolean) : [];
		const techniqueNames = ability.system.techniquesEnabled === false ? [] : (ability.system.techniques ?? []).filter(entry => entry.name && Number(entry.level) <= level).map(entry => entry.name);
		const effects = (await Promise.all(effectNames.map(name => this._resolveReference("effect", name)))).filter(Boolean);
		const techniques = (await Promise.all(techniqueNames.map(name => this._resolveReference("technique", name)))).filter(Boolean);
		if (!effects.length && !techniques.length) return ability.abilityRoll();
		return this.create({ ability, effects, techniques });
	}

	static async _resolveReference(type, name) {
		const worldItem = game.items.find(item => item.type === type && item.name === name);
		if (worldItem) return worldItem;
		for (const pack of game.packs.filter(pack => pack.documentName === "Item")) {
			try {
				const index = await pack.getIndex({ fields: ["type"] });
				const match = index.find(item => item.type === type && item.name === name);
				if (match) return await pack.getDocument(match._id);
			} catch (error) {
				console.warn(`Não foi possível consultar ${pack.collection}`, error);
			}
		}
		return null;
	}

	static create({ ability, effects, techniques }) {
		const choices = [
			...effects.map(item => ({ item, type: "effect" })),
			...techniques.map(item => ({ item, type: "technique" }))
		];
		const escape = value => foundry.utils.escapeHTML(String(value));
		const tags = (items, type, offset) => items.length
			? items.map((item, index) => `<button type="button" class="ability-activation-tag" data-choice-index="${offset + index}" title="Ativar ${escape(item.name)}">${escape(item.name)}</button>`).join("")
			: `<span>Nenhum ${type} disponível.</span>`;
		const content = `<div class="dialog-activate-ability-content">
			<h3>Efeitos</h3><div class="ability-activation-tags">${tags(effects, "efeito", 0)}</div>
			<h3>Técnicas</h3><div class="ability-activation-tags">${tags(techniques, "técnica", effects.length)}</div>
		</div>`;
		const dialog = new this({ title: `Ativar ${ability.name}`, content, buttons: {} });
		dialog.ability = ability;
		dialog.choices = choices;
		dialog.render(true);
		return dialog;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".ability-activation-tag").on("click", async event => {
			if (this._choosing) return;
			const choice = this.choices[Number(event.currentTarget.dataset.choiceIndex)];
			if (!choice) return;
			this._choosing = true;
			try {
				const names = choice.item.system.moves ?? [];
				const moves = names.length ? (await Promise.all(names.map(name => this._resolveMove(name)))).filter(Boolean) : [];
				await this.close();
				if (moves.length) ChooseAbilityMoveDialog.create({ activationDialog: this, choice, moves });
				else await this._activate(choice, null, null);
			} finally {
				this._choosing = false;
			}
		});
	}

	async _resolveMove(name) {
		const actor = this.ability.parent;
		const owned = actor.items.find(item => item.type === "move" && item.name === name);
		if (owned) return owned;
		let source = game.items.find(item => item.type === "move" && item.name === name);
		if (!source) {
			for (const pack of game.packs.filter(pack => pack.documentName === "Item")) {
				try {
					const index = await pack.getIndex({ fields: ["type"] });
					const entry = index.find(item => item.type === "move" && item.name === name);
					if (entry) { source = await pack.getDocument(entry._id); break; }
				} catch (error) {
					console.warn(`Não foi possível consultar ${pack.collection}`, error);
				}
			}
		}
		return source ? new CONFIG.Item.documentClass(source.toObject(), { parent: actor }) : null;
	}

	_costPlan(choice) {
		const ability = this.ability;
		const cost = choice.item.system.cost ?? {};
		const resources = ability.system.resources ?? [];
		const normalize = value => String(value ?? "").replace(/&eacute;/gi, "é").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
		const chakraCost = ability.system.chakra?.useChakraPoints ? Math.max(0, Number(cost.chakra) || 0) : 0;
		const requested = new Map();
		const addResourceCost = (name, amount) => {
			const normalized = normalize(name);
			const value = Math.max(0, Number(amount) || 0);
			if (normalized && value > 0) requested.set(normalized, (requested.get(normalized) || 0) + value);
		};
		addResourceCost("pontos de técnica", cost.techniquePoints);
		for (const extra of cost.additional ?? []) addResourceCost(extra.name, extra.amount);
		const resourceCosts = [...requested].map(([name, amount]) => {
			const index = resources.findIndex(entry => normalize(entry.name) === name);
			return index >= 0 ? { resource: resources[index], index, amount } : null;
		}).filter(Boolean);
		const techniqueResource = resources.find(entry => normalize(entry.name) === "pontos de tecnica");
		return {
			chakraCost,
			techniqueCost: techniqueResource ? Math.max(0, Number(cost.techniquePoints) || 0) : 0,
			additionalCosts: (cost.additional ?? []).filter(extra => extra.name && Number(extra.amount) > 0 && resources.some(resource => normalize(resource.name) === normalize(extra.name))).map(extra => ({ name: extra.name, amount: Number(extra.amount) })),
			resourceCosts
		};
	}

	_hasResources(choice) {
		if (!(this.ability.parent instanceof Actor)) return false;
		const plan = this._costPlan(choice);
		if ((Number(this.ability.system.chakra?.chakraPoints) || 0) < plan.chakraCost) {
			ui.notifications.warn("Não há pontos de chakra suficientes para ativar esta habilidade.");
			return false;
		}
		for (const { resource, amount } of plan.resourceCosts) {
			if ((Number(resource.value) || 0) < amount) {
				ui.notifications.warn(`Não há ${resource.name} suficientes para ativar esta habilidade.`);
				return false;
			}
		}
		return true;
	}

	async _consume(choice) {
		if (!this._hasResources(choice)) return false;
		const plan = this._costPlan(choice);
		const changes = {};
		if (plan.chakraCost) changes["system.chakra.chakraPoints"] = Number(this.ability.system.chakra.chakraPoints) - plan.chakraCost;
		if (plan.resourceCosts.length) changes["system.resources"] = (this.ability.system.resources ?? []).map((resource, index) => {
			const charge = plan.resourceCosts.find(entry => entry.index === index);
			return charge ? { ...resource, value: Number(resource.value) - charge.amount } : resource;
		});
		if (Object.keys(changes).length) await this.ability.update(changes);
		ui.notifications.info(`${choice.item.name} ativado.`);
		return true;
	}

	async _activate(choice, move) {
		if (!this._hasResources(choice)) return false;
		const item = choice.item;
		const ability = this.ability;
		const plan = this._costPlan(choice);
		const activationContext = { type: choice.type, itemName: item.name, itemDescription: item.system.description ?? "", abilityName: ability.name, actorUuid: ability.parent.uuid, ...plan };
		if (!(await this._consume(choice))) return false;
		if (move) await move.moveRollJustSend(activationContext);
		if (!move) {
			const escape = value => foundry.utils.escapeHTML(String(value));
			const abilityLink = `<a class="ability-chat-link" data-item-type="ability" data-item-name="${escape(ability.name)}" data-actor-uuid="${escape(ability.parent.uuid)}" title="Abrir habilidade (Shift: ficha do personagem)">${escape(ability.name)}</a>`;
			const itemLink = `<a class="ability-chat-link" data-item-type="${choice.type}" data-item-name="${escape(item.name)}" title="Abrir ${choice.type === "effect" ? "efeito" : "técnica"}">${escape(item.name)}</a>`;
			const chakraDisplay = plan.chakraCost > 0 ? `<span class="chat-tag chakra-info resource-change-display"><img src="systems/naruto2d6world/assets/icons/chakraIcon.png" alt="Chakra"><span class="chakra-change-value">-${plan.chakraCost}</span></span>` : "";
			const techniqueDisplay = plan.techniqueCost > 0 ? `<p class="chat-tag">Pontos de técnica utilizados: ${plan.techniqueCost}</p>` : "";
			const additionalDisplay = plan.additionalCosts.map(extra => `<p class="chat-tag">${escape(extra.name)} utilizado: ${extra.amount}</p>`).join("");
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: ability.parent }),
				rollMode: game.settings.get("core", "rollMode"),
				flavor: `<div class="rollCard"><h3 class="rollcard-title">${abilityLink} ativada</h3><div class="rollcard-content"><p class="chat-tag"><strong>${choice.type === "effect" ? "Efeito" : "Técnica"}:</strong> ${itemLink}</p>${item.system.description ? `<div class="activation-item-description">${item.system.description}</div>` : ""}${chakraDisplay}${techniqueDisplay}${additionalDisplay}</div></div>`
			});
		}
		return true;
	}
}

class ChooseAbilityMoveDialog extends Dialog {
	static create({ activationDialog, choice, moves }) {
		const escape = value => foundry.utils.escapeHTML(String(value));
		const content = `<div class="dialog-activate-ability-content">
			<h3>Movimentos de ${escape(choice.item.name)}</h3>
			<div class="ability-activation-tags">
				${moves.map((move, index) => `<button type="button" class="ability-move-tag" data-move-index="${index}">${escape(move.name)}</button>`).join("")}
				<button type="button" class="ability-no-move">Sem movimento</button>
			</div>
		</div>`;
		const dialog = new this({ title: `Escolher movimento — ${choice.item.name}`, content, buttons: {} });
		dialog.activationDialog = activationDialog;
		dialog.choice = choice;
		dialog.moves = moves;
		dialog.render(true);
		return dialog;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".ability-no-move").on("click", () => this._confirm(null));
		html.find(".ability-move-tag").on("click", event => {
			const move = this.moves[Number(event.currentTarget.dataset.moveIndex)];
			if (!move) return;
			this._confirm(move);
		});
	}

	async _confirm(move) {
		if (this._activating) return;
		this._activating = true;
		try {
			if (!move || !Object.values(move.system.attributes ?? {}).some(attribute => attribute.on)) {
				const activated = await this.activationDialog._activate(this.choice, move);
				if (activated) await this.close();
				return;
			}
			if (!this.activationDialog._hasResources(this.choice)) return;
			await this.close();
			const item = this.choice.item;
			const activationContext = {
				type: this.choice.type, itemName: item.name, itemDescription: item.system.description ?? "", abilityName: this.activationDialog.ability.name,
				actorUuid: this.activationDialog.ability.parent.uuid,
				...this.activationDialog._costPlan(this.choice)
			};
			RollMoveDialog.create(move, {
				activationContext,
				beforeRoll: () => {
					Object.assign(activationContext, this.activationDialog._costPlan(this.choice));
					return this.activationDialog._hasResources(this.choice);
				},
				afterRoll: () => this.activationDialog._consume(this.choice)
			});
		} finally {
			this._activating = false;
		}
	}
}

export default ActivateAbilityDialog;
