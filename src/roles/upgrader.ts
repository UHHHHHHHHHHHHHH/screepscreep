import { BaseRole } from './base';

export class UpgraderRole extends BaseRole {
  run(creep: Creep): void {
    this.updateWorkingState(creep);

    if (creep.memory.working) {
      if (creep.upgradeController(creep.room.controller!) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller!);
      }
    } else {
      this.collectEnergy(creep);
    }
  }
}
