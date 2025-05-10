export abstract class BaseRole {
    abstract run(creep: Creep): void;
  
    protected collectEnergy(creep: Creep): void {
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
  
      const sources = creep.room.find(FIND_SOURCES);
      if (sources.length > 0 && creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0]);
      }
    }
  
    protected updateWorkingState(creep: Creep): void {
      if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
      }
      if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
      }
    }
  }
  