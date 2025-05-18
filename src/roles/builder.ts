/**
 * @fileoverview Defines the behavior for Builder creeps.
 * Builders are responsible for constructing new sites and repairing damaged structures.
 * They prioritize critical repairs, then construction, then general repairs.
 * If no work is available, they may become idle or assist with other tasks.
 * @module roles/builder
 */

import { BaseRole } from './base';
import { handleIdle } from '../managers/idleHelper'; // For a more comprehensive idle behavior

// Define repair thresholds as a constant for clarity and reusability
const PRIORITY_REPAIR_THRESHOLDS: Partial<Record<StructureConstant, { pct?: number; hp?: number }>> = {
  [STRUCTURE_CONTAINER]: { pct: 0.8 }, // Repair containers if below 80% HP
  [STRUCTURE_ROAD]: { pct: 0.5 },      // Repair roads if below 50% HP (roads have 5000 max HP)
  [STRUCTURE_EXTENSION]: { pct: 0.8 }, // Repair extensions if below 80% HP
  // Add other structures like Spawns, Towers if needed
  // [STRUCTURE_SPAWN]: { pct: 0.9 },
  // [STRUCTURE_TOWER]: { pct: 0.75 },
};


export class BuilderRole extends BaseRole {
  /**
   * Main execution logic for the Builder role.
   * Updates working state, then directs the creep to collect energy or perform build/repair tasks.
   * @param {Creep} creep - The creep instance to run logic for.
   */
  public run(creep: Creep): void {
    this.updateWorkingState(creep); // Manages creep.memory.atCapacity

    if (creep.memory.atCapacity) {
      this.performWork(creep);
    } else {
      // Builders use the generic collectEnergy from BaseRole.
      // This could be customized if builders should prioritize specific energy sources.
      super.collectEnergy(creep);
    }
  }

  /**
   * Directs the builder to perform its primary work: repairing or building.
   * Prioritizes:
   * 1. Critical repairs based on `PRIORITY_REPAIR_THRESHOLDS`.
   * 2. Constructing available `FIND_CONSTRUCTION_SITES`.
   * 3. General repairs for any non-wall/rampart structure below max HP.
   * If no tasks are found, the creep might become idle.
   * @private
   * @param {Creep} creep - The builder creep.
   */
  private performWork(creep: Creep): void {
    if (this.tryPriorityRepair(creep)) return;
    if (this.tryBuild(creep)) return;
    if (this.tryGeneralRepair(creep)) return;

    // No work found, creep becomes idle.
    creep.say("👷 Idle");
    // Consider moving to a designated idle spot or using a more advanced idle handler.
    // const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
    // if (spawn) {
    //     creep.moveTo(spawn, { visualizePathStyle: { stroke: '#555555' }, range: 3 });
    // }
    // Or use handleIdle for more dynamic behavior:
    handleIdle(creep);
  }

  /**
   * Attempts to find and repair critically damaged structures based on `PRIORITY_REPAIR_THRESHOLDS`.
   * @private
   * @param {Creep} creep - The builder creep.
   * @returns {boolean} True if a priority repair task was undertaken, false otherwise.
   */
  private tryPriorityRepair(creep: Creep): boolean {
    const damagedStructures = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => {
        // Exclude walls and ramparts from this specific priority repair logic
        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
          return false;
        }
        const threshold = PRIORITY_REPAIR_THRESHOLDS[s.structureType];
        if (!threshold) return false; // Only repair types defined in thresholds

        if (threshold.pct != null && s.hits < s.hitsMax * threshold.pct) return true;
        // Absolute HP threshold: repair if current hits are less than the defined HP value
        if (threshold.hp != null && s.hits < threshold.hp) return true;
        return false;
      },
    });

    if (damagedStructures.length > 0) {
      const target = creep.pos.findClosestByPath(damagedStructures); // Switched to findClosestByPath
      if (target) {
        creep.say("🛠️ Prior");
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } }); // Red for priority
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Attempts to find and build construction sites.
   * @private
   * @param {Creep} creep - The builder creep.
   * @returns {boolean} True if a build task was undertaken, false otherwise.
   */
  private tryBuild(creep: Creep): boolean {
    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (constructionSites.length > 0) {
      // Optional: Prioritize construction sites (e.g., by type or proximity to spawn)
      // constructionSites.sort((a,b) => ...);
      const target = creep.pos.findClosestByPath(constructionSites); // Switched to findClosestByPath
      if (target) {
        creep.say("🚧 Build");
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // White for build
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Attempts to find and repair any damaged structure (excluding walls and ramparts)
   * that is not at maximum hit points. This is a lower priority task.
   * @private
   * @param {Creep} creep - The builder creep.
   * @returns {boolean} True if a general repair task was undertaken, false otherwise.
   */
  private tryGeneralRepair(creep: Creep): boolean {
    const anyDamaged = creep.room.find(FIND_STRUCTURES, {
      filter: s =>
        s.structureType !== STRUCTURE_WALL &&
        s.structureType !== STRUCTURE_RAMPART && // Still excluding these from general builder tasks
        s.hits < s.hitsMax
    });

    if (anyDamaged.length > 0) {
      const target = creep.pos.findClosestByPath(anyDamaged); // Switched to findClosestByPath
      if (target) {
        creep.say("🔧 Repair");
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } }); // Orange for general
        }
        return true;
      }
    }
    return false;
  }
}
