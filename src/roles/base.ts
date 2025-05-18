import { Role } from "../types/roles";
/**
 * @fileoverview Defines the abstract base class for all creep roles.
 * It provides common functionalities like energy collection, delivery, and state management
 * that can be inherited or overridden by specific role implementations.
 * @module roles/base
 */

export abstract class BaseRole {
    /**
     * Abstract method to be implemented by concrete role classes.
     * Defines the primary logic and behavior for a creep of this role during a game tick.
     * @abstract
     * @param {Creep} creep - The creep instance to run the logic for.
     * @returns {void}
     */
    abstract run(creep: Creep): void;

    /**
     * Handles the logic for a creep to collect energy.
     * Prioritizes:
     * 1. Picking up dropped resources.
     * 2. Withdrawing from containers or storage if available (preferred energy sources).
     * 3. Withdrawing from spawns or extensions ONLY if the room's spawn queue is empty.
     * 4. Harvesting from the closest active source as a last resort.
     * @protected
     * @param {Creep} creep - The creep that needs to collect energy.
     * @returns {void}
     */
    protected collectEnergy(creep: Creep): void {
        // 1. Try to pick up dropped energy first
        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > Math.min(50, creep.store.getFreeCapacity(RESOURCE_ENERGY) / 2) // Only go for significant piles
        });
        if (droppedEnergy) {
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, range: 1 });
            }
            return;
        }

        // 2. Try to withdraw from containers or storage (preferred storage)
        const preferredStorageTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (s): s is StructureContainer | StructureStorage =>
                (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                s.store.getUsedCapacity(RESOURCE_ENERGY) > (creep.memory.role === Role.Upgrader ? 100 : 50) // Ensure there's a decent amount
        });

        if (preferredStorageTargets.length > 0) {
            // Sort by amount, then by proximity for containers/storage
            preferredStorageTargets.sort((a, b) => {
                const energyA = a.store.getUsedCapacity(RESOURCE_ENERGY) || 0;
                const energyB = b.store.getUsedCapacity(RESOURCE_ENERGY) || 0;
                if (energyB !== energyA) {
                    return energyB - energyA; // Prefer fuller targets
                }
                return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b); // Then closer
            });
            const target = preferredStorageTargets[0];
            if (target && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' }, range: 1 }); // Green for preferred
            }
            return;
        }


        // 3. Conditionally withdraw from spawns or extensions
        // Only if the spawn queue is empty (or doesn't exist)
        const spawnQueue = creep.room.memory.spawnQueue;
        const allowWithdrawFromSpawnStructures = !spawnQueue || spawnQueue.length === 0;

        if (allowWithdrawFromSpawnStructures) {
            const spawnExtensionTargets = creep.room.find(FIND_STRUCTURES, {
                filter: (s): s is StructureSpawn | StructureExtension =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
            });

            if (spawnExtensionTargets.length > 0) {
                const target = creep.pos.findClosestByPath(spawnExtensionTargets);
                if (target && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffff00' }, range: 1 }); // Yellow for conditional
                }
                return;
            }
        } else {
            // If spawn queue is NOT empty, and this creep is an Upgrader, it might look for other sources.
            // Other roles (like a Builder needing a quick top-up) might just wait or go idle.
            if (creep.memory.role === Role.Upgrader && Game.time % 5 === 0) {
                 creep.say("⏳Spawn busy");
            }
        }

        // 4. Fallback: harvest from an available active source directly
        // This is generally less efficient for roles like Upgrader if haulers/miners are established.
        const activeSources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (activeSources.length > 0) {
            // For Upgraders, only harvest directly if no containers/storage and spawn is busy or empty
            if (creep.memory.role === Role.Upgrader && (preferredStorageTargets.length > 0 || !allowWithdrawFromSpawnStructures) && creep.room.energyAvailable > 0) {
                // Upgrader has other potential sources (even if spawn busy) or room has general energy, don't rush to source
                if (Game.time % 7 === 0) creep.say("🤔 Waiting");
                return; // Let them wait a bit or idle logic take over if no other options.
            }

            const source = creep.pos.findClosestByPath(activeSources);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ff0000' }, range: 1 }); // Red for last resort
            }
        } else {
            if (Game.time % 10 === 0) creep.say("🚫 No Energy");
        }
    }

    /**
     * Updates the `creep.memory.atCapacity` flag based on its current energy store.
     * Sets `atCapacity` to `true` if the creep has no free energy capacity.
     * Sets `atCapacity` to `false` if the creep had `atCapacity` true and now has 0 energy.
     * @protected
     * @param {Creep} creep - The creep whose working state needs to be updated.
     * @returns {void}
     */
    protected updateWorkingState(creep: Creep): void {
        if (creep.memory.atCapacity && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.atCapacity = false;
            // creep.say('🔄 collect'); // More generic term
        }
        if (!creep.memory.atCapacity && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.atCapacity = true;
            // creep.say('⚡ work'); // More generic term
        }
    }

    /**
     * Handles the logic for a creep to deliver energy to structures that need it.
     * Prioritizes spawns and extensions.
     * Other structures (towers, controller containers) might be handled by specific roles or more complex logic.
     * @protected
     * @param {Creep} creep - The creep that needs to deliver energy.
     * @returns {void}
     */
    protected deliverEnergy(creep: Creep): void {
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (s): s is StructureSpawn | StructureExtension | StructureTower => // Added Tower
                (s.structureType === STRUCTURE_SPAWN ||
                 s.structureType === STRUCTURE_EXTENSION ||
                 s.structureType === STRUCTURE_TOWER // Towers also need energy
                ) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
        });

        if (targets.length > 0) {
            // Prioritize towers if they are low, then spawns/extensions
            targets.sort((a, b) => {
                if (a.structureType === STRUCTURE_TOWER && b.structureType !== STRUCTURE_TOWER) return -1;
                if (b.structureType === STRUCTURE_TOWER && a.structureType !== STRUCTURE_TOWER) return 1;
                if (a.structureType === STRUCTURE_TOWER && b.structureType === STRUCTURE_TOWER) {
                    return (a.store.getUsedCapacity(RESOURCE_ENERGY) || 0) - (b.store.getUsedCapacity(RESOURCE_ENERGY) || 0); // Fill less full towers first
                }
                // For spawns/extensions, closest is fine.
                return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
            });

            const target = targets[0]; // Take the highest priority target
            if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, range: 1 });
            }
        } else {
            // If no primary targets (spawns, extensions, towers) need energy,
            // an Upgrader might just idle near the controller or try to upgrade if it's already there.
            // Other roles might look for repair tasks or go to an idle flag.
            if (creep.memory.role !== Role.Upgrader) { // Upgraders handle their own "full and no target" by upgrading
                creep.say('🤷‍♂️ full?');
                 // Consider calling handleIdle(creep) for non-upgraders if they have energy but no delivery target
                 // handleIdle(creep);
            }
        }
    }
}
