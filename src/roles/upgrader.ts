/**
 * @fileoverview Defines the behavior for Upgrader creeps.
 * Upgraders are responsible for taking energy to the room's controller and upgrading it.
 * They use the `atCapacity` memory flag to switch between collecting energy and upgrading.
 * @module roles/upgrader
 */

import { BaseRole } from './base';
import { handleIdle } from '../managers/idleHelper'; // For potential idle behavior

export class UpgraderRole extends BaseRole {
    /**
     * Main execution logic for the Upgrader role.
     * Updates the creep's working state and then either collects energy or upgrades the controller.
     * @param {Creep} creep - The creep instance to run logic for.
     */
    public run(creep: Creep): void {
        this.updateWorkingState(creep); // Manages creep.memory.atCapacity

        if (creep.memory.atCapacity) {
            this.performUpgrade(creep);
        } else {
            // Upgraders use the generic collectEnergy from BaseRole.
            // This could be customized if upgraders should, for example, prioritize
            // withdrawing from a specific controller link or container.
            super.collectEnergy(creep);
        }
    }

    /**
     * Handles the task of upgrading the room controller.
     * Moves to the controller and attempts to upgrade it.
     * If the controller is not found or not owned, the creep may become idle.
     * @private
     * @param {Creep} creep - The upgrader creep.
     */
    private performUpgrade(creep: Creep): void {
        const controller = creep.room.controller;

        if (controller && controller.my) { // Ensure controller exists and is ours
            const upgradeResult = creep.upgradeController(controller);
            if (upgradeResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, {
                    visualizePathStyle: { stroke: '#4CAF50' }, // Green for upgrading
                    range: 3 // Standard range for upgrading
                });
            } else if (upgradeResult === OK) {
                // Optionally, do something if upgrade is successful, e.g., check for nearby links
            } else if (upgradeResult === ERR_NOT_ENOUGH_RESOURCES) {
                // This case should be handled by updateWorkingState, but as a fallback:
                creep.memory.atCapacity = false;
                creep.say("⛏️ Empty!");
            } else {
                creep.say(`⚠️ UpgErr ${upgradeResult}`);
            }
        } else {
            // Controller not found, not ours, or some other issue.
            creep.say("❓ No Ctrlr");
            handleIdle(creep); // Fallback to idle behavior
        }
    }
}
