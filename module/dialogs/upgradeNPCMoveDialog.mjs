class UpgradeNPCMoveDialog extends Dialog {
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["upgrade-npc-move-dialog"];
        this._currentResolve = null;
        this._actor = null;
        this._upgradableMoves = [];
        this._acquirableMoves = [];
        this._selectedMove = null;
        this._selectedAcquirable = null;
        this._selectedUpgrade = null; // 'maxUses' | 'level'
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            width: 800,
            height: 520,
            resizable: true,
        });
    }

    // ─── Helpers de elegibilidade ─────────────────────────────────────────────

    static _canUpgradeLevel(move) {
        const sys = move.system;
        const upgrades = sys.npcMoveUpgrades;
        if (!upgrades?.isUpgradable) return false;
        if (!sys.npcMoveLevel?.on) return false;
        if (!upgrades.Maxlevel || upgrades.Maxlevel <= 0) return false;
        return sys.npcMoveLevel.value < upgrades.Maxlevel;
    }

    static _canUpgradeMaxUses(move) {
        const sys = move.system;
        const upgrades = sys.npcMoveUpgrades;
        if (!upgrades?.isUpgradable) return false;
        if (!sys.npcUses?.on) return false;
        if (!upgrades.MaxmoveUses || upgrades.MaxmoveUses <= 0) return false;
        return sys.npcUses.max < upgrades.MaxmoveUses;
    }

    static _hasAnyUpgrade(move) {
        return UpgradeNPCMoveDialog._canUpgradeLevel(move) ||
            UpgradeNPCMoveDialog._canUpgradeMaxUses(move);
    }

    static _getUpgradeCost(move, upgradeType) {
        const upgrades = move.system.npcMoveUpgrades;
        if (upgradeType === "level") return upgrades.levelUpgradeCost ?? 1;
        if (upgradeType === "maxUses") return upgrades.moveUseUpgradeCost ?? 1;
        return 1;
    }

    // ─── Criação do dialog ───────────────────────────────────────────────────

    static async create({ actor }) {
        // 1. Movimentos que o NPC já tem e podem receber upgrade
        const upgradableMoves = actor.items.filter(
            (item) => item.type === "move" && UpgradeNPCMoveDialog._hasAnyUpgrade(item)
        );

        // 2. Movimentos do sistema (World + Compendiums) que podem ser adquiridos
        let rawAcquirables = [];

        // Verifica se o usuário atual tem cargo GM ou Gamemaster Assistant
        const isGMOrAssistant = game.user.isGM || game.user.role >= CONST.USER_ROLES.ASSISTANT;

        // Regra: se não for GM/Assistant e o move tiver canBePlayerAcquired = false, não pode adquirir
        const _canAcquireMove = (sys) => {
            const upgrades = sys?.npcMoveUpgrades;
            if (!upgrades?.canBeNPCAcquired) return false;
            if (upgrades.canBePlayerAcquired === false && !isGMOrAssistant) return false;
            return true;
        };

        // Itens do World
        for (const item of game.items) {
            if (item.type === "move" && _canAcquireMove(item.system)) {
                rawAcquirables.push(item);
            }
        }

        // Itens de Compendiums
        for (const pack of game.packs.values()) {
            if (pack.documentName === "Item") {
                const index = await pack.getIndex({ fields: ["type", "system.npcMoveUpgrades.canBeNPCAcquired"] });
                for (const idx of index) {
                    if (idx.type === "move" && idx.system?.npcMoveUpgrades?.canBeNPCAcquired) {
                        const doc = await pack.getDocument(idx._id);
                        if (_canAcquireMove(doc.system)) {
                            rawAcquirables.push(doc);
                        }
                    }
                }
            }
        }

        // Filtrar os que o NPC já tem (pelo nome exato)
        rawAcquirables = rawAcquirables.filter(m => !actor.items.some(i => i.name === m.name));

        // Remover duplicatas pelo nome
        const acquirableMoves = [];
        const seenNames = new Set();
        for (const m of rawAcquirables) {
            if (!seenNames.has(m.name)) {
                seenNames.add(m.name);
                acquirableMoves.push(m);
            }
        }

        if (upgradableMoves.length === 0 && acquirableMoves.length === 0) {
            ui.notifications.warn(`${actor.name} não possui movimentos para upgrade nem novos movimentos para adquirir.`);
            return;
        }

        const content = UpgradeNPCMoveDialog._buildContent(actor, upgradableMoves, acquirableMoves);

        return new Promise((resolve) => {
            const dlg = new this({
                title: `Upgrades e Movimentos — ${actor.name}`,
                content,
                buttons: {},
                close: () => { resolve(false); }
            });

            dlg._currentResolve = resolve;
            dlg._actor = actor;
            dlg._upgradableMoves = upgradableMoves;
            dlg._acquirableMoves = acquirableMoves;
            dlg.render(true);
        });
    }

    // ─── HTML ────────────────────────────────────────────────────────────────

    static _buildContent(actor, upgradableMoves, acquirableMoves) {
        const xp = actor.system.leveling?.xp ?? 0;

        const moveListItems = upgradableMoves.map((move) => `
            <li class="upgrade-move-item" data-move-id="${move.id}">
                <span class="upgrade-move-name">${move.name}</span>
                <div>
                    <button type="button" class="upgrade-move-btn" data-move-id="${move.id}">
                        <i class="fa-solid fa-arrow-up"></i> Upgrade
                    </button>
                </div>
            </li>
        `).join("") || `<li class="upgrade-move-item empty">Nenhum disponível.</li>`;

        // É importante usar um identificador único seguro (aqui usamos um índice temporal/lógico ou apenas o id do item)
        // Como itens podem vir de compendiums diferentes e ter IDs iguais, vamos usar o .id mesmo, 
        // ou criar um ID de sessão para cada um. Vamos usar o ID do documento.
        const acquirableListItems = acquirableMoves.map((move) => `
            <li class="upgrade-move-item" data-acquirable-id="${move.id}">
                <span class="upgrade-move-name">${move.name}</span>
                <div>
                    <button type="button" class="acquire-move-btn" data-acquirable-id="${move.id}">
                        <i class="fa-solid fa-plus"></i> Adquirir
                    </button>
                </div>
            </li>
        `).join("") || `<li class="upgrade-move-item empty">Nenhum disponível.</li>`;

        return `
            <div class="upgrade-npc-move-content">
                <div class="upgrade-xp-bar">
                    <i class="fa-solid fa-star"></i>
                    <span>XP disponível: <strong class="xp-value">${xp}</strong></span>
                </div>
                <div class="upgrade-layout">
                    <div class="upgrade-move-list-panel">
                        <h3>Upgrades</h3>
                        <ul class="upgrade-move-list">
                            ${moveListItems}
                        </ul>
                        <h3>Adquirir Novos</h3>
                        <ul class="upgrade-move-list">
                            ${acquirableListItems}
                        </ul>
                    </div>
                    <div class="upgrade-move-detail-panel">
                        <div class="upgrade-move-detail-placeholder">
                            <i class="fa-solid fa-hand-pointer"></i>
                            <p>Clique em um movimento para ver seus detalhes.</p>
                        </div>
                    </div>
                </div>

                <!-- Overlay de Upgrade -->
                <div class="upgrade-choice-overlay hidden" id="overlay-upgrade">
                    <div class="upgrade-choice-box">
                        <h3 class="upgrade-choice-title">Escolha o upgrade</h3>
                        <div class="upgrade-choice-options">
                            <label class="upgrade-choice-option" data-choice="maxUses">
                                <input type="radio" name="upgrade-choice" value="maxUses">
                                <span class="upgrade-choice-label">Aumentar Usos Máximos</span>
                            </label>
                            <label class="upgrade-choice-option" data-choice="level">
                                <input type="radio" name="upgrade-choice" value="level">
                                <span class="upgrade-choice-label">Aumentar Nível</span>
                            </label>
                        </div>
                        <div class="upgrade-choice-buttons">
                            <button type="button" class="upgrade-confirm-btn">
                                <i class="fa-solid fa-check"></i> <span class="confirm-btn-label">Confirmar</span>
                            </button>
                            <button type="button" class="upgrade-cancel-btn">
                                <i class="fa-solid fa-xmark"></i> Cancelar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Overlay de Adquirir -->
                <div class="upgrade-choice-overlay hidden" id="overlay-acquire">
                    <div class="upgrade-choice-box">
                        <h3 class="upgrade-choice-title">Adquirir Movimento</h3>
                        <p class="acquire-desc">Tem certeza que deseja adquirir este movimento?</p>
                        <div class="upgrade-choice-buttons">
                            <button type="button" class="acquire-confirm-btn">
                                <i class="fa-solid fa-check"></i> <span class="acquire-confirm-label">Confirmar</span>
                            </button>
                            <button type="button" class="acquire-cancel-btn">
                                <i class="fa-solid fa-xmark"></i> Cancelar
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }

    static _buildDetailHTML(move, isAcquirable = false) {
        const sys = move.system;
        const upgrades = sys.npcMoveUpgrades;

        const levelSection = sys.npcMoveLevel?.on
            ? `<div class="detail-row">
                <span class="detail-label">Nível atual:</span>
                <span class="detail-value">${sys.npcMoveLevel.value} / ${upgrades?.Maxlevel || "—"}</span>
               </div>
               <div class="detail-row">
                <span class="detail-label">Custo do Nível:</span>
                <span class="detail-value">${upgrades?.levelUpgradeCost || "—"} XP</span>
               </div>`
            : "";

        const usesSection = sys.npcUses?.on
            ? `<div class="detail-row">
                <span class="detail-label">Usos (mín / máx):</span>
                <span class="detail-value">${sys.npcUses.min} / ${sys.npcUses.max} (limite: ${upgrades?.MaxmoveUses || "—"})</span>
               </div>
               <div class="detail-row">
                <span class="detail-label">Custo de Usos:</span>
                <span class="detail-value">${upgrades?.moveUseUpgradeCost || "—"} XP</span>
               </div>`
            : "";

        const acquireSection = isAcquirable
            ? `<div class="detail-row" style="margin-top: 10px; color: #5a8a5a;">
                <span class="detail-label">Custo para Adquirir:</span>
                <span class="detail-value">${upgrades?.levelUpgradeCost ?? 1} XP</span>
               </div>`
            : "";

        return `
            <div class="upgrade-move-detail">
                <h3 class="detail-move-name">${move.name}</h3>
                <div class="detail-description">${sys.description || "<em>Sem descrição.</em>"}</div>
                <div class="detail-stats">
                    ${levelSection}
                    ${usesSection}
                    ${acquireSection}
                </div>
            </div>
        `;
    }

    // ─── Listeners ───────────────────────────────────────────────────────────

    activateListeners(html) {
        super.activateListeners(html);

        // -- Upgrade (lista de cima)
        html.find(".upgrade-move-item[data-move-id]").on("click", (e) => {
            if (e.target.closest(".upgrade-move-btn")) return;
            const moveId = e.currentTarget.getAttribute("data-move-id");
            this._selectMove(html, moveId);
        });

        html.find(".upgrade-move-btn").on("click", (e) => {
            e.stopPropagation();
            const moveId = e.currentTarget.getAttribute("data-move-id");
            this._selectMove(html, moveId);
            this._openUpgradeChoice(html, moveId);
        });

        html.find('input[name="upgrade-choice"]').on("change", () => {
            this._updateConfirmButtonLabel(html);
        });

        html.find(".upgrade-confirm-btn").on("click", () => {
            this._confirmUpgrade(html);
        });

        html.find(".upgrade-cancel-btn").on("click", () => {
            this._closeUpgradeChoice(html);
        });

        // -- Adquirir (lista de baixo)
        html.find(".upgrade-move-item[data-acquirable-id]").on("click", (e) => {
            if (e.target.closest(".acquire-move-btn")) return;
            const moveId = e.currentTarget.getAttribute("data-acquirable-id");
            this._selectAcquirable(html, moveId);
        });

        html.find(".acquire-move-btn").on("click", (e) => {
            e.stopPropagation();
            const moveId = e.currentTarget.getAttribute("data-acquirable-id");
            this._selectAcquirable(html, moveId);
            this._openAcquireChoice(html, moveId);
        });

        html.find(".acquire-confirm-btn").on("click", () => {
            this._confirmAcquire(html);
        });

        html.find(".acquire-cancel-btn").on("click", () => {
            this._closeAcquireChoice(html);
        });
    }

    // ─── Lógica de Seleção ───────────────────────────────────────────────────

    _selectMove(html, moveId) {
        this._selectedMove = this._upgradableMoves.find((m) => m.id === moveId) ?? null;
        this._selectedAcquirable = null;

        html.find(".upgrade-move-item").removeClass("selected");
        html.find(`.upgrade-move-item[data-move-id="${moveId}"]`).addClass("selected");

        const detailPanel = html.find(".upgrade-move-detail-panel")[0];
        if (this._selectedMove) {
            detailPanel.innerHTML = UpgradeNPCMoveDialog._buildDetailHTML(this._selectedMove, false);
        }
    }

    _selectAcquirable(html, moveId) {
        this._selectedAcquirable = this._acquirableMoves.find((m) => m.id === moveId) ?? null;
        this._selectedMove = null;

        html.find(".upgrade-move-item").removeClass("selected");
        html.find(`.upgrade-move-item[data-acquirable-id="${moveId}"]`).addClass("selected");

        const detailPanel = html.find(".upgrade-move-detail-panel")[0];
        if (this._selectedAcquirable) {
            detailPanel.innerHTML = UpgradeNPCMoveDialog._buildDetailHTML(this._selectedAcquirable, true);
        }
    }

    // ─── Lógica de Upgrade ───────────────────────────────────────────────────

    _openUpgradeChoice(html, moveId) {
        this._selectedMove = this._upgradableMoves.find((m) => m.id === moveId) ?? null;
        this._selectedUpgrade = null;

        const move = this._selectedMove;
        const sys = move?.system;
        const upgrades = sys?.npcMoveUpgrades;

        const canUseMaxUses = UpgradeNPCMoveDialog._canUpgradeMaxUses(move);
        const canUseLevel = UpgradeNPCMoveDialog._canUpgradeLevel(move);

        const choiceLabels = html.find("#overlay-upgrade .upgrade-choice-label");
        const usesLabel = `Aumentar Usos Máximos (${sys?.npcUses?.max ?? "—"} → ${Number(sys?.npcUses?.max ?? 0) + 1} / limite: ${upgrades?.MaxmoveUses ?? "—"}) — Custo: ${upgrades?.moveUseUpgradeCost ?? "—"} XP`;
        const levelLabel = `Aumentar Nível (${sys?.npcMoveLevel?.value ?? "—"} → ${Number(sys?.npcMoveLevel?.value ?? 0) + 1} / limite: ${upgrades?.Maxlevel ?? "—"}) — Custo: ${upgrades?.levelUpgradeCost ?? "—"} XP`;

        if (choiceLabels[0]) choiceLabels[0].textContent = usesLabel;
        if (choiceLabels[1]) choiceLabels[1].textContent = levelLabel;

        const radios = html.find('#overlay-upgrade input[name="upgrade-choice"]');
        const optionMaxUses = html.find('#overlay-upgrade .upgrade-choice-option[data-choice="maxUses"]');
        const optionLevel = html.find('#overlay-upgrade .upgrade-choice-option[data-choice="level"]');

        if (radios.length >= 2) {
            radios[0].disabled = !canUseMaxUses;
            if (!canUseMaxUses) optionMaxUses.hide(); else optionMaxUses.show();

            radios[1].disabled = !canUseLevel;
            if (!canUseLevel) optionLevel.hide(); else optionLevel.show();

            radios.prop("checked", false);
            for (const radio of radios) {
                if (!radio.disabled) {
                    radio.checked = true;
                    break;
                }
            }
        }

        html.find("#overlay-upgrade .upgrade-choice-title").text(`Upgrade: ${move?.name}`);
        this._updateConfirmButtonLabel(html);
        html.find("#overlay-upgrade").removeClass("hidden");
    }

    _updateConfirmButtonLabel(html) {
        const checkedRadio = html.find('#overlay-upgrade input[name="upgrade-choice"]:checked')[0];
        const labelEl = html.find("#overlay-upgrade .confirm-btn-label")[0];
        if (!labelEl) return;

        if (!checkedRadio || !this._selectedMove) {
            labelEl.textContent = "Confirmar";
            return;
        }

        const cost = UpgradeNPCMoveDialog._getUpgradeCost(this._selectedMove, checkedRadio.value);
        labelEl.textContent = `Confirmar (−${cost} XP)`;
    }

    _closeUpgradeChoice(html) {
        html.find("#overlay-upgrade").addClass("hidden");
        html.find('#overlay-upgrade input[name="upgrade-choice"]').prop("checked", false);
        this._selectedUpgrade = null;
    }

    async _confirmUpgrade(html) {
        const checkedRadio = html.find('#overlay-upgrade input[name="upgrade-choice"]:checked')[0];
        if (!checkedRadio) {
            ui.notifications.warn("Escolha uma opção de upgrade antes de confirmar.");
            return;
        }

        const upgradeType = checkedRadio.value;
        const move = this._selectedMove;
        const actor = this._actor;

        if (!move || !actor) return;

        const sys = move.system;
        const cost = UpgradeNPCMoveDialog._getUpgradeCost(move, upgradeType);
        const currentXP = actor.system.leveling?.xp ?? 0;

        if (currentXP < cost) {
            ui.notifications.error(
                `${actor.name} não possui XP suficiente. Necessário: ${cost} XP. Disponível: ${currentXP} XP.`
            );
            return;
        }

        let upgradeLabel = "";

        if (upgradeType === "maxUses") {
            if (!UpgradeNPCMoveDialog._canUpgradeMaxUses(move)) {
                ui.notifications.warn(`${move.name} já atingiu o limite máximo de usos.`);
                return;
            }
            const newMax = Number(sys.npcUses.max) + 1;
            await move.update({ "system.npcUses.max": newMax });
            upgradeLabel = `Usos Máximos: ${sys.npcUses.max} → ${newMax}`;
        } else if (upgradeType === "level") {
            if (!UpgradeNPCMoveDialog._canUpgradeLevel(move)) {
                ui.notifications.warn(`${move.name} já atingiu o nível máximo.`);
                return;
            }
            const newLevel = Number(sys.npcMoveLevel.value) + 1;
            await move.update({ "system.npcMoveLevel.value": newLevel });
            upgradeLabel = `Nível: ${sys.npcMoveLevel.value} → ${newLevel}`;
        }

        const newXP = currentXP - cost;
        await actor.update({ "system.leveling.xp": newXP });

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<p><strong>Upgrade de Movimento!</strong></p>
                <p>Movimento <strong>${move.name}</strong> do NPC <strong>${actor.name}</strong> recebeu um upgrade: <em>${upgradeLabel}</em>.</p>
                <p><small>Custo: ${cost} XP | XP restante: ${newXP}</small></p>`
        });

        ui.notifications.info(`${move.name} recebeu upgrade: ${upgradeLabel}. Custo: ${cost} XP. XP restante: ${newXP}.`);

        if (this._currentResolve) this._currentResolve(true);
        this.close();
    }

    // ─── Lógica de Aquisição ─────────────────────────────────────────────────

    _openAcquireChoice(html, moveId) {
        this._selectedAcquirable = this._acquirableMoves.find((m) => m.id === moveId) ?? null;
        if (!this._selectedAcquirable) return;

        const move = this._selectedAcquirable;
        const cost = move.system.npcMoveUpgrades?.levelUpgradeCost ?? 1;

        html.find("#overlay-acquire .upgrade-choice-title").text(`Adquirir: ${move.name}`);
        html.find("#overlay-acquire .acquire-desc").html(`Deseja adquirir o movimento <strong>${move.name}</strong>?`);
        html.find("#overlay-acquire .acquire-confirm-label").text(`Confirmar (−${cost} XP)`);

        html.find("#overlay-acquire").removeClass("hidden");
    }

    _closeAcquireChoice(html) {
        html.find("#overlay-acquire").addClass("hidden");
        this._selectedAcquirable = null;
    }

    async _confirmAcquire(html) {
        const move = this._selectedAcquirable;
        const actor = this._actor;
        if (!move || !actor) return;

        const cost = move.system.npcMoveUpgrades?.levelUpgradeCost ?? 1;
        const currentXP = actor.system.leveling?.xp ?? 0;

        if (currentXP < cost) {
            ui.notifications.error(
                `${actor.name} não possui XP suficiente. Necessário: ${cost} XP. Disponível: ${currentXP} XP.`
            );
            return;
        }

        // Adicionar ao NPC
        const moveData = move.toObject();
        // Garantir que ID seja regenerado para o novo item
        delete moveData._id;

        await Item.create(moveData, { parent: actor });

        const newXP = currentXP - cost;
        await actor.update({ "system.leveling.xp": newXP });

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<p><strong>Novo Movimento Adquirido!</strong></p>
                <p>O NPC <strong>${actor.name}</strong> adquiriu o movimento <strong>${move.name}</strong>.</p>
                <p><small>Custo: ${cost} XP | XP restante: ${newXP}</small></p>`
        });

        ui.notifications.info(`${move.name} adquirido! Custo: ${cost} XP. XP restante: ${newXP}.`);

        if (this._currentResolve) this._currentResolve(true);
        this.close();
    }
}

export default UpgradeNPCMoveDialog;
