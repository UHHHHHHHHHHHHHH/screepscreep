export abstract class BaseRole {
  abstract run(creep: Creep): void;

  protected collectEnergy(creep: Creep): void {
    // Normal: withdraw from spawn/extensions
    const pile = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    });
    if (pile) {
      if (creep.pickup(pile) === ERR_NOT_IN_RANGE) {
        creep.moveTo(pile);
      }
      return;
    }

    const storageTargets = creep.room.find(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_EXTENSION) &&
        s.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
    });

    if (storageTargets.length > 0) {
      if (creep.withdraw(storageTargets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storageTargets[0]);
      }
      return;
    }

    // Fallback: harvest from source directly
    const sources = creep.room.find(FIND_SOURCES);
    if (sources.length > 0 && creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
      creep.moveTo(sources[0]);
    }
  }

  protected updateWorkingState(creep: Creep): void {
    if (creep.memory.atCapacity && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.atCapacity = false;
    }
    if (!creep.memory.atCapacity && creep.store.getFreeCapacity() === 0) {
      creep.memory.atCapacity = true;
    }
  }

  protected deliverEnergy(creep: Creep): void {
    const targets = creep.room.find(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_SPAWN ||
         s.structureType === STRUCTURE_EXTENSION) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    if (targets.length > 0 && creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(targets[0]);
    }
  }
}
