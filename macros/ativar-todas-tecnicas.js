// Cole este código em uma macro do tipo Script e execute como Mestre.
// Atualiza as técnicas do mundo e as técnicas incorporadas em atores; não altera compêndios.
(async () => {
  if (!game.user.isGM) return ui.notifications.error("Execute esta macro como Mestre.");

  const worldUpdates = game.items
    .filter(item => item.type === "technique" && item.system.canActivate !== true)
    .map(item => ({ _id: item.id, "system.canActivate": true }));
  if (worldUpdates.length) await Item.updateDocuments(worldUpdates);

  let actorUpdates = 0;
  for (const actor of game.actors) {
    const updates = actor.items
      .filter(item => item.type === "technique" && item.system.canActivate !== true)
      .map(item => ({ _id: item.id, "system.canActivate": true }));
    if (!updates.length) continue;
    await actor.updateEmbeddedDocuments("Item", updates);
    actorUpdates += updates.length;
  }

  const total = worldUpdates.length + actorUpdates;
  const message = `${total} técnicas configuradas para poderem ser ativadas (${worldUpdates.length} no mundo, ${actorUpdates} em atores).`;
  console.info(message);
  ui.notifications.info(message, { permanent: true });
})();
