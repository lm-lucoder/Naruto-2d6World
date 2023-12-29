/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {
  return loadTemplates([

    // Actor partials.
    "systems/naruto2d6world/templates/actor/parts/actor-description.html",
    "systems/naruto2d6world/templates/actor/parts/actor-skills.html",
    "systems/naruto2d6world/templates/actor/parts/actor-moves.html",
    "systems/naruto2d6world/templates/item/item-skill-sheet.html"
  ]);
};
