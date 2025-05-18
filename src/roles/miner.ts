/**
 * @fileoverview Defines the behavior for Miner creeps.
 * Miners are specialized creeps that position themselves at a pre-defined spot
 * (typically where a container is or will be) next to an assigned energy source
 * and continuously harvest it. They do not transport energy.
 * @module roles/miner
 */

import { BaseRole } from "./base";
// import { handleIdle } from "../managers/idleHelper"; // Miners generally don't go idle if properly assigned.

export class MinerRole extends BaseRole {
  /**
   * Main execution logic for the Miner role.
   * Ensures the miner has necessary memory assignments (sourceId, containerPosition),
   * moves to its designated mining spot, and then harvests the source.
   * @param {Creep} creep - The miner creep instance.
   */
  public run(creep: Creep): void {
    // 1. Validate essential memory properties
    if (!this.hasValidAssignments(creep)) {
      // Errors are logged within hasValidAssignments
      return;
    }

    // 2. Get the designated mining position
    // We've already validated that positions[sourceId] exists in hasValidAssignments.
    const { x, y } = creep.room.memory.containerPositions![creep.memory.sourceId!];
    const designatedPos = new RoomPosition(x, y, creep.room.name);

    // 3. Move to the designated position if not already there
    if (!creep.pos.isEqualTo(designatedPos)) {
      this.moveToDesignatedPosition(creep, designatedPos);
      return;
    }

    // 4. At the designated position, perform harvesting
    this.performHarvesting(creep);
  }

  /**
   * Checks if the miner has all necessary memory assignments to function.
   * Logs errors and makes the creep say its status if assignments are missing.
   * @private
   * @param {Creep} creep - The miner creep.
   * @returns {boolean} True if all assignments are valid, false otherwise.
   */
  private hasValidAssignments(creep: Creep): boolean {
    const sourceId = creep.memory.sourceId;
    if (!sourceId) {
      creep.say("❓NoSrcID");
      console.log(`Miner ${creep.name} is missing sourceId.`);
      return false;
    }

    const containerPositions = creep.room.memory.containerPositions;
    if (!containerPositions || !containerPositions[sourceId]) {
      creep.say("❌NoSpot");
      console.log(`Miner ${creep.name} (source: ${sourceId}) is missing a designated containerPosition in room memory.`);
      return false;
    }
    return true;
  }

  /**
   * Moves the creep to its designated mining position.
   * @private
   * @param {Creep} creep - The miner creep.
   * @param {RoomPosition} designatedPos - The position to move to.
   */
  private moveToDesignatedPosition(creep: Creep, designatedPos: RoomPosition): void {
    creep.moveTo(designatedPos, {
      visualizePathStyle: { stroke: "#ffaa00" }, // Orange for moving to position
      range: 0 // Must be exactly on the spot
    });
  }

  /**
   * Performs the harvesting action once the miner is in position.
   * Handles cases where the source might be gone or harvesting fails.
   * @private
   * @param {Creep} creep - The miner creep.
   */
  private performHarvesting(creep: Creep): void {
    // sourceId is guaranteed to exist due to hasValidAssignments check
    const source = Game.getObjectById<Source>(creep.memory.sourceId!);

    if (!source) {
      creep.say("❓SrcGone");
      console.log(`Miner ${creep.name} assigned source ${creep.memory.sourceId} no longer exists or is not visible.`);
      // Consider clearing creep.memory.sourceId here or letting a higher-level manager handle reassignment.
      delete creep.memory.sourceId;
      return;
    }

    const harvestResult = creep.harvest(source);
    if (harvestResult === OK) {
      // Successful harvest.
      // If miner has WORK and CARRY, and is on a container, it could transfer.
      // But this simple miner doesn't handle that; it relies on dropping or container auto-pickup.
    } else if (harvestResult === ERR_NOT_ENOUGH_RESOURCES) {
      creep.say("⛏️Empty");
      // Source is depleted. Miner waits. No action needed.
    } else if (harvestResult === ERR_BUSY) {
      // Creep is spawning, do nothing.
    } else if (harvestResult === ERR_NO_BODYPART) {
      creep.say("💔NoWORK");
      console.log(`Miner ${creep.name} has no WORK parts.`);
      // This is a critical failure for a miner. Consider suicide or re-role.
    } else if (harvestResult === ERR_NOT_OWNER){
        creep.say("🏢NotMyCtrlr"); // Should not happen with sources
    } else if (harvestResult === ERR_INVALID_TARGET){
        creep.say("❌InvTrg");
        console.log(`Miner ${creep.name} has invalid harvest target: ${source}`);
        delete creep.memory.sourceId; // Clear bad sourceId
    }
    else {
      // Any other error
      creep.say(`💀HrvFail:${harvestResult}`);
      console.log(`Miner ${creep.name} failed to harvest source ${source.id} with error: ${harvestResult}`);
    }
  }
}