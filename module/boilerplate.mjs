// Import document classes.
import { BoilerplateActor } from "./documents/actor.mjs";
import { BoilerplateItem } from "./documents/item.mjs";
// Import sheet classes.
import { BoilerplateActorSheet } from "./sheets/actor-sheet.mjs";
import { BoilerplateItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { BOILERPLATE } from "./helpers/config.mjs";
import AlterMoveResultDialog from "./dialogs/alterMoveResultDialog.mjs";
import RollMoveDialog from "./dialogs/rollMoveDialog.mjs";
import ManageNVModifiersDialog from "./dialogs/manageNVModifiersDialog.mjs";
import { GameSettings } from "./settings/settings.mjs";
import { CharacterTrackerService } from "./services/character-tracker-service.mjs";
import { MasterNVModifierService } from "./services/master-nv-modifier-service.mjs";
import { MoveRollSessionService } from "./services/move-roll-session-service.mjs";
import { MarkerHudService } from "./services/marker-hud-service.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function () {

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  GameSettings.start();

  game.boilerplate = {
    BoilerplateActor,
    BoilerplateItem,
    rollItemMacro
  };
  game.naruto2d6world = {
    characterTracker: CharacterTrackerService,
    masterNVModifiers: MasterNVModifierService,
    moveRollSessions: MoveRollSessionService,
    markerHud: MarkerHudService
  };

  // Add custom constants for configuration.
  CONFIG.BOILERPLATE = BOILERPLATE;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  /* CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod",
    decimals: 2
  }; */

  // Define custom Document classes
  CONFIG.Actor.documentClass = BoilerplateActor;
  CONFIG.Item.documentClass = BoilerplateItem;

  Hooks.on("preCreateItem", (item, data, options, userId) => {
    const parent = item.parent ?? options?.parent;
    if (BoilerplateItem.canBeAddedToActor(item.type ?? data.type, parent)) return;
    if (game.user.id === userId) {
      ui.notifications.error("Marcadores são incompatíveis com fichas de personagem.");
    }
    return false;
  });

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("boilerplate", BoilerplateActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("boilerplate", BoilerplateItemSheet, { makeDefault: true });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper('concat', function () {
  var outStr = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      outStr += arguments[arg];
    }
  }
  return outStr;
});

Handlebars.registerHelper('multiply', function (a, b) {
  return a * b
});
Handlebars.registerHelper('multiplyWithTwoDecimalsMax', function (a, b) {
  const result = a * b
  const roundedResult = Math.round(result * 100) / 100;
  return roundedResult
});
Handlebars.registerHelper('formatTwoDecimals', function (value) {
  if (value === null || value === undefined || isNaN(value)) return value;
  const numValue = parseFloat(value);
  const roundedResult = Math.round(numValue * 100) / 100;
  return roundedResult;
});
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('console', function (thing) {
  console.log(thing);
})
Handlebars.registerHelper('lowerThan', function (a, b) {
  return a < b
})
Handlebars.registerHelper('greaterThan', function (a, b) {
  return a > b
})
Handlebars.registerHelper("between", function (value, min, max) {
  return value >= min && value <= max;
});
Handlebars.registerHelper('equals', function (a, b) {
  return a == b
})

//Handlebars específicos
Handlebars.registerHelper('renderNvText', function (actualNv) {
  const { greatDisadvantage, disadvantage, advantage, greatAdvantage } = GameSettings.getNVThresholds();

  switch (true) {
    case actualNv <= greatDisadvantage: return "Grande Desvantagem";
    case (actualNv <= disadvantage && actualNv > greatDisadvantage): return "Desvantagem";
    case (actualNv >= advantage && actualNv < greatAdvantage): return "Vantagem";
    case actualNv >= greatAdvantage: return "Grande Vantagem";
    default: return "Normal";
  }

})

