const gameAbilities = game.items.filter(item => item.type == "ability")

game.actors.contents.filter(actor => (actor.type == "character" || actor.type == "npc")).forEach(actor => {
  const abilities = actor.collections.items.contents.filter(item => item.type == "ability")
  abilities.forEach(ability => {
    const matchingAbility = gameAbilities.find(gameAbility => gameAbility.name == ability.name)
    if (!matchingAbility) {
      return ui.notifications.error(`Habilidade ${ability.name} não encontrada!`)
    }
    ability.update({ ['system.category']: matchingAbility.system.category })
    ability.update({ ['system.maxLevel']: matchingAbility.system.maxLevel })
    ability.update({ ['system.showMaxLevel']: matchingAbility.system.showMaxLevel })
    ability.update({ ['system.chakra.useChakraPoints']: matchingAbility.system.chakra.useChakraPoints })
    ability.update({ ['system.chakra.chakraPointsPerLevel']: matchingAbility.system.chakra.chakraPointsPerLevel })
    ability.update({ ['system.chakra.defaultChakraPoints']: matchingAbility.system.chakra.defaultChakraPoints })
    ability.update({ ['system.resources']: matchingAbility.system.resources })
    ability.update({ ['system.levelDescriptions']: matchingAbility.system.levelDescriptions })
  })
})
ui.notifications.info("Habilidades atualizadas!")