/**
 * @fileoverview Manages the collection and logging of resource statistics for rooms,
 * primarily focusing on energy. It provides functions to update, retrieve, and log
 * these statistics, which are cached in room memory to optimize performance.
 * These stats are used by other managers (e.g., `roleDemandManager`) to make
 * informed decisions.
 * @module managers/resourceManager
 */

/**
 * @interface RoomResourceStats
 * @description Defines the structure for storing cached resource statistics for a room.
 * This data is stored in `room.memory.resourceStats`.
 */
export interface RoomResourceStats {
    /** @property {number} energyInStructures - Total energy stored in all structures within the room (e.g., containers, storage, terminals, spawns, extensions). */
    energyInStructures: number;
    /** @property {number} energyInPiles - Total energy available in dropped resource piles on the ground. */
    energyInPiles: number;
    /** @property {number} energyInTransit - Total energy currently carried by all owned creeps within the room. */
    energyInTransit: number;
    /** @property {number} totalEnergy - The sum of energy in structures, piles, and transit. Represents the overall "liquid" energy in the room. */
    totalEnergy: number;
    /** @property {number} energyAvailable - Energy currently available in spawns and extensions for spawning creeps. Directly from `room.energyAvailable`. */
    energyAvailable: number;
    /** @property {number} energyCapacityAvailable - Total energy capacity of spawns and extensions. Directly from `room.energyCapacityAvailable`. */
    energyCapacityAvailable: number;
    /** @property {number} tickLastUpdated - The game tick at which these statistics were last calculated and cached. */
    tickLastUpdated: number;
}

/**
 * Initializes the `room.memory.resourceStats` object if it doesn't exist.
 * This ensures that the memory structure is present before attempting to update it.
 * @param {Room} room - The room for which to initialize resource stats memory.
 */
function initializeResourceStatsMemory(room: Room): void {
    if (!room.memory.resourceStats) {
        room.memory.resourceStats = {
            energyInStructures: 0,
            energyInPiles: 0,
            energyInTransit: 0,
            totalEnergy: 0,
            energyAvailable: 0,
            energyCapacityAvailable: 0,
            tickLastUpdated: 0, // Will be updated to Game.time by updateRoomResourceStats
        };
    }
}

/**
 * Calculates and updates the resource statistics for a given room.
 * It gathers information about energy in structures, on the ground (piles),
 * and carried by creeps. The results are stored in `room.memory.resourceStats`.
 * This function should be called periodically to keep the stats fresh, but not
 * necessarily every tick for every room due to CPU cost.
 *
 * @param {Room} room - The room for which to update resource statistics.
 * @returns {void}
 */
export function updateRoomResourceStats(room: Room): void {
    initializeResourceStatsMemory(room); // Ensure memory object exists

    const stats = room.memory.resourceStats!; // Non-null assertion after initialization

    // Calculate energy stored in all structures that have a 'store' property
    const energyInStructures = room.find(FIND_STRUCTURES).reduce((sum, structure) => {
        // Check if the structure has a 'store' property and it's not undefined or null
        if ('store' in structure && structure.store && typeof structure.store.getUsedCapacity === 'function') {
            // Explicitly type cast to access store for known types, or use a more generic check
            const s = structure as AnyStoreStructure; // AnyStructure with a store
            const energy = s.store.getUsedCapacity(RESOURCE_ENERGY);
            if (energy && energy > 0) {
                return sum + energy;
            }
        }
        return sum;
    }, 0);

    // Calculate energy in dropped resource piles
    const energyInPiles = room.find(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType === RESOURCE_ENERGY
    }).reduce((sum, resource) => sum + resource.amount, 0);

    // Calculate energy carried by all owned creeps in the room
    const energyInTransit = room.find(FIND_MY_CREEPS).reduce((sum, creep) => {
        return sum + (creep.store?.getUsedCapacity(RESOURCE_ENERGY) || 0);
    }, 0);

    // Calculate total "liquid" energy in the room
    const totalEnergy = energyInStructures + energyInPiles + energyInTransit;

    // Update the stats in memory
    stats.energyInStructures = energyInStructures;
    stats.energyInPiles = energyInPiles;
    stats.energyInTransit = energyInTransit;
    stats.totalEnergy = totalEnergy;
    stats.energyAvailable = room.energyAvailable; // Direct from game object
    stats.energyCapacityAvailable = room.energyCapacityAvailable; // Direct from game object
    stats.tickLastUpdated = Game.time;
}

/**
 * Retrieves the cached resource statistics for a room.
 * If the stats are not present in memory or are outdated (i.e., `tickLastUpdated`
 * is not the current `Game.time`), it calls `updateRoomResourceStats` to refresh them.
 * This ensures that any part of the AI accessing these stats gets up-to-date information
 * for the current tick without redundant calculations within the same tick.
 *
 * @param {Room} room - The room for which to get resource statistics.
 * @returns {RoomResourceStats} The resource statistics for the room.
 */
export function getRoomResourceStats(room: Room): RoomResourceStats {
    // Initialize if memory doesn't exist, or if it's from a previous tick.
    // This ensures stats are calculated at most once per room per tick when accessed via this getter.
    if (!room.memory.resourceStats || room.memory.resourceStats.tickLastUpdated !== Game.time) {
        updateRoomResourceStats(room);
    }
    return room.memory.resourceStats!; // Non-null assertion after update/initialization
}

/**
 * Logs the current energy statistics for a given room to the console.
 * This function retrieves the stats using `getRoomResourceStats` (which ensures they are up-to-date)
 * and formats them for readability.
 * Typically called periodically (e.g., every 10 ticks in `main.ts`).
 *
 * @param {Room} room - The room whose energy statistics are to be logged.
 * @returns {void}
 */
export function logRoomEnergyStats(room: Room): void {
    const stats = getRoomResourceStats(room); // This will also update if stale

    // Constructing the log message for better readability
    const logMessage = [
        `📊 [${room.name}] Energy Stats (Tick: ${stats.tickLastUpdated}):`,
        `    ➡️  Spawnable: ${stats.energyAvailable} / ${stats.energyCapacityAvailable}`,
        `    🏦 Stored (Structs): ${stats.energyInStructures}`,
        `    🪙 Dropped (Ground): ${stats.energyInPiles}`,
        `    🚚 Carried (Creeps): ${stats.energyInTransit}`,
        `    Σ  Total Liquid: ${stats.totalEnergy}`
    ].join('\n');

    console.log(logMessage);
}
