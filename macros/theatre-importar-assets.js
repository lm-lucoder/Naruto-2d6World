/**
 * Importa retratos nomeados como asset-{nome}-{sentimento} para o Theatre.
 *
 * Alvo: o Actor-base de um Token controlado. Sem Token, use o UUID de Actor
 * informado no modal. Actors sintéticos de Tokens nunca são alterados.
 */
(async () => {
  /* ======================================================================== */
  /* REGIÃO DE CONFIGURAÇÃO                                                   */
  /* ======================================================================== */

  const THEATRE_MODULE_ID = "theatre";

  // A pasta física é:
  // F:\FoundryVTT 13\Data\MAKEN\Naruto\Imagens\Personagens\Assets
  // O FilePicker usa um caminho relativo à pasta Data, portanto não inclua
  // "F:\FoundryVTT 13\Data\" em ASSET_DIRECTORY.
  const FILE_SOURCE = "data";
  const ASSET_DIRECTORY = "MAKEN/Naruto/Imagens/Personagens/Assets";

  const FILE_PREFIX = "asset";
  const FILE_SEPARATOR = "-";
  const IMAGE_EXTENSIONS = [".png", ".webp", ".jpg", ".jpeg", ".gif"];
  const CASE_INSENSITIVE_FILENAMES = true;
  const STRIP_PREFIX_FROM_INPUT = true;

  // O frame principal (sem emoji ativo) é sempre asset-{nome}-default.
  const APPLY_DEFAULT_AS_BASE_INSERT = true;
  const BASE_INSERT_SENTIMENT = "default";

  // Todo sentimento descoberto em asset-{nome}-{sentimento} que não seja
  // "default" nem um emote nativo do Theatre vira um emote personalizado.
  // Rótulos opcionais: sem entrada aqui, o macro
  // converte hífens e sublinhados em espaços e capitaliza a primeira letra.
  const CUSTOM_EMOTE_LABEL_OVERRIDES = {
    imponent: "Imponente",
    "smile-sad": "Sorriso triste",
    stop: "Pare"
  };

  // Acima deste número de emotes personalizados descobertos, pergunte antes
  // de criá-los. "Prosseguir sem extras" ainda aplica retrato-base e emotes
  // padrão encontrados.
  const EXTRA_CONFIRMATION_THRESHOLD = 10;

  // O Theatre possui o nome interno "mischevious", mas assets existentes podem
  // usar a grafia "mischievous". Nomes exibidos compostos também são buscados
  // automaticamente em kebab-case ("Laughing Roll" → "laughing-roll").
  // Adicione aqui somente exceções que não possam ser inferidas pelo rótulo.
  const PRIMARY_SENTIMENT_ALIASES = {
    mischevious: ["mischievous"],
    // O nome interno do Theatre é "rofl", mas o emote se chama Laughing Roll.
    // Este alias continua funcionando mesmo que a interface esteja traduzida.
    rofl: ["laughing-roll"]
  };

  // "asset": usa o próprio retrato como miniatura no menu de emotes.
  // "blank": usa o ícone neutro do Theatre.
  const CUSTOM_EMOTE_ICON_MODE = "asset";
  const CUSTOM_EMOTE_BLANK_ICON = "modules/theatre/assets/graphics/emotes/blank.png";

  // Valor inicial do campo UUID do Actor no modal. Deixe vazio para preencher
  // manualmente; um Token controlado sempre tem prioridade sobre este valor.
  const DEFAULT_ACTOR_UUID = "";

  const REFRESH_STAGED_INSERT = true;
  const LOG_MISSING_ASSETS = true;

  /* ======================================================================== */
  /* FIM DA REGIÃO DE CONFIGURAÇÃO                                            */
  /* ======================================================================== */

  const notify = (level, message) => ui.notifications?.[level]?.(message);

  try {
    const theatreModule = game.modules.get(THEATRE_MODULE_ID);
    const theatreApi = theatreModule?.api;

    if (!theatreModule?.active || typeof theatreApi?.getDefaultEmotes !== "function") {
      notify("error", "O módulo Theatre precisa estar ativo e inicializado.");
      return;
    }

    const selectedActor = getSelectedOriginalActor();
    if (selectedActor === false) return;

    const formValues = await askImportData(selectedActor);
    if (!formValues) return;

    const assetName = formValues.assetName;
    if (!assetName) {
      notify("warn", "Informe o nome do asset.");
      return;
    }

    const actor = await resolveTargetActor(selectedActor, formValues.actorUuid);
    if (!actor) return;

    if (!actor.isOwner) {
      notify("error", `Você não tem permissão para alterar ${actor.name}.`);
      return;
    }

    const FilePickerClass = foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
    if (!FilePickerClass?.browse) {
      throw new Error("A API FilePicker.browse não está disponível.");
    }

    notify("info", `Procurando assets de “${assetName}”…`);

    const listing = await FilePickerClass.browse(FILE_SOURCE, ASSET_DIRECTORY, {
      extensions: IMAGE_EXTENSIONS
    });
    const files = (listing.files ?? [])
      .map((entry) => typeof entry === "string" ? entry : entry?.path ?? entry?.url)
      .filter(Boolean)
      .filter((path) => IMAGE_EXTENSIONS.includes(getExtension(path)));

    const fileIndex = indexFilesByStem(files);
    const cleanAssetName = normalizeAssetInput(assetName);
    const discoveredAssets = findAssetsForName(files, cleanAssetName);
    const defaultEmotes = theatreApi.getDefaultEmotes();
    const defaultEmoteNames = Object.keys(defaultEmotes ?? {});
    const currentEmotes = foundry.utils.deepClone(actor.getFlag(THEATRE_MODULE_ID, "emotes") ?? {});
    const updateData = {};
    const usedFiles = new Set();
    const primaryApplied = [];
    const customCreated = [];
    const customUpdated = [];
    const missingPrimary = [];
    let baseApplied = false;

    if (APPLY_DEFAULT_AS_BASE_INSERT) {
      const baseFile = findAssetFile(fileIndex, cleanAssetName, [BASE_INSERT_SENTIMENT]);
      if (baseFile) {
        updateData["flags.theatre.baseinsert"] = baseFile;
        usedFiles.add(baseFile);
        baseApplied = true;
      }
    }

    // Etapa 1: aplica um retrato a cada emote padrão do Theatre encontrado.
    for (const emoteName of defaultEmoteNames) {
      const emote = defaultEmotes[emoteName];
      const possibleSentiments = uniqueStrings([
        emoteName,
        toKebabCase(emoteName),
        ...(PRIMARY_SENTIMENT_ALIASES[emoteName] ?? []),
        toKebabCase(emote?.label)
      ]);
      const file = findAssetFile(fileIndex, cleanAssetName, possibleSentiments);

      if (!file) {
        missingPrimary.push(emoteName);
        continue;
      }

      updateData[`flags.theatre.emotes.${emoteName}.insert`] = file;
      usedFiles.add(file);
      primaryApplied.push({ emote: emoteName, file });
    }

    // Etapa 2: todo sentimento não usado por um emote nativo vira customN.
    const detectedExtras = discoveredAssets.filter(({ sentiment, file }) =>
      normalize(sentiment) !== normalize(BASE_INSERT_SENTIMENT) && !usedFiles.has(file)
    );
    const applyExtras = await confirmExtraImport(detectedExtras, cleanAssetName);
    if (applyExtras === null) {
      notify("info", "Importação de assets do Theatre cancelada.");
      return;
    }

    let nextCustomIndex = getNextCustomIndex(currentEmotes);
    const skippedExtras = applyExtras ? [] : detectedExtras;
    for (const { sentiment, file } of applyExtras ? detectedExtras : []) {
      const label = CUSTOM_EMOTE_LABEL_OVERRIDES[sentiment] ?? formatLabel(sentiment);
      let customKey = findExistingCustomEmote(currentEmotes, sentiment, label);
      const existed = Boolean(customKey);
      if (!customKey) customKey = `custom${nextCustomIndex++}`;

      const previous = currentEmotes[customKey] ?? {};
      const customEmote = {
        ...previous,
        name: customKey,
        label,
        custom: true,
        insert: file,
        image: CUSTOM_EMOTE_ICON_MODE === "blank" ? CUSTOM_EMOTE_BLANK_ICON : file
      };

      currentEmotes[customKey] = customEmote;
      updateData[`flags.theatre.emotes.${customKey}`] = customEmote;
      usedFiles.add(file);
      (existed ? customUpdated : customCreated).push({ emote: customKey, sentiment, label, file });
    }

    if (!Object.keys(updateData).length) {
      notify("warn", `Nenhum asset compatível foi encontrado para “${cleanAssetName}”.`);
      logResult({
        actor,
        cleanAssetName,
        files,
        primaryApplied,
        customCreated,
        customUpdated,
        missingPrimary,
        detectedExtras,
        skippedExtras,
        baseApplied
      });
      return;
    }

    await actor.update(updateData);
    await refreshTheatreInsert(actor);

    const totalApplied = primaryApplied.length + customCreated.length + customUpdated.length + Number(baseApplied);
    const customSummary = customCreated.length + customUpdated.length;
    notify(
      "info",
      `${totalApplied} asset(s) aplicado(s) a ${actor.name}: ` +
      `${primaryApplied.length} padrão, ${customSummary} personalizado(s)` +
      `${baseApplied ? " e 1 retrato-base" : ""}.`
    );

    logResult({
      actor,
      cleanAssetName,
      files,
      primaryApplied,
      customCreated,
      customUpdated,
      missingPrimary,
      detectedExtras,
      skippedExtras,
      baseApplied
    });
  } catch (error) {
    console.error("[Theatre Asset Importer] Falha ao importar assets", error);
    notify("error", `Falha ao importar assets do Theatre: ${error.message}`);
  }

  function getSelectedOriginalActor() {
    const controlled = canvas?.tokens?.controlled ?? [];

    if (controlled.length > 1) {
      notify("warn", "Controle apenas um Token antes de executar o macro.");
      return false;
    }

    if (!controlled.length) return null;

    const tokenDocument = controlled[0].document ?? controlled[0];
    // baseActor/actorId apontam para o Actor persistente; tokenDocument.actor
    // pode ser um Actor sintético quando o Token não está vinculado.
    const baseActor = tokenDocument.baseActor ?? game.actors.get(tokenDocument.actorId);
    if (!baseActor) {
      notify("error", "O Token controlado não possui um Actor-base no mundo.");
      return false;
    }

    return baseActor;
  }

  async function resolveTargetActor(selectedActor, actorUuid) {
    if (selectedActor) return selectedActor;

    const uuid = actorUuid.trim();
    if (!uuid) {
      notify("warn", "Sem Token controlado, informe o UUID do Actor (ex.: Actor.541OGDh9axnPQFGp).");
      return null;
    }

    let resolvedDocument;
    try {
      resolvedDocument = await fromUuid(uuid);
    } catch (error) {
      notify("error", `UUID inválido: ${uuid}`);
      return null;
    }

    if (resolvedDocument?.documentName !== "Actor") {
      notify("error", "O UUID informado precisa ser de um Actor.");
      return null;
    }

    // Busca novamente na coleção mundial para impedir edição de Actor sintético
    // (por exemplo, UUIDs derivados de Token) ou de Actor em Compendium.
    const worldActor = game.actors.get(resolvedDocument.id);
    if (!worldActor) {
      notify("error", "O UUID deve apontar para um Actor salvo no mundo, não para uma instância de Token ou Compendium.");
      return null;
    }

    return worldActor;
  }

  async function askImportData(selectedActor) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const initialUuid = selectedActor?.uuid ?? DEFAULT_ACTOR_UUID;
    const safeUuid = foundry.utils.escapeHTML(initialUuid);
    const targetHint = selectedActor
      ? `Token controlado: será alterada a ficha-base de <strong>${foundry.utils.escapeHTML(selectedActor.name)}</strong>. O UUID abaixo será ignorado.`
      : "Sem Token controlado: informe o UUID de um Actor do mundo.";

    return DialogV2.prompt({
      window: { title: "Importar assets do Theatre" },
      content: `
        <div class="standard-form">
          <div class="form-group">
            <label>Nome do asset</label>
            <div class="form-fields">
              <input name="assetName" type="text" required autofocus
                placeholder="Ex.: hanzou-polvo" autocomplete="off">
            </div>
          </div>
          <div class="form-group">
            <label>UUID do Actor</label>
            <div class="form-fields">
              <input name="actorUuid" type="text" value="${safeUuid}"
                placeholder="Actor.541OGDh9axnPQFGp" autocomplete="off">
            </div>
            <p class="hint">${targetHint}</p>
          </div>
        </div>
      `,
      ok: {
        label: "Procurar e aplicar",
        icon: "fa-solid fa-images",
        callback: (_event, button) => ({
          assetName: button.form.elements.assetName.value.trim(),
          actorUuid: button.form.elements.actorUuid.value.trim()
        })
      },
      modal: true,
      rejectClose: false
    });
  }

  function normalizeAssetInput(value) {
    let result = String(value).trim().normalize("NFC");
    const prefix = `${FILE_PREFIX}${FILE_SEPARATOR}`;
    if (STRIP_PREFIX_FROM_INPUT && normalize(result).startsWith(normalize(prefix))) {
      result = result.slice(prefix.length);
    }
    return result;
  }

  function normalize(value) {
    const normalized = String(value).normalize("NFC");
    return CASE_INSENSITIVE_FILENAMES ? normalized.toLocaleLowerCase() : normalized;
  }

  function getDecodedFilename(path) {
    const cleanPath = String(path).split(/[?#]/, 1)[0];
    const encodedName = cleanPath.replace(/\\/g, "/").split("/").pop() ?? "";
    try {
      return decodeURIComponent(encodedName);
    } catch (_error) {
      return encodedName;
    }
  }

  function getExtension(path) {
    const filename = getDecodedFilename(path);
    const dotIndex = filename.lastIndexOf(".");
    return dotIndex >= 0 ? filename.slice(dotIndex).toLocaleLowerCase() : "";
  }

  function getStem(path) {
    const filename = getDecodedFilename(path);
    const dotIndex = filename.lastIndexOf(".");
    return dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  }

  function indexFilesByStem(paths) {
    const index = new Map();

    for (const path of paths) {
      const key = normalize(getStem(path));
      const matches = index.get(key) ?? [];
      matches.push(path);
      matches.sort((left, right) => {
        const leftPriority = IMAGE_EXTENSIONS.indexOf(getExtension(left));
        const rightPriority = IMAGE_EXTENSIONS.indexOf(getExtension(right));
        return leftPriority - rightPriority;
      });
      index.set(key, matches);
    }

    return index;
  }

  function findAssetFile(index, assetName, sentiments) {
    for (const sentiment of sentiments) {
      const stem = [FILE_PREFIX, assetName, sentiment].join(FILE_SEPARATOR);
      const match = index.get(normalize(stem))?.[0];
      if (match) return match;
    }
    return null;
  }

  function uniqueStrings(values) {
    const seen = new Set();
    return values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .filter((value) => {
        const key = normalize(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function toKebabCase(value) {
    return String(value ?? "")
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLocaleLowerCase();
  }

  function findAssetsForName(paths, assetName) {
    const prefix = [FILE_PREFIX, assetName, ""].join(FILE_SEPARATOR);
    const normalizedPrefix = normalize(prefix);
    const bySentiment = new Map();

    for (const file of paths) {
      const stem = getStem(file);
      if (!normalize(stem).startsWith(normalizedPrefix)) continue;

      // O tamanho do prefixo não muda ao normalizar: ele apenas permite que a
      // comparação respeite CASE_INSENSITIVE_FILENAMES.
      const sentiment = stem.slice(prefix.length).trim();
      if (!sentiment) continue;

      const key = normalize(sentiment);
      const existing = bySentiment.get(key);
      if (!existing || IMAGE_EXTENSIONS.indexOf(getExtension(file)) < IMAGE_EXTENSIONS.indexOf(getExtension(existing.file))) {
        bySentiment.set(key, { sentiment, file });
      }
    }

    return [...bySentiment.values()];
  }

  async function confirmExtraImport(extras, assetName) {
    if (extras.length <= EXTRA_CONFIRMATION_THRESHOLD) return true;

    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (!DialogV2?.confirm) {
      throw new Error("A API DialogV2.confirm não está disponível para confirmar os emotes extras.");
    }

    const safeAssetName = foundry.utils.escapeHTML(assetName);
    return DialogV2.confirm({
      window: { title: "Muitos emotes extras encontrados" },
      content: `<div class="standard-form"><p>Foram identificados <strong>${extras.length}</strong> sentimentos extras para <strong>${safeAssetName}</strong>.</p><p>Deseja criar ou atualizar esses emotes personalizados?</p></div>`,
      yes: {
        label: `Prosseguir com ${extras.length} extras`,
        icon: "fa-solid fa-wand-magic-sparkles"
      },
      no: {
        label: "Prosseguir sem extras",
        icon: "fa-solid fa-forward"
      },
      modal: true,
      rejectClose: false
    });
  }

  function getNextCustomIndex(emotes) {
    const indexes = Object.keys(emotes)
      .map((key) => key.match(/^custom(\d+)$/i)?.[1])
      .filter(Boolean)
      .map(Number);
    return indexes.length ? Math.max(...indexes) + 1 : 1;
  }

  function findExistingCustomEmote(emotes, sentiment, label) {
    const wanted = new Set([normalize(sentiment), normalize(formatLabel(sentiment)), normalize(label)]);

    for (const [key, emote] of Object.entries(emotes)) {
      if (!emote?.custom || !/^custom\d+$/i.test(key)) continue;
      if (wanted.has(normalize(emote.label ?? ""))) return key;
    }

    return null;
  }

  function formatLabel(sentiment) {
    const text = String(sentiment).replace(/[-_]+/g, " ").trim();
    return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
  }

  async function refreshTheatreInsert(actor) {
    if (!REFRESH_STAGED_INSERT) return;

    const theatre = globalThis.Theatre?.instance ?? globalThis.theatre;
    const theatreId = `theatre-${actor.id}`;
    const insert = theatre?.getInsertById?.(theatreId);
    if (!insert) return;

    /*
     * Theatre#renderInsertById não recebe o mapa de resources necessário para
     * um arquivo recém-adicionado. O configurador nativo primeiro registra a
     * textura no PIXI e só então chama _setupPortraitContainer. Repetimos
     * exatamente essa sequência para o retrato ativo, sem chamar o método que
     * falha quando resources é undefined.
     */
    try {
      const actorEmotes = game.modules.get(THEATRE_MODULE_ID).api.getActorEmotes(actor.id);
      const activeEmote = insert.emote;
      const baseInsert = actor.getFlag(THEATRE_MODULE_ID, "baseinsert") || actor.img;
      const activePath = activeEmote && actorEmotes[activeEmote]?.insert
        ? actorEmotes[activeEmote].insert
        : baseInsert;

      if (!activePath || typeof theatre._addSpritesToPixi !== "function") return;

      const resources = await theatre._addSpritesToPixi([
        { imgpath: activePath, resname: activePath }
      ]);
      if (!resources?.[activePath]) {
        console.warn("[Theatre Asset Importer] Não foi possível carregar a textura ativa.", activePath);
        return;
      }

      theatre._clearPortraitContainer?.(theatreId);
      await theatre._setupPortraitContainer?.(
        theatreId,
        actor.getFlag(THEATRE_MODULE_ID, "optalign") || insert.optAlign || "top",
        activePath,
        resources
      );
      insert.dockContainer?.addChild(insert.label);
      insert.dockContainer?.addChild(insert.typingBubble);
      theatre._repositionInsertElements?.(insert);
      theatre.renderEmoteMenu?.();
    } catch (error) {
      // As flags já foram gravadas. Não transforme uma falha de redesenho em
      // falha da importação; o Theatre recarregará a textura ao trocar emote.
      console.warn("[Theatre Asset Importer] Não foi possível redesenhar o insert ativo.", error);
    }
  }

  function logResult(result) {
    const {
      actor,
      cleanAssetName,
      files,
      primaryApplied,
      customCreated,
      customUpdated,
      missingPrimary,
      detectedExtras,
      skippedExtras,
      baseApplied
    } = result;

    console.groupCollapsed(`[Theatre Asset Importer] ${actor.name} ← ${cleanAssetName}`);
    console.log("Pasta", { source: FILE_SOURCE, path: ASSET_DIRECTORY });
    console.log("Arquivos de imagem examinados", files.length);
    console.log("Retrato-base aplicado", baseApplied);
    if (primaryApplied.length) console.table(primaryApplied);
    if (customCreated.length) console.table(customCreated.map((entry) => ({ action: "criado", ...entry })));
    if (customUpdated.length) console.table(customUpdated.map((entry) => ({ action: "atualizado", ...entry })));
    if (LOG_MISSING_ASSETS) {
      console.log("Emotes padrão sem asset", missingPrimary);
      console.table(detectedExtras.map(({ sentiment, file }) => ({ sentimento: sentiment, arquivo: file })));
      if (skippedExtras.length) console.log("Sentimentos extras ignorados por escolha", skippedExtras);
    }
    console.groupEnd();
  }
})();
