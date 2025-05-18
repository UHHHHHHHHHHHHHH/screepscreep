/**
 * @fileoverview Manages the determination of creep role demands for a room.
 * It calculates the desired number of creeps for each role based on room phase,
 * available structures, energy levels, and other game state factors.
 * Allows for manual overrides of these demands.
 * @module managers/roleDemandManager
 */

import { Role } from "../types/roles";
import { getRoomPhase } from "./roomManager";
import { countCreepsByRole } from "./creepManager";
import { getRoomResourceStats } from "./resourceManager";

/**
 * @typedef {Record<Role, number>} RoleDemand
 * @description A record mapping each `Role` to the number of creeps desired for that role.
 */
export type RoleDemand = Record<Role, number>;

// Get all Role enum string values as an array
const allRoles = Object.values(Role) as Role[];

/**
 * Checks if the current creep population in a room satisfies the calculated role demand.
 *
 * @param {Room} room - The room to check.
 * @returns {boolean} True if all role demands are met or exceeded, false otherwise.
 */
export function isRoleDemandSatisfied(room: Room): boolean {
    const demand = determineRoleDemand(room);
    const counts = countCreepsByRole(room);

    for (const role of allRoles) {
        if (counts[role] < (demand[role] || 0)) { // Use (demand[role] || 0) in case a role has no demand
            return false; // Found a role where current count is less than demand
        }
    }
    return true; // All demands are met
}

/**
 * Determines if energy sources in the room are adequately "covered" by miners or harvesters.
 * This is used to gate certain role demands (e.g., only spawn upgraders if sources are being worked).
 * - For each source:
 *   - If there's at least 1 Miner assigned to it, it's covered.
 *   - OR, if there are at least 2 Harvesters assigned to it, it's covered (Phase 1 style).
 *
 * @param {Room} room - The room to check.
 * @returns {boolean} True if all sources are considered filled, false otherwise.
 */
function sourcesAreFilled(room: Room): boolean {
    const sources = room.find(FIND_SOURCES);
    if (sources.length === 0) return true; // No sources, so vacuously true

    return sources.every(source => {
        // Helper to filter creeps by room and sourceId
        const creepsAssignedToSource = (role: Role) => Object.values(Game.creeps).filter(c =>
            c.room.name === room.name &&
            c.memory.role === role &&
            c.memory.sourceId === source.id
        ).length;

        const minersAtSource = creepsAssignedToSource(Role.Miner);
        if (minersAtSource >= 1) return true; // Covered by a miner

        const harvestersAtSource = creepsAssignedToSource(Role.Harvester);
        // In early phases, 2 harvesters per source might be the target before dedicated miners
        const harvestersNeededPerSource = (getRoomPhase(room) < 2.5) ? 2 : 0; // Example: 2 for phase < 2.5, 0 otherwise if miners take over
        if (harvestersNeededPerSource > 0 && harvestersAtSource >= harvestersNeededPerSource) return true;

        return false; // Source not adequately covered
    });
}


/**
 * Creates a new `RoleDemand` object with all role counts initialized to zero.
 * @returns {RoleDemand} A zeroed RoleDemand object.
 */
function zeroDemand(): RoleDemand {
    return allRoles.reduce((acc, role) => {
        acc[role] = 0;
        return acc;
    }, {} as RoleDemand); // Type assertion for initial empty object
}

/**
 * Determines the demand for each creep role in a given room.
 * This is the core logic for deciding how many creeps of each type are needed.
 * The demand is influenced by room phase, construction sites, energy sources,
 * resource levels, and any manual overrides.
 *
 * @param {Room} room - The room for which to determine role demand.
 * @returns {RoleDemand} An object specifying the number of creeps needed for each role.
 */
