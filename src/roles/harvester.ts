import { BaseRole } from './base';

export class HarvesterRole extends BaseRole {
  run(creep: Creep): void {
    this.updateWorkingState(creep);

    if (creep.memory.atCapacity) {
      this.deliverEnergy(creep);
    } else {
      this.harvest(creep);
    }
  }

  private harvest(creep: Creep): void {
    const sourceId = creep.memory.sourceId;
    let source = sourceId ? Game.getObjectById(sourceId) : null;

    if (!source) {
      source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) {
        creep.memory.sourceId = source.id;
        creep.say("🔁");
      } else {
        creep.say("❓ no src");
        return;
      }
    }

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source);
    }
  }
}
