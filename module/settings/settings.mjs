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