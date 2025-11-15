/**
 * Classe para gerenciar recursos (resources) de itens
 */
export class ItemResourceManager {
  /**
   * Adiciona um novo recurso ao item
   * @param {Item} item - O item ao qual adicionar o recurso
   * @returns {Promise<Item>}
   */
  static addResource(item) {
    const resources = item.system.resources || [];
    const level = item.system.level || 1;
    const newResource = {
      name: "New Resource",
      value: 0,
      valuePerLevel: 0,
      defaultValue: 0,
      maxValue: 0,
      show: false,
      id: randomID(7)
    };
    // Calcula maxValue inicial baseado no nível
    newResource.maxValue = +level * +newResource.valuePerLevel + +newResource.defaultValue;
    resources.push(newResource);
    return item.update({ system: { resources } });
  }

  /**
   * Remove um recurso do item
   * @param {Item} item - O item do qual remover o recurso
   * @param {string} resourceId - O ID do recurso a ser removido
   * @returns {Promise<Item>}
   */
  static removeResource(item, resourceId) {
    const resources = item.system.resources || [];
    const toRemoveIndex = resources.findIndex(element => element.id === resourceId);

    if (toRemoveIndex === -1) {
      console.warn(`Resource with id ${resourceId} not found`);
      return Promise.resolve(item);
    }

    resources.splice(toRemoveIndex, 1);
    return item.update({ system: { resources: [...resources] } });
  }

  /**
   * Atualiza um campo específico de um recurso
   * @param {Item} item - O item que contém o recurso
   * @param {string} resourceId - O ID do recurso a ser atualizado
   * @param {string} field - O campo a ser atualizado (name, value, maxValue)
   * @param {any} value - O novo valor do campo
   * @returns {Promise<Item>}
   */
  static updateResourceField(item, resourceId, field, value) {
    const resources = item.system.resources || [];
    const resource = resources.find(element => element.id === resourceId);

    if (!resource) {
      console.warn(`Resource with id ${resourceId} not found`);
      return Promise.resolve(item);
    }

    resource[field] = value;

    // Se atualizou valuePerLevel ou defaultValue, recalcula maxValue
    if (field === "valuePerLevel" || field === "defaultValue") {
      const level = item.system.level || 1;
      resource.maxValue = +level * +resource.valuePerLevel + +resource.defaultValue;
    }

    return item.update({ system: { resources: [...resources] } });
  }

  /**
   * Alterna a visibilidade (show) de um recurso
   * @param {Item} item - O item que contém o recurso
   * @param {string} resourceId - O ID do recurso
   * @param {boolean} show - O novo valor de show
   * @returns {Promise<Item>}
   */
  static toggleResourceVisibility(item, resourceId, show) {
    return this.updateResourceField(item, resourceId, "show", show);
  }

  /**
   * Aumenta o valor de um recurso
   * @param {Item} item - O item que contém o recurso
   * @param {string} resourceId - O ID do recurso
   * @param {number} amount - A quantidade a aumentar (padrão: 1)
   * @returns {Promise<Item>}
   */
  static increaseResourceValue(item, resourceId, amount = 1) {
    const resources = item.system.resources || [];
    const resource = resources.find(resource => resource.id === resourceId);

    if (!resource) {
      console.warn(`Resource with id ${resourceId} not found`);
      return Promise.resolve(item);
    }

    if (resource.value == resource.maxValue) {
      ui.notifications.info("Os pontos deste recurso já estão no máximo");
      return Promise.resolve(item);
    }

    resource.value = parseInt(resource.value) + amount;
    if (resource.value > resource.maxValue) {
      resource.value = resource.maxValue;
    }

    return item.update({ system: { resources: [...resources] } });
  }

  /**
   * Diminui o valor de um recurso
   * @param {Item} item - O item que contém o recurso
   * @param {string} resourceId - O ID do recurso
   * @param {number} amount - A quantidade a diminuir (padrão: 1)
   * @returns {Promise<Item>}
   */
  static decreaseResourceValue(item, resourceId, amount = 1) {
    const resources = item.system.resources || [];
    const resource = resources.find(resource => resource.id === resourceId);

    if (!resource) {
      console.warn(`Resource with id ${resourceId} not found`);
      return Promise.resolve(item);
    }

    if (resource.value == 0) {
      ui.notifications.info("Os pontos deste recurso já estão no mínimo");
      return Promise.resolve(item);
    }

    resource.value = parseInt(resource.value) - amount;
    if (resource.value < 0) {
      resource.value = 0;
    }

    return item.update({ system: { resources: [...resources] } });
  }

  /**
   * Define o valor de um recurso para o máximo
   * @param {Item} item - O item que contém o recurso
   * @param {string} resourceId - O ID do recurso
   * @returns {Promise<Item>}
   */
  static setResourceToMax(item, resourceId) {
    const resources = item.system.resources || [];
    const resource = resources.find(resource => resource.id === resourceId);

    if (!resource) {
      console.warn(`Resource with id ${resourceId} not found`);
      return Promise.resolve(item);
    }

    resource.value = resource.maxValue;
    return item.update({ system: { resources: [...resources] } });
  }

  /**
   * Define o valor de um recurso para zero
   * @param {Item} item - O item que contém o recurso
   * @param {string} resourceId - O ID do recurso
   * @returns {Promise<Item>}
   */
  static setResourceToZero(item, resourceId) {
    const resources = item.system.resources || [];
    const resource = resources.find(resource => resource.id === resourceId);

    if (!resource) {
      console.warn(`Resource with id ${resourceId} not found`);
      return Promise.resolve(item);
    }

    resource.value = 0;
    return item.update({ system: { resources: [...resources] } });
  }

  /**
   * Recalcula o maxValue de todos os recursos baseado no nível atual do item
   * @param {Item} item - O item que contém os recursos
   * @returns {Promise<Item>}
   */
  static recalculateAllResources(item) {
    const resources = item.system.resources || [];
    const level = item.system.level || 1;

    resources.forEach(resource => {
      if (resource.valuePerLevel !== undefined && resource.defaultValue !== undefined) {
        resource.maxValue = +level * +resource.valuePerLevel + +resource.defaultValue;
        // Garante que o value não ultrapasse o novo maxValue
        if (resource.value > resource.maxValue) {
          resource.value = resource.maxValue;
        }
      }
    });

    return item.update({ system: { resources: [...resources] } });
  }
}
