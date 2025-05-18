/**
 * @fileoverview Defines the behavior for Hauler creeps.
 * Haulers are primarily responsible for transporting energy.
 * - If a `containerId` is assigned in memory and the container has energy, they will withdraw from it.
 * - When at capacity, they attempt to deliver energy to Spawns and Extensions.
 * - If specific tasks (withdraw from assigned container, deliver to spawn/extension) are not applicable
 *   or completed, the creep will fall back to `handleIdle` behavior, which might involve
 *   picking up dropped resources or other general tasks. Haulers spawned without a `containerId`
 *   will rely more heavily on this `handleIdle` behavior for finding work.
 * @module roles/hauler
 */

import { BaseRole } from "./base";
import { handleIdle } from "../managers/idleHelper";

export class HaulerRole extends BaseRole {
    /**
     * Main execution logic for the Hauler role.
     *
     * The logic flow is as follows:
     * 1. Update `creep.memory.atCapacity` based on current energy stores.
     * 2. If `atCapacity` is true:
     *    a. Attempt to find Spawns or Extensions that need energy.
     *    b. If targets are found, attempt to transfer energy or move to the target, then `return`.
     *    c. If no such targets are found, execution *continues* to the next block (container withdrawal).
     * 3. (If not `atCapacity`, OR if `atCapacity` but no Spawn/Extension targets were found):
     *    a. Check `creep.memory.containerId`.
     *    b. If a valid container with energy is found, attempt to withdraw energy or move to it, then `return`.
     * 4. If none of the above actions resulted in a `return`, call `handleIdle(creep)` as a fallback.
     *
     * @param {Creep} creep - The hauler creep instance.
     */
    run(creep: Creep): void {
        this.updateWorkingState(creep); // Manages creep.memory.atCapacity

        // Step 2: If creep is at capacity, try to deliver to primary targets
        if (creep.memory.atCapacity) {
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
            });

            if (targets.length > 0) {
                // If delivery targets exist, attempt action and finish for this tick
                if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
                return; // Task attempted (delivery or move to deliver)
            }
            // If atCapacity BUT no primary targets found, logic proceeds to container check.
            // This means a full hauler without spawn/extension targets will then check its container.
        }

        // Step 3: (If not atCapacity OR if atCapacity with no primary targets) Try to withdraw from assigned container
        const containerId = creep.memory.containerId;
        const container = containerId
            ? Game.getObjectById<StructureContainer>(containerId)
            : null;

        if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            // If an assigned container exists and has energy, attempt to withdraw
            // Note: If creep was atCapacity and fell through, withdraw will fail if still full.
            if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container);
            }
            return; // Task attempted (withdraw or move to withdraw)
        }

        // Step 4: Fallback to idle behavior if no specific hauler task was performed
        // This is reached if:
        // - Creep is not atCapacity and has no (valid/non-empty) assigned container.
        // - Creep is atCapacity, has no spawn/extension targets, and has no (valid/non-empty) assigned container.
        handleIdle(creep);
    }
}