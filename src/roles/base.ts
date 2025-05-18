/**
 * @fileoverview Defines the abstract base class for all creep roles.
 * It provides common functionalities like energy collection, delivery, and state management
 * that can be inherited or overridden by specific role implementations.
 * @module roles/base
 */

export abstract class BaseRole {
  /**
   * Abstract method to be implemented by concrete role classes.
   * Defines the primary logic and behavior for a creep of this role during a game tick.
   * @abstract
   * @param {Creep} creep - The creep instance to run the logic for.
   * @returns {void}
   */
  abstract run(creep: Creep): void;

  /**
   * Handles the logic for a creep to collect energy.
   * Prioritizes:
   * 1. Picking up dropped resources.
   * 2. Withdrawing from spawns or extensions (if they have energy).
   * 3. Harvesting from the closest source as a last resort.
   * @protected
   * @param {Creep} creep - The creep that needs to collect energy.
   * @returns {void}
   */
  protected collectEnergy(creep: Creep): void {
    // Try to pick up dropped energy first
    const pile = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50 // Consider making '50' a constant
    });
    if (pile) {
      if (creep.pickup(pile) === ERR_NOT_IN_RANGE) {
        creep.moveTo(pile, { visualizePathStyle: { stroke: '#ffaa00' } }); // Added path visualization
      }
      return;
    }

    // Then, try to withdraw from structures that can provide energy (spawns, extensions)
    // Note: Containers and Storage are usually handled by specific roles (e.g., Hauler) or different logic.
    const storageTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (s): s is StructureSpawn | StructureExtension => // Type guard for store access
        (s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_EXTENSION) &&
        s.store.getUsedCapacity(RESOURCE_ENERGY) > 0, // Check if they actually have energy
    });

    if (storageTargets.length > 0) {
      // Potentially sort by proximity or amount if multiple targets
      const target = creep.pos.findClosestByPath(storageTargets);
      if (target && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      return;
    }

    // Fallback: harvest from an available source directly
    // This might be undesirable for some roles if dedicated miners/harvesters exist.
    const sources = creep.room.find(FIND_SOURCES_ACTIVE); // Prefer active sources
    if (sources.length > 0) {
      const source = creep.pos.findClosestByPath(sources);
      if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
    }
  }

  /**
   * Updates the `creep.memory.atCapacity` flag based on its current energy store.
   * Sets `atCapacity` to `true` if the creep has no free energy capacity.
   * Sets `atCapacity` to `false` if the creep had `atCapacity` true and now has 0 energy.
   * @protected
   * @param {Creep} creep - The creep whose working state needs to be updated.
   * @returns {void}
   */
  protected updateWorkingState(creep: Creep): void {
    if (creep.memory.atCapacity && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.atCapacity = false;
      creep.say('🔄 harvest'); // Optional: visual feedback
    }
    if (!creep.memory.atCapacity && creep.store.getFreeCapacity() === 0) {
      creep.memory.atCapacity = true;
      creep.say('⚡ deliver'); // Optional: visual feedback
    }
  }

  /**
   * Handles the logic for a creep to deliver energy to structures that need it.
   * Prioritizes spawns and extensions.
   * Other structures (towers, controller containers) might be handled by specific roles or more complex logic.
   * @protected
   * @param {Creep} creep - The creep that needs to deliver energy.
   * @returns {void}
   */
  protected deliverEnergy(creep: Creep): void {
    const targets = creep.room.find(FIND_STRUCTURES, {
      filter: (s): s is StructureSpawn | StructureExtension => // Type guard for store access
        (s.structureType === STRUCTURE_SPAWN ||
         s.structureType === STRUCTURE_EXTENSION) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    if (targets.length > 0) {
      const target = creep.pos.findClosestByPath(targets); // Find closest pathable target
      if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
      }
    } else {
      // Optional: if no spawns/extensions need energy, what should it do?
      // Maybe drop near controller for upgraders, or fill a tower?
      // For a generic harvester, this might mean idling or upgrading.
      // Consider calling handleIdle(creep) or a similar fallback.
      creep.say('🤷‍♂️ full?');
    }
  }
}