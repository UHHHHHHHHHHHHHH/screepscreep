/**
 * @fileoverview Provides logic for creeps that are currently idle (i.e., have no
 * specific task assigned by their role). This module attempts to find productive
 * secondary tasks for these creeps, such as picking up dropped energy, building
 * construction sites, or upgrading the room controller.
 * @module managers/idleHelper
 */

import { isRoleDemandSatisfied } from "./roleDemandManager"; // Used to gate upgrading

/**
 * Minimum amount of energy a dropped pile must have for an idle creep to consider picking it up.
 */
const MIN_DROPPED_ENERGY_FOR_IDLE_PICKUP = 50;

/**
 * Minimum total energy in containers OR room.energyAvailable for an idle creep
 * to consider upgrading the controller. This prevents draining essential energy reserves.
 */
const MIN_STORED_ENERGY_FOR_IDLE_UPGRADE = 200;

/**
 * Handles the behavior for an idle creep.
 * The creep will attempt to perform tasks in the following order of priority:
 *
 * 1.  **Pickup Dropped Energy:** If the creep has free capacity, it will look for nearby
 *     dropped energy piles (RESOURCE_ENERGY) with at least `MIN_DROPPED_ENERGY_FOR_IDLE_PICKUP`
 *     and attempt to pick it up.
 *
 * 2.  **Build Construction Sites:** If there are construction sites in the room:
 *     a.  If the creep has free energy capacity, it will try to withdraw energy from the
 *         closest container with energy.
 *     b.  If the creep has energy (is full or got some from a container), it will move to
 *         the closest construction site and attempt to build it.
 *
 * 3.  **Upgrade Controller:** If there are no construction sites and the room's role demands
 *     (as determined by `isRoleDemandSatisfied`) are met:
 *     a.  It checks if there's sufficient energy in containers or spawns/extensions
 *         (above `MIN_STORED_ENERGY_FOR_IDLE_UPGRADE`).
 *     b.  If energy is sufficient and the creep needs energy, it attempts to withdraw
 *         from the closest container.
 *     c.  If energy is sufficient and the creep has energy, it moves to the controller
 *         and attempts to upgrade it.
 *
 * 4.  **Truly Idle:** If no other tasks are found, the creep will announce "🪑 idle".
 *     Further actions (like moving to a rally point or self-destructing) could be
 *     implemented here.
 *
 * @param {Creep} creep - The idle creep to handle.
 * @returns {void}
 */
export function handleIdle(creep: Creep): void {
    // Priority 0: If creep has energy, try to use it first (build/upgrade)
    // If creep needs energy, try to get it first (dropped/container)

    // Check for dropped energy if creep has space
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        const droppedResourcePile = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= MIN_DROPPED_ENERGY_FOR_IDLE_PICKUP
        });
        if (droppedResourcePile) {
            if (creep.pickup(droppedResourcePile) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedResourcePile, { visualizePathStyle: { stroke: '#ffaa00' }, range: 1 });
            }
            creep.say("💰捡起"); // "Picking up"
            return; // Task found
        }
    }

    // Task 1: Build if there are construction sites
    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (constructionSites.length > 0) {
        creep.say("🔨IdleBuild");
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) { // Needs energy
            // Try to get energy from containers first
            const energyContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s): s is StructureContainer | StructureStorage => // Consider storage too
                    (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                    s.store[RESOURCE_ENERGY] > 0,
            });

            if (energyContainer) {
                if (creep.withdraw(energyContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(energyContainer, { visualizePathStyle: { stroke: '#00ff00' }, range: 1 });
                }
                return; // Task found (getting energy)
            }
            // If no containers with energy, and creep is empty, it can't build.
            // It might fall through to upgrading (if it also needs energy there) or true idle.
        } else { // Has energy, go build
            const targetSite = creep.pos.findClosestByPath(constructionSites);
            if (targetSite) {
                if (creep.build(targetSite) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetSite, { visualizePathStyle: { stroke: '#ffffff' }, range: 3 });
                }
                return; // Task found (building)
            }
        }
    }

    // Task 2: Upgrade controller if nothing to build and role demands are satisfied
    const controller = creep.room.controller;
    // Check if controller exists, is mine, and general role demands are met (to avoid starving other roles)
    if (controller && controller.my && isRoleDemandSatisfied(creep.room)) {
        creep.say("⬆️IdleUpg");
        // Check for sufficient energy reserves before allowing idle creeps to upgrade
        const energyContainers = creep.room.find(FIND_STRUCTURES, {
            filter: (s): s is StructureContainer | StructureStorage =>
                (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                s.store[RESOURCE_ENERGY] > 0,
        });

        const totalEnergyInPreferredStorage = energyContainers.reduce(
            (sum, c) => sum + c.store[RESOURCE_ENERGY],
            0
        );

        // Allow upgrade if significant energy in containers/storage OR if room energy (spawns/extensions) is high
        if (totalEnergyInPreferredStorage >= MIN_STORED_ENERGY_FOR_IDLE_UPGRADE || creep.room.energyAvailable >= MIN_STORED_ENERGY_FOR_IDLE_UPGRADE) {
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) { // Needs energy
                if (energyContainers.length > 0) {
                    // Prefer withdrawing from the fullest container for upgraders
                    energyContainers.sort((a,b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
                    const targetContainer = energyContainers[0];
                    if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#00ff00' }, range: 1 });
                    }
                    return; // Task found (getting energy)
                }
                // If no containers, and creep needs energy for upgrading, it might try spawn/extensions if allowed by BaseRole.collectEnergy
                // For now, if no containers, it might become truly idle or wait.
            } else { // Has energy, go upgrade
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#4CAF50' }, range: 3 });
                }
                return; // Task found (upgrading)
            }
        } else {
             if (Game.time % 11 === 0) creep.say("💰Low E"); // Energy too low for idle upgrade
        }
    }

    // Task 3: No suitable tasks found, truly idle
    // Consider moving to a designated rally point, or parking near spawn/controller.
    // creep.moveTo(rallyPointPos);
    if (Game.time % 3 === 0) { // Say idle less frequently to reduce visual spam if many are idle
        creep.say("🪑 idle");
    }
    // Optional: Move to a less obstructive spot, e.g., near a spawn but not blocking it.
    // const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
    // if (spawn && !creep.pos.inRangeTo(spawn, 2)) {
    //    creep.moveTo(spawn, {range: 2, visualizePathStyle: {stroke: '#555555', lineStyle: 'dashed'}});
    // }
}