export function determineRoleDemand(room: Room): RoleDemand {
    const phase = getRoomPhase(room);
    const constructionSitesCount = room.find(FIND_CONSTRUCTION_SITES).length;
    const sources = room.find(FIND_SOURCES);
    const sourceCount = sources.length;

    // Ideal number of Harvesters in early game (Phase 1) is typically 2 per source.
    // This may be adjusted or replaced by Miners in later phases.
    const idealEarlyGameHarvesters = sourceCount * 2;

    const baseDemand = zeroDemand(); // Start with all demands at 0
    const currentCreepCounts = countCreepsByRole(room); // Get current counts for some decisions

    // Resource statistics for dynamic adjustments
    const stats = getRoomResourceStats(room);
    // const totalEnergyInRoom = stats.totalEnergy; // Not directly used in current logic, but available
    const energyInPiles = stats.energyInPiles;
    // const energyCurrentlyAvailableToSpawn = room.energyAvailable; // Not directly used in demand logic, but available

    let demand: RoleDemand;

    // --- Define demand based on room phase ---
    switch (phase) {
        case 1: // Early game, basic setup, focus on harvesters and maybe one upgrader
            demand = {
                ...baseDemand,
                [Role.Harvester]: idealEarlyGameHarvesters,
                [Role.Upgrader]: sourcesAreFilled(room) ? 1 : 0, // Only upgrade if sources are being harvested
            };
            break;

        case 2: // RCL2, introducing containers, extensions. Transitioning from Harvesters to Miner/Hauler pairs per source.
            const containers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER,
            }) as StructureContainer[];
            
            // Determine how many sources have a container nearby
            // This requires containerPositions to be reliably set in room.memory by constructionManager
            let sourcesWithContainers = 0;
            if (room.memory.containerPositions) {
                for (const source of sources) {
                    if (room.memory.containerPositions[source.id]) {
                        // Check if a container actually exists at the planned position
                        const pos = room.memory.containerPositions[source.id];
                        const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                        if (structuresAtPos.some(s => s.structureType === STRUCTURE_CONTAINER)) {
                            sourcesWithContainers++;
                        }
                    }
                }
            }

            const sourcesWithoutContainers = sourceCount - sourcesWithContainers;

            demand = {
                ...baseDemand,
                // Miners: One for each source that has an operational container.
                [Role.Miner]: sourcesWithContainers,
                // Haulers: Approximately one for each operational Miner/container pair,
                // plus potentially an extra one if there's a lot of loose energy.
                [Role.Hauler]: sourcesWithContainers > 0 ? Math.max(1, sourcesWithContainers) + (energyInPiles > 750 ? 1 : 0) : 0,
                // Harvesters: For sources that do NOT yet have a container.
                // Each such source might still need 1-2 harvesters.
                [Role.Harvester]: sourcesWithoutContainers * 2, // e.g., 2 harvesters per un-containered source
                
                [Role.Builder]: sourcesAreFilled(room) && constructionSitesCount > 0 ? Math.min(2, constructionSitesCount) : 0,
                [Role.Upgrader]: sourcesAreFilled(room) && constructionSitesCount === 0 && (sourcesWithContainers > 0 || room.energyAvailable > room.energyCapacityAvailable * 0.5) ? 1 : 0, // Upgrade if eco is somewhat stable
            };
            break;
        case 2.5: // RCL2, but all basic extensions and containers are likely built. Focus on upgrading, roads.
            demand = {
                ...baseDemand,
                [Role.Miner]: sourceCount,
                [Role.Hauler]: sourceCount + (energyInPiles > 1000 ? 1 : 0), // More haulers if lots of dropped energy
                [Role.Builder]: sourcesAreFilled(room) && constructionSitesCount > 0 ? Math.min(2, constructionSitesCount) : 0,
                 // More upgraders once core infrastructure is up.
                [Role.Upgrader]: sourcesAreFilled(room) && constructionSitesCount === 0 ? Math.min(3, Math.floor(room.controller!.level * 1.5)) : 0,
            };
            break;
        default: // Phase 3+ (RCL3 and beyond)
            demand = {
                ...baseDemand,
                [Role.Miner]: sourceCount,
                [Role.Hauler]: sourceCount + (energyInPiles > 1000 ? 1 : 0), // Haulers scale with sources, +1 for significant piles
                // Builders needed if there are construction sites, scaled by number of sites
                [Role.Builder]: sourcesAreFilled(room) && constructionSitesCount > 0 ? Math.min(3, Math.ceil(constructionSitesCount / 5)) : 0,
                // Upgraders: more if RCL is lower, fewer at higher RCLs or if energy is tight.
                // This is a placeholder; sophisticated upgrader count would consider controller link, energy surplus etc.
                [Role.Upgrader]: sourcesAreFilled(room) && constructionSitesCount === 0 ? Math.min(6, Math.max(1, 8 - room.controller!.level)) : 0,
            };
            break;
    }

    // --- Dynamic Adjustments ---
    // If there's a lot of energy in piles, consider adding a temporary hauler if demand isn't already high.
    if (energyInPiles > 1000 && demand[Role.Hauler] < sourceCount + 1) {
        demand[Role.Hauler] = (demand[Role.Hauler] || 0) + 1;
        demand[Role.Hauler] = Math.min(demand[Role.Hauler]!, sourceCount + 2); // Cap extra haulers for piles
    }

    // Reduce builder demand if room energy is very low and builders are present (to conserve energy)
    if (room.energyAvailable < room.energyCapacityAvailable * 0.3 && currentCreepCounts[Role.Builder] > 0 && constructionSitesCount > 0) {
        demand[Role.Builder] = Math.max(0, (demand[Role.Builder] || 0) -1 ); // Reduce by one, but not below 0
    }


    // Apply any manual overrides from room memory
    const overrides = room.memory.roleDemandOverrides || {};
    for (const role of allRoles) {
        if (overrides[role] !== undefined && overrides[role] !== null) { // Check for null as well
            demand[role] = overrides[role]!; // Non-null assertion because of the check
        }
    }

    return demand;
}

