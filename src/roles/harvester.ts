import { BaseRole } from './base';

export class HarvesterRole extends BaseRole {
  run(creep: Creep): void {
    this.updateWorkingState(creep);

    if (creep.memory.working) {
      this.deliverEnergy(creep);
    } else {
      this.harvest(creep);
    }
  }

  private deliverEnergy(creep: Creep): void {
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

  private harvest(creep: Creep): void {
    const sources = creep.room.find(FIND_SOURCES);
    if (sources.length > 0 && creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
      creep.moveTo(sources[0]);
    }
  }
}
