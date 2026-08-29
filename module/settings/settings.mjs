import { CharacterTrackerService } from "../services/character-tracker-service.mjs";

class GameSettings {
  static start() {
    game.settings.register("naruto2d6world", "great-advantage-threshold", {
      name: "threshold para Grande Vantagem",
      scope: "world",
      config: true,
      type: Number,
      default: 4,
    });
    game.settings.register("naruto2d6world", "advantage-threshold", {
      name: "threshold para Vantagem",
      scope: "world",
      config: true,
      type: Number,
      default: 1,
    });
    game.settings.register("naruto2d6world", "disadvantage-threshold", {
      name: "threshold para Desvantagem",
      scope: "world",
      config: true,
      type: Number,
      default: -2,
    });
    game.settings.register("naruto2d6world", "great-disadvantage-threshold", {
      name: "threshold para Grande Desvantagem",
      scope: "world", // "world" = global, "client" = local por usuário
      config: true,   // aparece nas Configurações do Sistema
      type: Number,
      default: -5,
    });

    game.settings.register("naruto2d6world", "use-legacy-roll", {
      name: "Usar rolagem legada (com modos)",
      hint: "Se ativado, usa o sistema antigo de rolagem com modos (vantagem/desvantagem). Se desativado, usa o novo sistema que aplica NV diretamente aos dados.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    });

    game.settings.register("naruto2d6world", "master-global-nv", {
      name: "NV Global do Mestre",
      hint: "Modificador de NV global controlado pelo mestre, aplicado a todas as rolagens de movimentos.",
      scope: "world",
      config: false, // Não aparece nas configurações, é controlado pelos botões
      type: Number,
      default: 0,
    });

    CharacterTrackerService.registerSettings();

  }

  static getNVThresholds() {
    return {
      greatDisadvantage: game.settings.get("naruto2d6world", "great-disadvantage-threshold"),
      disadvantage: game.settings.get("naruto2d6world", "disadvantage-threshold"),
      advantage: game.settings.get("naruto2d6world", "advantage-threshold"),
      greatAdvantage: game.settings.get("naruto2d6world", "great-advantage-threshold"),
    };
  }
}

export { GameSettings };