Handlebars.registerHelper('renderNvClass', function (actualNv) {
  const { greatDisadvantage, disadvantage, advantage, greatAdvantage } = GameSettings.getNVThresholds();

  switch (true) {
    case actualNv <= greatDisadvantage: return "real-bad";
    case (actualNv <= disadvantage && actualNv > greatDisadvantage): return "bad";
    case (actualNv >= advantage && actualNv < greatAdvantage): return "good";
    case actualNv >= greatAdvantage: return "really-good";
    default: return "neutral";
  }
})

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

  await MasterNVModifierService.migrateLegacySetting();
  MoveRollSessionService.initialize({
    dialogFactory: (item, options) => RollMoveDialog.create(item, options)
  });
  ManageNVModifiersDialog.initializeSocket();
  MarkerHudService.initialize();

  // Chat Move Message card Reroll event
  window.addEventListener("click", async (event) => {
    if (event.target.classList.contains("reroll-dice")) {
      const button = event.target
      const chatMessageCard = button.closest(".chat-message")
      const messageId = chatMessageCard.dataset.messageId
      const oldMessage = game.messages.get(messageId)
      if (!oldMessage) return console.error(`Message: ${messageId} not found`);
      const rollCard = chatMessageCard.querySelector(".rollCard")
      const { attribute, advantageLevel, rollModifier, actor, item } = rollCard.dataset
      const { rerollMode } = button.dataset

      // Ler valores dos data attributes em vez do texto visível
      const challengeDiceOneElement = rollCard.querySelector(".challengeDiceOneDisplay")
      const challengeDiceTwoElement = rollCard.querySelector(".challengeDiceTwoDisplay")
      const actionDiceElement = rollCard.querySelector(".actionDiceDisplay")

      const challengeDiceOneResult = challengeDiceOneElement?.dataset.challengeDiceOneValue || challengeDiceOneElement?.innerText.trim().split("<")[0]
      const challengeDiceTwoResult = challengeDiceTwoElement?.dataset.challengeDiceTwoValue || challengeDiceTwoElement?.innerText.trim().split("<")[0]
      const actionDiceResult = actionDiceElement?.dataset.actionDiceValue || actionDiceElement?.innerText.trim()

      const move = await fromUuid(`Actor.${actor}.Item.${item}`)
      if (rerollMode == "free" && !game.user.isGM) {
        return ui.warn("Somente o Mestre pode realizar uma rolagem livre")
      }

      // Check if legacy mode is enabled
      const useLegacy = game.settings.get("naruto2d6world", "use-legacy-roll");
      const rollParams = {
        attribute,
        rollModifier,
        isUpdate: true,
        rerollMode,
        oldMessage,
        oldMessageRolls: {
          challengeDiceOneResult,
          challengeDiceTwoResult,
          actionDiceResult
        }
      };

      // In legacy mode, we need to extract mode from the rollCard dataset
      if (useLegacy) {
        const mode = rollCard.dataset.mode;
        rollParams.mode = mode;
      } else {
        rollParams.advantageLevel = parseInt(advantageLevel) || 0;
      }

      move.moveRoll(rollParams)
    }

    if (event.target.classList.contains("btn-adjust-roll-result")) {
      const button = event.target
      const chatMessageCard = button.closest(".chat-message")
      const messageId = chatMessageCard.dataset.messageId
      const oldMessage = game.messages.get(messageId)
      if (!oldMessage) return console.error(`Message: ${messageId} not found`);
      const rollCard = chatMessageCard.querySelector(".rollCard")
      const { attribute, advantageLevel, mode, rollModifier, actor, item } = rollCard.dataset
      const { rerollMode } = button.dataset

      // Ler valores dos data attributes em vez do texto visível
      const challengeDiceOneElement = rollCard.querySelector(".challengeDiceOneDisplay")
      const challengeDiceTwoElement = rollCard.querySelector(".challengeDiceTwoDisplay")
      const actionDiceElement = rollCard.querySelector(".actionDiceDisplay")

      const challengeDiceOneResult = challengeDiceOneElement?.dataset.challengeDiceOneValue || challengeDiceOneElement?.innerText.trim().split("+")[0].split("-")[0].split("<")[0]
      const challengeDiceTwoResult = challengeDiceTwoElement?.dataset.challengeDiceTwoValue || challengeDiceTwoElement?.innerText.trim().split("+")[0].split("-")[0].split("<")[0]
      const actionDiceResult = actionDiceElement?.dataset.actionDiceValue || actionDiceElement?.innerText.trim().split("+")[0].split("-")[0]

      // Recuperar valores originais dos data attributes para preservar o valor riscado (apenas no modo novo)
      const useLegacy = game.settings.get("naruto2d6world", "use-legacy-roll");
      const originalChallengeDiceOne = useLegacy ? undefined : (challengeDiceOneElement?.dataset.challengeDiceOneOriginal || undefined);
      const originalChallengeDiceTwo = useLegacy ? undefined : (challengeDiceTwoElement?.dataset.challengeDiceTwoOriginal || undefined);

      const move = await fromUuid(`Actor.${actor}.Item.${item}`)

      const messageData = {
        oldMessage,
        attribute,
        rollModifier,
        actor,
        item,
        move,
        isUpdate: true,
        rerollMode: "adjustment",
        oldMessageRolls: {
          challengeDiceOneResult,
          challengeDiceTwoResult,
          actionDiceResult
        }
      };

      // Add appropriate parameters based on mode
      if (useLegacy) {
        messageData.mode = mode;
      } else {
        messageData.advantageLevel = parseInt(advantageLevel) || 0;
        messageData.originalChallengeDiceOne = originalChallengeDiceOne ? parseInt(originalChallengeDiceOne) : undefined;
        messageData.originalChallengeDiceTwo = originalChallengeDiceTwo ? parseInt(originalChallengeDiceTwo) : undefined;
      }

      AlterMoveResultDialog.create({
        messageData,
        messageCard: chatMessageCard
      })
    }
  })


  /* Hooks.on("renderChatMessage", (message, html) => {
    const button = html.find(".reroll-dice")
    if (!button) return
    button.on("click", async function () {
      const card = html.find(".rollCard");
      const actorId = card.dataset.actor
      const actor = game.actors.get(actorId)

      let messageId = this.dataset.messageId;
      let oldMessage = game.messages.get(messageId);

      if (!oldMessage) return;

      // Pegar os dados da rolagem anterior
      let oldRolls = oldMessage.rolls.map(r => r.formula);

      // Fazer uma nova rolagem com os mesmos dados
      let newRolls = await Promise.all(oldRolls.map(r => new Roll(r).roll()));

      // Criar novo conteúdo da mensagem com os novos resultados
      let newContent = oldMessage.content.replace(
        /<blockquote class="roll-results">.*?<\/blockquote>/s,
        `<blockquote class="roll-results">${newRolls.map(r => r.total).join(', ')}</blockquote>`
      );

      // Atualizar a mensagem original com os novos resultados
      await oldMessage.update({
        rolls: newRolls,
        content: newContent
      });
    });
  }); */

  /** Add the GM-only tracker launcher immediately before the sidebar collapse control. */
  function addCharacterTrackerSidebarButton(root = document) {
    if (!game.user.isGM) return;

    const element = root instanceof HTMLElement ? root : root?.[0] ?? document;
    const sidebarTabs = element.matches?.(".sidebar-tabs, #sidebar-tabs")
      ? element
      : element.querySelector?.(".sidebar-tabs, #sidebar-tabs");
    if (!sidebarTabs || sidebarTabs.querySelector(".character-tracker-sidebar-button")) return;

    // Sidebar controls in Foundry V13 are native `.ui-control` buttons. Using
    // the same element and class keeps the launcher aligned with the tabs and
    // collapse control across both light and dark Foundry themes.
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("ui-control", "character-tracker-sidebar-button");
    button.style.marginBottom = "0.5rem";
    button.dataset.tooltip = "Clique: abrir rastreador de personagens • Botão direito: limpar personagens do rastreador";
    button.dataset.tooltipDirection = "LEFT";
    button.setAttribute("aria-label", "Abrir rastreador de personagens");
    button.innerHTML = '<i class="fa-solid fa-users"></i>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      CharacterTrackerService.open();
    });
    button.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      await CharacterTrackerService.clearAll();
    });

    const collapseButton = sidebarTabs.querySelector(".collapse, [data-action='toggleState'], [data-action='collapse']");
    if (collapseButton) collapseButton.before(button);
    else sidebarTabs.append(button);
  }

  Hooks.on("renderApplication", (app, html) => {
    if (app.constructor.name === "Sidebar") addCharacterTrackerSidebarButton(html);
  });
  addCharacterTrackerSidebarButton();

  // Registre todos os hooks da UI do Foundry antes de abrir qualquer janela
  // automática. Isso evita perder a primeira renderização do chat e, com ela,
  // a inserção dos controles de NV do Mestre.
  if (game.user.isGM && game.settings.get("naruto2d6world", CharacterTrackerService.AUTO_OPEN_SETTING_KEY)) {
    await CharacterTrackerService.open();
  }
});



/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn("You can only create macro buttons for owned Items");
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.boilerplate.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "boilerplate.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then(item => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(`Could not find item ${itemName}. You may need to delete and recreate this macro.`);
    }

    // Trigger the item roll
    item.roll();
  });
}
