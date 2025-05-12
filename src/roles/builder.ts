import { BaseRole } from './base';

export class BuilderRole extends BaseRole {
  run(creep: Creep): void {
    this.updateWorkingState(creep);

    if (creep.memory.atCapacity) {
      this.buildOrRepair(creep);
    } else {
      this.collectEnergy(creep);
    }
  }

  private buildOrRepair(creep: Creep): void {
    // 1. Target only things under your repair thresholds
    const thresholds: Partial<Record<StructureConstant, { pct?: number; hp?: number }>> = {
      [STRUCTURE_CONTAINER]: { pct: 0.8 },
      [STRUCTURE_ROAD]: { hp: 5000 },
      [STRUCTURE_EXTENSION]: { pct: 0.8 },
    };

    const damaged = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => {
        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART)
          return false;
        const t = thresholds[s.structureType];
        if (!t) return false;

        const lost = s.hitsMax - s.hits;
        if (t.pct != null && s.hits < s.hitsMax * t.pct) return true;
        if (t.hp != null && lost > t.hp) return true;
        return false;
      },
    });

    if (damaged.length > 0) {
      const target = creep.pos.findClosestByRange(damaged);
      if (target && creep.repair(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
      }
      return;
    }

    // 2. No priority repairs → build
    const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (sites.length > 0) {
      const buildTarget = creep.pos.findClosestByRange(sites);
      if (buildTarget && creep.build(buildTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(buildTarget, { visualizePathStyle: { stroke: '#ffffff' } });
      }
      return;
    }

    // 3. No builds either → repair anything damaged at all
    const anyDamaged = creep.room.find(FIND_STRUCTURES, {
      filter: s =>
        s.structureType !== STRUCTURE_WALL &&
        s.structureType !== STRUCTURE_RAMPART &&
        s.hits < s.hitsMax
    });
    if (anyDamaged.length > 0) {
      const target = creep.pos.findClosestByRange(anyDamaged);
      if (target && creep.repair(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      return;
    }

    // 4. Still nothing → idle by spawn
    const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
    if (spawn) creep.moveTo(spawn);
  }

}
