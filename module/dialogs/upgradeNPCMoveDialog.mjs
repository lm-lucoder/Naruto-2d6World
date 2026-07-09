class UpgradeNPCMoveDialog extends Dialog {
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["upgrade-npc-move-dialog"];
        this._currentResolve = null;
        this._actor = null;
        this._upgradableMoves = [];
        this._selectedMove = null;
        this._selectedUpgrade = null; // 'maxUses' | 'level'
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            width: 600,
            height: 480,
            resizable: true,
        });
    }

    // ─── Helpers de elegibilidade ─────────────────────────────────────────────

    /**
     * Retorna true se o upgrade de nível é possível para este movimento.
     * Condição: npcMoveLevel.on === true E npcMoveLevel.value < Maxlevel E Maxlevel > 0.
     */
    static _canUpgradeLevel(move) {
        const sys = move.system;
        const upgrades = sys.npcMoveUpgrades;
        if (!upgrades?.isUpgradable) return false;
        if (!sys.npcMoveLevel?.on) return false;
        if (!upgrades.Maxlevel || upgrades.Maxlevel <= 0) return false;
        return sys.npcMoveLevel.value < upgrades.Maxlevel;
    }

    /**
     * Retorna true se o upgrade de usos máximos é possível para este movimento.
     * Condição: npcUses.on === true E npcUses.max < MaxmoveUses E MaxmoveUses > 0.
     */
    static _canUpgradeMaxUses(move) {
        const sys = move.system;
        const upgrades = sys.npcMoveUpgrades;
        if (!upgrades?.isUpgradable) return false;
        if (!sys.npcUses?.on) return false;
        if (!upgrades.MaxmoveUses || upgrades.MaxmoveUses <= 0) return false;
        return sys.npcUses.max < upgrades.MaxmoveUses;
    }

    /**
     * Retorna true se o movimento tem pelo menos um upgrade possível.
     */
    static _hasAnyUpgrade(move) {
        return UpgradeNPCMoveDialog._canUpgradeLevel(move) ||
               UpgradeNPCMoveDialog._canUpgradeMaxUses(move);
    }

    /**
     * Retorna o custo em XP para o tipo de upgrade escolhido.
     */
    static _getUpgradeCost(move, upgradeType) {
        const upgrades = move.system.npcMoveUpgrades;
        if (upgradeType === "level") return upgrades.levelUpgradeCost ?? 1;
        if (upgradeType === "maxUses") return upgrades.moveUseUpgradeCost ?? 1;
        return 1;
    }

    // ─── Criação do dialog ───────────────────────────────────────────────────

    /**
     * @param {Actor} actor - O ator NPC dono dos movimentos
     */
    static async create({ actor }) {
        // Filtrar movimentos que de fato têm pelo menos um upgrade possível
        const upgradableMoves = actor.items.filter(
            (item) => item.type === "move" && UpgradeNPCMoveDialog._hasAnyUpgrade(item)
        );

        if (upgradableMoves.length === 0) {
            ui.notifications.warn(`${actor.name} não possui movimentos que podem receber upgrades no momento.`);
            return;
        }

        const content = UpgradeNPCMoveDialog._buildContent(actor, upgradableMoves);

        return new Promise((resolve) => {
            const dlg = new this({
                title: `Upgrade de Movimentos — ${actor.name}`,
                content,
                buttons: {},
                close: () => { resolve(false); }
            });

            dlg._currentResolve = resolve;
            dlg._actor = actor;
            dlg._upgradableMoves = upgradableMoves;
            dlg.render(true);
        });
    }

    // ─── HTML ────────────────────────────────────────────────────────────────

    static _buildContent(actor, upgradableMoves) {
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
        `).join("");

        return `
            <div class="upgrade-npc-move-content">
                <div class="upgrade-xp-bar">
                    <i class="fa-solid fa-star"></i>
                    <span>XP disponível: <strong class="xp-value">${xp}</strong></span>
                </div>
                <div class="upgrade-layout">
                    <div class="upgrade-move-list-panel">
                        <h3>Movimentos</h3>
                        <ul class="upgrade-move-list">
                            ${moveListItems}
                        </ul>
                    </div>
                    <div class="upgrade-move-detail-panel">
                        <div class="upgrade-move-detail-placeholder">
                            <i class="fa-solid fa-hand-pointer"></i>
                            <p>Clique em um movimento para ver seus detalhes.</p>
                        </div>
                    </div>
                </div>

                <!-- Sub-dialog de escolha de upgrade (oculto até clicar em "Upgrade") -->
                <div class="upgrade-choice-overlay hidden">
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
            </div>
        `;
    }

    static _buildDetailHTML(move) {
        const sys = move.system;
        const upgrades = sys.npcMoveUpgrades;

        const levelSection = sys.npcMoveLevel?.on
            ? `<div class="detail-row">
                <span class="detail-label">Nível:</span>
                <span class="detail-value">${sys.npcMoveLevel.value} / ${upgrades.Maxlevel || "—"}</span>
               </div>
               <div class="detail-row">
                <span class="detail-label">Custo (nível):</span>
                <span class="detail-value">${upgrades.levelUpgradeCost || "—"} XP</span>
               </div>`
            : "";

        const usesSection = sys.npcUses?.on
            ? `<div class="detail-row">
                <span class="detail-label">Usos (mín / máx):</span>
                <span class="detail-value">${sys.npcUses.min} / ${sys.npcUses.max} (limite: ${upgrades.MaxmoveUses || "—"})</span>
               </div>
               <div class="detail-row">
                <span class="detail-label">Custo (usos):</span>
                <span class="detail-value">${upgrades.moveUseUpgradeCost || "—"} XP</span>
               </div>`
            : "";

        return `
            <div class="upgrade-move-detail">
                <h3 class="detail-move-name">${move.name}</h3>
                <div class="detail-description">${sys.description || "<em>Sem descrição.</em>"}</div>
                <div class="detail-stats">
                    ${levelSection}
                    ${usesSection}
                </div>
            </div>
        `;
    }

    // ─── Listeners ───────────────────────────────────────────────────────────

    activateListeners(html) {
        super.activateListeners(html);

        // Selecionar movimento ao clicar no item da lista
        html.find(".upgrade-move-item").on("click", (e) => {
            if (e.target.closest(".upgrade-move-btn")) return; // deixa o botão tratar
            const moveId = e.currentTarget.getAttribute("data-move-id");
            this._selectMove(html, moveId);
        });

        // Botão "Upgrade" de cada movimento
        html.find(".upgrade-move-btn").on("click", (e) => {
            e.stopPropagation();
            const moveId = e.currentTarget.getAttribute("data-move-id");
            this._selectMove(html, moveId);
            this._openUpgradeChoice(html, moveId);
        });

        // Atualizar custo mostrado quando o usuário muda a opção de upgrade
        html.find('input[name="upgrade-choice"]').on("change", () => {
            this._updateConfirmButtonLabel(html);
        });

        // Confirmar upgrade
        html.find(".upgrade-confirm-btn").on("click", () => {
            this._confirmUpgrade(html);
        });

        // Cancelar upgrade
        html.find(".upgrade-cancel-btn").on("click", () => {
            this._closeUpgradeChoice(html);
        });
    }

    // ─── Lógica ──────────────────────────────────────────────────────────────

    _selectMove(html, moveId) {
        this._selectedMove = this._upgradableMoves.find((m) => m.id === moveId) ?? null;

        // Destacar item selecionado na lista
        html.find(".upgrade-move-item").removeClass("selected");
        html.find(`.upgrade-move-item[data-move-id="${moveId}"]`).addClass("selected");

        // Renderizar detalhes no painel direito
        const detailPanel = html.find(".upgrade-move-detail-panel")[0];
        if (this._selectedMove) {
            detailPanel.innerHTML = UpgradeNPCMoveDialog._buildDetailHTML(this._selectedMove);
        }
    }

    _openUpgradeChoice(html, moveId) {
        this._selectedMove = this._upgradableMoves.find((m) => m.id === moveId) ?? null;
        this._selectedUpgrade = null;

        const move = this._selectedMove;
        const sys = move?.system;
        const upgrades = sys?.npcMoveUpgrades;

        const canUseMaxUses = UpgradeNPCMoveDialog._canUpgradeMaxUses(move);
        const canUseLevel   = UpgradeNPCMoveDialog._canUpgradeLevel(move);

        // Atualizar rótulos com limites e custo
        const choiceLabels = html.find(".upgrade-choice-label");
        const usesLabel  = `Aumentar Usos Máximos (${sys?.npcUses?.max ?? "—"} → ${Number(sys?.npcUses?.max ?? 0) + 1} / limite: ${upgrades?.MaxmoveUses ?? "—"}) — Custo: ${upgrades?.moveUseUpgradeCost ?? "—"} XP`;
        const levelLabel = `Aumentar Nível (${sys?.npcMoveLevel?.value ?? "—"} → ${Number(sys?.npcMoveLevel?.value ?? 0) + 1} / limite: ${upgrades?.Maxlevel ?? "—"}) — Custo: ${upgrades?.levelUpgradeCost ?? "—"} XP`;
        choiceLabels[0].textContent = usesLabel;
        choiceLabels[1].textContent = levelLabel;

        // Controlar disponibilidade e visibilidade das opções
        const radios = html.find('input[name="upgrade-choice"]');
        const optionMaxUses = html.find('.upgrade-choice-option[data-choice="maxUses"]');
        const optionLevel = html.find('.upgrade-choice-option[data-choice="level"]');

        radios[0].disabled = !canUseMaxUses;
        if (!canUseMaxUses) optionMaxUses.hide(); else optionMaxUses.show();

        radios[1].disabled = !canUseLevel;
        if (!canUseLevel) optionLevel.hide(); else optionLevel.show();

        // Pré-selecionar a primeira opção disponível
        radios.prop("checked", false);
        for (const radio of radios) {
            if (!radio.disabled) {
                radio.checked = true;
                break;
            }
        }

        // Título do overlay
        html.find(".upgrade-choice-title")[0].textContent = `Upgrade: ${move?.name}`;

        // Atualizar label do botão confirmar
        this._updateConfirmButtonLabel(html);

        // Mostrar overlay
        html.find(".upgrade-choice-overlay").removeClass("hidden");
    }

    _updateConfirmButtonLabel(html) {
        const checkedRadio = html.find('input[name="upgrade-choice"]:checked')[0];
        const labelEl = html.find(".confirm-btn-label")[0];
        if (!labelEl) return;

        if (!checkedRadio || !this._selectedMove) {
            labelEl.textContent = "Confirmar";
            return;
        }

        const cost = UpgradeNPCMoveDialog._getUpgradeCost(this._selectedMove, checkedRadio.value);
        labelEl.textContent = `Confirmar (−${cost} XP)`;
    }

    _closeUpgradeChoice(html) {
        html.find(".upgrade-choice-overlay").addClass("hidden");
        html.find('input[name="upgrade-choice"]').prop("checked", false);
        this._selectedUpgrade = null;
    }

    async _confirmUpgrade(html) {
        const checkedRadio = html.find('input[name="upgrade-choice"]:checked')[0];
        if (!checkedRadio) {
            ui.notifications.warn("Escolha uma opção de upgrade antes de confirmar.");
            return;
        }

        const upgradeType = checkedRadio.value; // 'maxUses' | 'level'
        const move = this._selectedMove;
        const actor = this._actor;

        if (!move || !actor) return;

        const sys = move.system;
        const upgrades = sys.npcMoveUpgrades;

        // Custo dinâmico conforme o tipo de upgrade
        const cost = UpgradeNPCMoveDialog._getUpgradeCost(move, upgradeType);

        // Verificar XP suficiente
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

        // Reduzir XP do NPC pelo custo configurado
        const newXP = currentXP - cost;
        await actor.update({ "system.leveling.xp": newXP });

        // Mensagem no chat
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<p><strong>Upgrade de Movimento!</strong></p>
                <p>Movimento <strong>${move.name}</strong> do NPC <strong>${actor.name}</strong> recebeu um upgrade: <em>${upgradeLabel}</em>.</p>
                <p><small>Custo: ${cost} XP | XP restante: ${newXP}</small></p>`
        });

        ui.notifications.info(`${move.name} recebeu upgrade: ${upgradeLabel}. Custo: ${cost} XP. XP restante: ${newXP}.`);

        if (this._currentResolve) {
            this._currentResolve(true);
        }
        this.close();
    }
}

export default UpgradeNPCMoveDialog;
