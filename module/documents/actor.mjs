/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class BoilerplateActor extends Actor {

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
    console.log(this)
    const attributes = this.system.attributes


    this._mapActualAttributes(attributes)
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.boilerplate || {};

    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;

  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const system = super.getRollData();
    // Prepare character roll data.
    this._getCharacterRollData(system);
    this._getNpcRollData(system);

    return system;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(system) {
    if (this.type !== 'character') return;


    for (let [key, value] of Object.entries(this.system.attributes)) {
      system[key] = value.actual
    }

    return system
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(system) {
    if (this.type !== 'npc') return;
    return system
    // Process additional NPC data here.
  }

  _mapActualAttributes(attributes){
    // Object.keys(attributes).forEach((attributesKey, i) => {
    //   const attribute = attributes[attributesKey]
    //   attribute.actual = attribute.max
    // })
    console.log(1, attributes)
    const conditionMods = {
      str: 0, dex:0, con: 0, per: 0, int: 0, cha: 0
    }
    const conditions = this.items.filter(item => item.type === 'condition')
    for (const condition of conditions) {
      for (const [attributeName, attributeValue] of Object.entries(condition.system.attributes)) {
        conditionMods[attributeName] += +attributeValue.mod
      }
    }
    console.log(2, attributes)
    for(let [key, value] of Object.entries(attributes)){
      value.actual = value.max + conditionMods[key]
    }
    console.log(3, attributes)
  }


}