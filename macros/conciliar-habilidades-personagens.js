// Cole este arquivo em uma macro Script e execute como Mestre.
// Sincroniza configurações novas das habilidades dos personagens com os Itens do mundo.
// Preserva nível, chakra, recursos, descrições de nível e efeitos escolhidos pelo personagem.
(async () => {
  if (!game.user.isGM) return ui.notifications.error("Execute esta macro como Mestre.");

  const normalize = value => String(value ?? "").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
  const worldAbilities = new Map();
  const ambiguous = new Set();
  for (const ability of game.items.filter(item => item.type === "ability")) {
    const key = normalize(ability.name);
    if (worldAbilities.has(key)) ambiguous.add(key);
    else worldAbilities.set(key, ability);
  }

  const missing = new Set();
  const warnings = [];
  let updated = 0;
  let addedTechniques = 0;

  for (const actor of game.actors.filter(actor => actor.type === "character")) {
    const updates = [];
    for (const ability of actor.items.filter(item => item.type === "ability")) {
      const key = normalize(ability.name);
      if (ambiguous.has(key)) {
        warnings.push(`${actor.name}: há mais de uma habilidade chamada ${ability.name} no mundo.`);
        continue;
      }
      const source = worldAbilities.get(key);
      if (!source) {
        missing.add(ability.name);
        continue;
      }

      const changes = { _id: ability.id };
      const slots = [...(ability.system.effectSlots ?? [])];
      const hasSelectedEffects = slots.some(Boolean);
      for (const field of ["techniquesEnabled", "canActivate"]) {
        if (ability.system[field] !== source.system[field]) changes[`system.${field}`] = source.system[field];
      }
      // Uma habilidade com efeitos já escolhidos deve continuar exibindo esses slots.
      const effectsEnabled = hasSelectedEffects ? true : source.system.effectsEnabled;
      if (ability.system.effectsEnabled !== effectsEnabled) changes["system.effectsEnabled"] = effectsEnabled;

      // Nomes e níveis do mundo prevalecem; técnicas particulares do personagem são mantidas.
      const techniques = foundry.utils.deepClone(ability.system.techniques ?? []);
      for (const worldTechnique of source.system.techniques ?? []) {
        if (!worldTechnique.name) continue;
        const index = techniques.findIndex(entry => normalize(entry.name) === normalize(worldTechnique.name));
        if (index >= 0) {
          techniques[index] = { ...techniques[index], name: worldTechnique.name, level: worldTechnique.level };
        } else {
          techniques.push({ ...foundry.utils.deepClone(worldTechnique), id: foundry.utils.randomID(7) });
          addedTechniques++;
        }
      }
      if (JSON.stringify(techniques) !== JSON.stringify(ability.system.techniques ?? [])) changes["system.techniques"] = techniques;

      const oldCount = Math.max(0, Math.floor(Number(ability.system.effectsPerLevel) || 0));
      const newCount = Math.max(0, Math.floor(Number(source.system.effectsPerLevel) || 0));
      if (oldCount !== newCount) {
        if (hasSelectedEffects && (!oldCount || !newCount)) {
          warnings.push(`${actor.name} / ${ability.name}: quantidade de efeitos não alterada; há escolhas e uma das quantidades é zero.`);
        } else if (hasSelectedEffects) {
          const remapped = Array(Math.ceil(slots.length / oldCount) * newCount).fill(null);
          let overflow = false;
          slots.forEach((name, index) => {
            if (!name) return;
            const levelIndex = Math.floor(index / oldCount);
            const columnIndex = index % oldCount;
            if (columnIndex >= newCount) overflow = true;
            else remapped[levelIndex * newCount + columnIndex] = name;
          });
          if (overflow) {
            warnings.push(`${actor.name} / ${ability.name}: quantidade de efeitos não reduzida; há escolhas nas colunas que seriam removidas.`);
          } else {
            changes["system.effectsPerLevel"] = newCount;
            changes["system.effectSlots"] = remapped;
          }
        } else changes["system.effectsPerLevel"] = newCount;
      }

      if (Object.keys(changes).length > 1) updates.push(changes);
    }
    if (updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates);
      updated += updates.length;
    }
  }

  const message = `${updated} habilidades conciliadas; ${addedTechniques} técnicas adicionadas; ${missing.size} habilidades sem correspondente no mundo; ${warnings.length} avisos.`;
  console.info("Conciliação de habilidades", message, { semCorrespondente: [...missing], avisos: warnings });
  if (missing.size || warnings.length) ui.notifications.warn(`${message} Veja os detalhes no console (F12).`, { permanent: true });
  else ui.notifications.info(message, { permanent: true });
})();