/**
 * Sets a manual override for the demand of a specific role in a room.
 * This override will be used by `determineRoleDemand` until cleared.
 *
 * @param {Room} room - The room to set the override for.
 * @param {Role} role - The role whose demand is to be overridden.
 * @param {number} amount - The desired number of creeps for this role.
 */
export function setRoleDemandOverride(
    room: Room,
    role: Role,
    amount: number
): void {
    if (!room.memory.roleDemandOverrides) {
        room.memory.roleDemandOverrides = {};
    }
    room.memory.roleDemandOverrides[role] = amount;
    console.log(`[${room.name}] 🔧 Set role demand override: ${role} -> ${amount}`);
}

/**
 * Clears a manual override for the demand of a specific role in a room.
 * The demand for this role will revert to being dynamically calculated.
 *
 * @param {Room} room - The room to clear the override for.
 * @param {Role} role - The role whose override is to be cleared.
 */
export function clearRoleDemandOverride(room: Room, role: Role): void {
    const overrides = room.memory.roleDemandOverrides;
    if (overrides && overrides[role] !== undefined && overrides[role] !== null) {
        delete overrides[role];
        console.log(`[${room.name}] 🗑️ Cleared role demand override for: ${role}`);
        // If no overrides left, delete the whole object to keep memory clean
        if (Object.keys(overrides).length === 0) {
            delete room.memory.roleDemandOverrides;
        }
    } else {
        console.log(`[${room.name}] Info: No override found for role ${role} to clear.`);
    }
}

/**
 * Clears all manual role demand overrides for a room.
 * All role demands will revert to being dynamically calculated.
 *
 * @param {Room} room - The room for which to clear all overrides.
 */
export function clearAllDemandOverrides(room: Room): void {
    if (room.memory.roleDemandOverrides) {
        delete room.memory.roleDemandOverrides;
        console.log(`[${room.name}] 🗑️ Cleared all role demand overrides.`);
    } else {
        console.log(`[${room.name}] Info: No overrides found to clear.`);
    }
}

// Expose control functions to the Game console for easier debugging/management
// Ensure 'Game' is augmented or cast to 'any' if these properties are not predefined in its type.
// This is common practice in Screeps for adding custom global commands.
if (typeof Game !== 'undefined') { // Check if Game object exists (it does in Screeps environment)
    (Game as any).setRoleDemandOverride = setRoleDemandOverride;
    (Game as any).clearRoleDemandOverride = clearRoleDemandOverride;
    (Game as any).clearAllDemandOverrides = clearAllDemandOverrides;
}
