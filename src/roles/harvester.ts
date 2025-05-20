/**
 * @fileoverview Defines the behavior for Harvester creeps.
 * Harvesters are responsible for collecting energy from sources and
 * delivering it to spawns and extensions. They utilize the `atCapacity`
 * memory flag to switch between harvesting and delivering states.
 * @module roles/harvester
 */

import { BaseRole } from './base';
import { handleIdle } from '../managers/idleHelper'; // Assuming you might want idle behavior

export class HarvesterRole extends BaseRole {
    /**
     * Main execution logic for the Harvester role.
     * It updates the creep's working state and then either harvests energy
     * or delivers it based on whether the creep is at capacity.
     * @param {Creep} creep - The creep instance to run logic for.
     */
    public run(creep: Creep): void {
        this.updateWorkingState(creep); // Manages creep.memory.atCapacity
        this.assignSource(creep);

        if (creep.memory.atCapacity) {
            this.performDelivery(creep);
        } else {
            this.performHarvest(creep);
        }
    }

    /**
     * Handles the energy harvesting task for the creep.
     * Assigns a source if one isn't already assigned and moves to harvest from it.
     * @private
     * @param {Creep} creep - The harvester creep.
     */
    private performHarvest(creep: Creep): void {
        let source: Source | null = null;

        // Attempt to get source from memory
        if (creep.memory.sourceId) {
            source = Game.getObjectById(creep.memory.sourceId);
            // Invalidate cached source if it's gone or depleted (if you want to switch for depleted ones)
            if (!source /* || source.energy === 0 */) {
                delete creep.memory.sourceId;
                source = null;
            }
        }

        // If no valid source in memory, find the closest available one
        if (!source) {
            // Consider finding sources with energy: FIND_SOURCES_ACTIVE
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length > 0) {
                // Potentially assign sources more intelligently (e.g. using getAvailableSourceId from spawnManager)
                source = creep.pos.findClosestByPath(sources);
                if (source) {
                    creep.memory.sourceId = source.id;
                    creep.say("🔄 New Src");
                }
            }
        }

        // If a source is found, harvest from it
        if (source) {
            const harvestResult = creep.harvest(source);
            if (harvestResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else if (harvestResult === OK) {
                // Optionally, say something or do nothing
            } else if (harvestResult === ERR_NOT_ENOUGH_RESOURCES) {
                // Source is empty, clear memory so it finds a new one next tick or waits
                delete creep.memory.sourceId;
                creep.say("⛏️ Empty");
            } else if (harvestResult === ERR_NO_BODYPART) {
                creep.say("💔 No WORK");
                // consider suicide or re-role
            }
        } else {
            creep.say("❓ No Src");
            // No sources available or found, creep might become idle
            handleIdle(creep); // Or some other fallback
        }
    }

    /**
     * Handles delivering energy to structures.
     * This method currently calls the `deliverEnergy` method from `BaseRole`.
     * It can be customized if Harvesters have specific delivery priorities.
     * If no delivery targets are found, the creep might become idle.
     * @private
     * @param {Creep} creep - The harvester creep.
     */
    private performDelivery(creep: Creep): void {
        // Utilize BaseRole.deliverEnergy for common delivery logic
        // You can override this if Harvesters have special delivery targets
        // e.g. prioritize filling towers before spawns/extensions in some cases.
        super.deliverEnergy(creep);

        // Check if the creep still has energy after attempting delivery.
        // If it does, it means no valid targets were found by deliverEnergy.
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            const hasDeliveryTargets = creep.room.find(FIND_STRUCTURES, {
                filter: (s): s is StructureSpawn | StructureExtension =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
            }).length > 0;

            if (!hasDeliveryTargets) {
                creep.say("🚚 IdleFull");
                handleIdle(creep); // No targets, let idle logic take over (e.g., build, upgrade)
            }
        }
    }
}