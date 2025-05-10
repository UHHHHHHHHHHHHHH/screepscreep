export const roleUpgrader = {
  run(creep: Creep) {
    // If upgrading and out of energy, switch to gathering
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    // If gathering and full, switch to upgrading
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    if (creep.memory.working) {
      // Upgrade the controller
      if (creep.upgradeController(creep.room.controller!) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller!);
      }
    } else {
      // First try to withdraw energy from spawn/extensions
      const targets = creep.room.find(FIND_STRUCTURES, {
        filter: structure =>
          (structure.structureType === STRUCTURE_SPAWN ||
           structure.structureType === STRUCTURE_EXTENSION) &&
          structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
      });

      if (targets.length > 0) {
        if (creep.withdraw(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0]);
        }
      } else {
        // Fallback to harvesting
        const sources = creep.room.find(FIND_SOURCES);
        if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(sources[0]);
        }
      }
    }
  },
};
