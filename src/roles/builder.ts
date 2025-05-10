import { BaseRole } from './base';

export class BuilderRole extends BaseRole {
  run(creep: Creep): void {
    this.updateWorkingState(creep);

    if (creep.memory.working) {
      this.build(creep);
    } else {
      this.collectEnergy(creep);
    }
  }

  private build(creep: Creep): void {
    const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (sites.length === 0) {
      // Optional: idle near spawn if nothing to build
      const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
      if (spawn) creep.moveTo(spawn);
      return;
    }

    const target = creep.pos.findClosestByRange(sites);
    if (target && creep.build(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
    }
  }
}
