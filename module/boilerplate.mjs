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

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function () {

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.boilerplate = {
    BoilerplateActor,
    BoilerplateItem,
    rollItemMacro
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

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

  // Chat Move Message card Reroll event
  window.addEventListener("click", async (event) => {
    if (event.target.classList.contains("reroll-dice")) {
      const button = event.target
      const chatMessageCard = button.closest(".chat-message")
      const messageId = chatMessageCard.dataset.messageId
      const oldMessage = game.messages.get(messageId)
      if (!oldMessage) return console.error(`Message: ${messageId} not found`);
      const rollCard = chatMessageCard.querySelector(".rollCard")
      const { attribute, mode, rollModifier, actor, item } = rollCard.dataset
      const { rerollMode } = button.dataset
      const challengeDiceOneResult = rollCard.querySelector(".challengeDiceOneDisplay").innerText
      const challengeDiceTwoResult = rollCard.querySelector(".challengeDiceTwoDisplay").innerText
      const actionDiceResult = rollCard.querySelector(".actionDiceDisplay").innerText
      const move = await fromUuid(`Actor.${actor}.Item.${item}`)
      if (rerollMode == "free" && !game.user.isGM) {
        return ui.warn("Somente o Mestre pode realizar uma rolagem livre")
      }
      move.moveRoll({
        attribute, mode, rollModifier, isUpdate: true, rerollMode, oldMessage, oldMessageRolls: {
          challengeDiceOneResult,
          challengeDiceTwoResult,
          actionDiceResult
        }
      })
    }

    if (event.target.classList.contains("btn-adjust-roll-result")) {
      const button = event.target
      const chatMessageCard = button.closest(".chat-message")
      const messageId = chatMessageCard.dataset.messageId
      const oldMessage = game.messages.get(messageId)
      if (!oldMessage) return console.error(`Message: ${messageId} not found`);
      const rollCard = chatMessageCard.querySelector(".rollCard")
      const { attribute, mode, rollModifier, actor, item } = rollCard.dataset
      const { rerollMode } = button.dataset
      const challengeDiceOneResult = rollCard.querySelector(".challengeDiceOneDisplay").innerText.split("+")[0]
      const challengeDiceTwoResult = rollCard.querySelector(".challengeDiceTwoDisplay").innerText.split("+")[0]
      const actionDiceResult = rollCard.querySelector(".actionDiceDisplay").innerText.split("+")[0]
      const move = await fromUuid(`Actor.${actor}.Item.${item}`)
      AlterMoveResultDialog.create({
        messageData: {
          oldMessage,
          attribute,
          mode,
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

        }, messageCard: chatMessageCard
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