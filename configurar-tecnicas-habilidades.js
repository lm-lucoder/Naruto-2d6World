// Macro de script para Foundry VTT 13 / Naruto 2d6 World.
// Associa às habilidades do mundo e dos atores as técnicas criadas pelo macro de importação.
(async () => {
  if (!game.user.isGM) return ui.notifications.error("Execute esta macro como Mestre.");

  // Níveis conferidos na página Habilidades do JournalEntry de regras.
  // Técnicas que são apenas variações de outra técnica não são desbloqueios separados.
  const LINKS = [
    ["Bukijutsu", [[1, "Aplicar efeito"], [2, "Guiar acertos"], [4, "Acertos adaptáveis"], [4, "Diversidade de equipamentos"], [6, "Manter o fluxo"], [10, "Grande mestre"]]],
    ["Fuinjutsu", [[1, "Selo de armazenamento"], [2, "Selo de Armazenamento Maior"], [3, "Mishi (Mensageiro)"], [4, "Bakudan (Bomba)"], [5, "Gensou no In (Selo de Ilusão)"], [6, "Armadilha de Ninjutsu"], [7, "Chakra no Souin - (Selo de contenção de Chakra)"], [8, "Kekkai no In (Barreira de Selo)"], [8, "Shishou Fuuin (Selo dos Quatro Símbolos)"], [9, "Keiyaku Fuuin (Selo Anticontrato)"], [10, "Hiraishin - Deus voador do trovão"]]],
    ["Hachimon", [[1, "Kaimon (Portão de abertura)"], [2, "Kyumon (Portão da cura)"], [3, "Seimon (Portão da Vida)"], [4, "Shomon (Portão da Dor)"], [5, "Tomon (Portão do limite)"], [6, "Keimon (Portão da visão)"], [7, "Kyomon (Portão do milagre)"], [8, "Shimon (Portão da morte)"]]],
    ["Iryou Ninjutsu", [[1, "Shousen no Jutsu (Técnica da mão mística)"], [2, "Chakra no Mesu (Bisturi de Chakra)"], [3, "Experiência de campo"], [4, "In'yu Shometsu (Recuperação secreta de Ferimentos)"], [5, "Força sobre-humana"], [5, "Choque da desorientação"]]],
    ["Jinchuuriki", [[1, "Presença Bijuu"], [1, "Chakra Biju"], [2, "Manto Bijuu"], [2, "Braços de Chakra"], [3, "Bijuu Ninpou"], [4, "Modo Bijuu"], [4, "Disparo de chakra"], [5, "Forma Bijuu"], [5, "Bijuudama"], [5, "Transformação Parcial"]]],
    ["Juuinka (Selo amaldiçoado)", [[1, "JUUINKA - ICHI"], [2, "JUUINKA - NI"]]],
    ["Kage Bunshin", [[1, "Kage bunshin básico"], [2, "Multi clone das sombras"], [3, "1000 clones"]]],
    ["Rasengan", [[4, "Oodama Rasengan"], [5, "Rasengan Elemental"]]],
    ["Shushinjutsu", [[1, "Shushinjutsu"], [2, "Shushinjutsu contínuo"], [3, "Shushinjutsu frequente"], [3, "Ninpou Shushinjutsu"]]],
    ["Henge no Jutsu", [[1, "Henge no jutsu"], [2, "Henge no jutsu Aperfeiçoado"], [3, "Henge no jutsu Avançado"], [4, "Henge no jutsu Especialista"], [5, "Henge no jutsu Permanente"]]],
    ["Kawarimi Ninpou", [[1, "Kawarimi no Jutsu"], [2, "Kawarimi Avançado"], [3, "Kawarimi Mestre"]]],
    ["Kagejutsu", [[1, "Kage Shibari no Jutsu"], [2, "Manipular sombras no cenário"], [3, "Kage mane no jutsu"], [4, "Kage mane shuriken no jutsu"], [5, "Kage kubishibari no jutsu"], [6, "Kageyose no jutsu (Técnica da coleção das sombras)"], [7, "Kage nui (Costura das sombras)"], [8, "Kagezukami no jutsu"]]],
    ["Baika Ninpou", [[1, "Baika no Jutsu"], [1, "Modos Chākura — (Queima de caloria)"], [1, "Bunbun Baika no Jutsu"], [2, "Nikudan Sensha"]]],
    ["Estilo Juuken (Punho Gentil)", [[2, "Jūkenpō Ichigekishin - (Estilo Punho Gentil: Explosão do Corpo)"], [3, "Hakkeshou Kaiten - (Rotação Divina do Octograma)"], [4, "Hakke Sanjuuni Shou - (32 Pontos do Octograma)"], [5, "Hakke Kuushou - (Palma Aérea do Octograma)"], [6, "Hakke Rokujuuyon Shou - (64 Pontos do Octograma)"], [7, "Juuho Soushiken - (Punho dos Leões Gêmeos)"], [8, "Hakke HyakunijuuHachi Shou - (128 Pontos do Octograma)"]]],
    ["Jūjin Hijutsu", [[1, "Hakken no Jutsu (Técnica de detecção)"], [1, "Jūjin no Jutsu - Técnica corporal da besta humana"], [2, "Juujin Bunshin no Jutsu - (Técnica clone do homem besta)"], [3, "Tsuuga - (Presa perfurante)"], [4, "Sotorou - (Lobo de duas cabeças)"], [5, "Garouga - (Presa do lobo)"], [6, "Santorou - (Lobo de três cabeças)"], [7, "Ooiga Gatenga - (Perseguição da presa giratória)"]]],
    ["Kongou Fuusa - (Correntes de Selamento Inquebráveis)", [[1, "Lâminas Kongou"], [2, "Barreira Kongou"], [3, "Prisão Kongou"]]],
    ["Magenkyou Sharingan", [[1, "Amaterasu"], [1, "Kamui (Longo Alcance)"], [2, "Tsukuyomi"], [2, "Kagutsuchi"], [2, "Kamui (Curto Alcance)"]]],
    ["Sharingan", [[2, "Mímica Sharingan"], [3, "Hipnose Sharingan"]]],
    ["Estilo Gouken", [[2, "KONOHA REPPŪ - (VENTO VIOLENTO DE KONOHA)"], [3, "KONOHA SENPŪ - (REDEMOINHO DE KONOHA)"], [4, "KONOHA DAISENPŪ - (GRANDE REDEMOINHO DE KONOHA)"], [5, "KONOHA SHŌFŪ - (VENTO ASCENDENTE DE KONOHA)"]]],
    ["Kenjutsu: Estilo Niten ichi Ryu", [[3, "Nitoryu( estilo duas espadas) - Ataque do tigre feroz"]]],
    ["Bukijutsu Himatami: Arte da lâmina invisível", [[1, "100 cortes por segundo"]]]
  ];

  const normalize = value => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\u00a0/g, " ").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase().replace(/[:.]+$/, "");
  const aliases = new Map([
    ["mangekyou sharingan", "magenkyou sharingan"],
    ["cla hyuuga - estilo juuken", "estilo juuken (punho gentil)"],
    ["cla nara - kagejutsu", "kagejutsu"],
    ["cla inuzuka - jujin hijutsu", "jujin hijutsu"],
    ["cla uzumaki - kongou fuusa", normalize("Kongou Fuusa - (Correntes de Selamento Inquebráveis)")]
  ]);
  const abilityKey = value => aliases.get(normalize(value)) ?? normalize(value);
  const byAbility = new Map(LINKS.map(([name, entries]) => [abilityKey(name), entries]));
  const worldTechniques = new Map(game.items.filter(item => item.type === "technique").map(item => [normalize(item.name), item.name]));
  const missing = new Set();
  const foundAbilities = new Set();
  let added = 0;
  let changed = 0;

  function updateFor(ability) {
    if (ability.type !== "ability") return null;
    const key = abilityKey(ability.name);
    const expected = byAbility.get(key);
    if (!expected) return null;
    foundAbilities.add(key);
    const current = Array.isArray(ability.system.techniques) ? ability.system.techniques : [];
    const known = new Set(current.map(entry => normalize(entry.name)).filter(Boolean));
    const next = [...current];
    for (const [level, name] of expected) {
      const actualName = worldTechniques.get(normalize(name));
      if (!actualName) {
        missing.add(`${ability.name}: ${name}`);
        continue;
      }
      if (known.has(normalize(actualName))) continue;
      next.push({ id: foundry.utils.randomID(7), level, name: actualName });
      known.add(normalize(actualName));
      added++;
    }
    if (next.length === current.length) return null;
    changed++;
    return { _id: ability.id, "system.techniques": next };
  }

  const worldUpdates = game.items.map(updateFor).filter(Boolean);
  if (worldUpdates.length) await Item.updateDocuments(worldUpdates);

  for (const actor of game.actors) {
    const actorUpdates = actor.items.map(updateFor).filter(Boolean);
    if (actorUpdates.length) await actor.updateEmbeddedDocuments("Item", actorUpdates);
  }

  const unmatched = LINKS.map(([name]) => name).filter(name => !foundAbilities.has(abilityKey(name)));
  const summary = `${changed} habilidades configuradas; ${added} associações adicionadas; ${missing.size} técnicas ausentes no mundo.`;
  console.info("Configuração de técnicas", summary, { missing: [...missing], unmatchedAbilities: unmatched });
  if (missing.size) ui.notifications.warn(`${summary} Consulte o console (F12) para os nomes ausentes.`, { permanent: true });
  else ui.notifications.info(summary, { permanent: true });
})();
