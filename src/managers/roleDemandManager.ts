/**
 * @fileoverview Manages the determination of creep role demands for a room.
 * It calculates the desired number of creeps for each role based on room phase,
 * available structures, energy levels, construction sites, and current creep counts.
 * It includes an emergency override to demand basic Harvesters if the economy collapses.
 * Allows for manual overrides of these demands via console commands.
 * @module managers/roleDemandManager
 */

import { Role } from "../types/roles";
import { getRoomPhase } from "./roomManager";
import { countCreepsByRole } from "./creepManager";
import { getRoomResourceStats } from "./resourceManager";
import { RoleDemandMap, RoleDemandEntry } from "../types/memory";

/**
 * @typedef {Record<Role, number>} RoleDemand
 * @description A record mapping each `Role` to the number of creeps desired for that role.
 */
export type RoleDemand = Record<Role, number>;

// Get all Role enum string values as an array for iteration
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
        if (counts[role] < (demand[role]?.count || 0)) { // Use (demand[role] || 0) in case a role has no demand defined
            return false; // Found a role where current count is less than demand
        }
    }
    return true; // All demands are met
}

/**
 * Determines if energy sources in the room are adequately "covered" by income-generating creeps.
 * This is used as a condition for spawning non-essential roles like Upgraders or Builders.
 * A source is considered covered if:
 *   - It has at least one Miner assigned to it.
 *   - OR, especially in early phases (e.g., phase < 2.5), it has a sufficient number of Harvesters
 *     (e.g., 2 Harvesters per source before dedicated miners take over).
 *
 * @param {Room} room - The room to check.
 * @returns {boolean} True if all sources are considered "filled" (i.e., being worked), false otherwise.
 */
function sourcesAreFilledCheck(room: Room): boolean {
    const sources = room.find(FIND_SOURCES);
    if (sources.length === 0) {
        // If there are no sources, the condition of "all sources being filled" is vacuously true.
        // This might allow upgraders/builders if other conditions are met, which could be desired
        // in rooms without sources (e.g., a room used only for controller upgrading fed by links).
        return true;
    }

    return sources.every(source => {
        // Helper to count creeps of a specific role assigned to this particular source
        const creepsAssignedToThisSource = (role: Role) =>
            Object.values(Game.creeps).filter(c =>
                c.room.name === room.name &&
                c.memory.role === role &&
                c.memory.sourceId === source.id
            ).length;

        // Check for Miners at this source
        if (creepsAssignedToThisSource(Role.Miner) >= 1) {
            return true; // Covered by a miner
        }

        // Check for Harvesters if Miners aren't present (more relevant for early phases)
        const phase = getRoomPhase(room);
        // In phases before dedicated container mining (e.g. < 2.5), expect harvesters.
        // Adjust '2' if your harvester strategy per source differs in early game.
        const harvestersNeededAtSourceForFilling = (phase < 2.5) ? 2 : 0;

        if (harvestersNeededAtSourceForFilling > 0 && creepsAssignedToThisSource(Role.Harvester) >= harvestersNeededAtSourceForFilling) {
            return true; // Covered by sufficient harvesters for this phase
        }

        return false; // Source is not adequately covered by either miners or required harvesters
    });
}


/**
 * Creates a new `RoleDemand` object with all role counts initialized to zero.
 * This serves as a base for building up the actual demand.
 * @returns {RoleDemand} A zeroed RoleDemand object.
 */
function zeroDemand(): RoleDemand {
    return allRoles.reduce((acc, role) => {
        acc[role] = 0;
        return acc;
    }, {} as RoleDemand); // Type assertion for initial empty object
}


/**
 * Determines the detailed role demands for a room, including counts, and potential
 * constraints like maxCost or emergency status for specific roles.
 *
 * @param {Room} room - The room for which to determine role demand.
 * @returns {RoleDemandMap} An object mapping roles to their detailed demand entries.
 */
export function determineRoleDemand(room: Room): RoleDemandMap {
    const phase = getRoomPhase(room);
    const currentCreepCounts = countCreepsByRole(room);
    const constructionSitesCount = room.find(FIND_CONSTRUCTION_SITES).length;
    const sources = room.find(FIND_SOURCES);
    const sourceCount = sources.length;
    const stats = getRoomResourceStats(room);
    const currentRoomEnergy = room.energyAvailable;

    const demandMap: RoleDemandMap = {};

    // Helper to add/update demand entry
    function setDemand(role: Role, count: number, options?: Omit<RoleDemandEntry, 'count'>) {
        if (count > 0) {
            demandMap[role] = { count, ...options };
        } else if (demandMap[role]) {
            delete demandMap[role]; // Remove if count is 0
        }
    }

    // --- EMERGENCY Condition ---
    const hasMiners = (currentCreepCounts[Role.Miner] || 0) > 0;
    const hasHarvesters = (currentCreepCounts[Role.Harvester] || 0) > 0;
    const isEnergyCriticallyLow = currentRoomEnergy < (5 * BODYPART_COST[WORK] + BODYPART_COST[MOVE] + 50); // ~600

    if (sourceCount > 0 && !hasMiners && !hasHarvesters && isEnergyCriticallyLow) {
        console.log(`[${room.name}] EMERGENCY: No income, low energy (${currentRoomEnergy}). Demanding 1 cheap Harvester.`);
        // Set all other demands to 0 implicitly by only defining this one
        setDemand(Role.Harvester, 1, {
            isEmergency: true,
            maxCost: Math.max(300, currentRoomEnergy), // Ensure at least 300, use current energy
            priority: 0 // Highest priority
        });
        return demandMap; // Return immediately with only emergency demand
    }

    // --- Standard Phase-based Demands (assign priorities) ---
    const idealEarlyGameHarvesters = sourceCount * 2;

        // --- Define base priorities (lower is higher) ---
    let minerPriority = 5;
    let haulerPriority = 7;
    const harvesterPriority = 10;
    const builderPriority = 30;
    const upgraderPriority = 50;

        // --- Dynamically adjust Miner/Hauler priorities ---
    const currentMiners = currentCreepCounts[Role.Miner] || 0;
    const currentHaulers = currentCreepCounts[Role.Hauler] || 0;

    if (sourceCount > 0) { // Only adjust if there are sources to mine
        if (currentMiners > currentHaulers) {
            // More miners than haulers, prioritize haulers to catch up
            haulerPriority = 4; // Make hauler higher priority than default miner
            minerPriority = 6;  // Slightly deprioritize new miners
            if (Game.time % 20 === 1) console.log(`[${room.name}] Prioritizing Haulers (M:${currentMiners} > H:${currentHaulers})`);
        } else if (currentHaulers > currentMiners) {
            // More haulers than miners, but we still need more miners.
            // Keep miner priority high if we are below desired miner count.
            minerPriority = 4;
            haulerPriority = 6;
            if (Game.time % 20 === 2) console.log(`[${room.name}] Prioritizing Miners (H:${currentHaulers} > M:${currentMiners}, but need M)`);
        }
        // If counts are equal, or if we need both, their default relative priorities (miner slightly higher) will apply.
    }

    switch (phase) {
        case 1:
            setDemand(Role.Harvester, idealEarlyGameHarvesters, { priority: 10 });
            if (sourcesAreFilledCheck(room)) {
                setDemand(Role.Upgrader, 2, { priority: 50 });
            }
            break;
        case 2: // RCL2, introducing containers, extensions.
            let sourcesWithContainers = 0;
            // ... (logic to count sourcesWithContainers as before)
             if (room.memory.containerPositions) {
                for (const source of sources) {
                    if (room.memory.containerPositions[source.id]) {
                        const pos = room.memory.containerPositions[source.id];
                        const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                        if (structuresAtPos.some(s => s.structureType === STRUCTURE_CONTAINER)) {
                            sourcesWithContainers++;
                        }
                    }
                }
            }
            const sourcesWithoutContainers = sourceCount - sourcesWithContainers;

            setDemand(Role.Miner, sourcesWithContainers, { priority: 5 });
            setDemand(Role.Hauler, sourcesWithContainers > 0 ? Math.max(1, sourcesWithContainers) + (stats.energyInPiles > 750 ? 1 : 0) : 0, { priority: 7 });
            setDemand(Role.Harvester, sourcesWithoutContainers * 2, { priority: 10 });
            if (sourcesAreFilledCheck(room) && constructionSitesCount > 0) {
                setDemand(Role.Builder, Math.min(2, constructionSitesCount), { priority: 30 });
            }
            if (sourcesAreFilledCheck(room) && constructionSitesCount === 0 && (sourcesWithContainers > 0 || currentRoomEnergy > room.energyCapacityAvailable * 0.5)) {
                setDemand(Role.Upgrader, 1, { priority: 50 });
            }
            break;
        case 2.5:
            setDemand(Role.Miner, sourceCount, { priority: minerPriority });
            setDemand(Role.Hauler, sourceCount + (stats.energyInPiles > 1000 ? 1 : 0), { priority: haulerPriority });
            if (sourcesAreFilledCheck(room) && constructionSitesCount > 0) {
                setDemand(Role.Builder, Math.min(2, constructionSitesCount), { priority: builderPriority });
            }
            if (sourcesAreFilledCheck(room) && constructionSitesCount === 0) {
                setDemand(Role.Upgrader, Math.min(3, Math.floor(room.controller!.level * 1.5)), { priority: upgraderPriority });
            }
            break;
        default: // Phase 3+
            setDemand(Role.Miner, sourceCount, { priority: minerPriority });
            setDemand(Role.Hauler, sourceCount + (stats.energyInPiles > 10000 ? 1 : 0), { priority: haulerPriority });
            if (sourcesAreFilledCheck(room) && constructionSitesCount > 0) {
                setDemand(Role.Builder, Math.min(3, Math.ceil(constructionSitesCount / 5)), { priority: builderPriority });
            }
            if (sourcesAreFilledCheck(room)) {
                setDemand(Role.Upgrader, Math.min(6, Math.max(1, 8 - room.controller!.level)), { priority: upgraderPriority });
            }
            break;
    }

    // --- Dynamic Adjustments (Example: reduce builder if energy low) ---
    const builderDemandEntry = demandMap[Role.Builder];
    if (builderDemandEntry && currentRoomEnergy < room.energyCapacityAvailable * 0.3 && (currentCreepCounts[Role.Builder] || 0) > 0) {
        if (builderDemandEntry.count > 0) {
            setDemand(Role.Builder, Math.max(0, builderDemandEntry.count -1), { priority: builderDemandEntry.priority });
        }
    }

    // Apply console overrides (simple count overrides for now)
    const overrides = room.memory.roleDemandOverrides || {};
    for (const r of Object.keys(overrides) as Role[]) {
        const overrideCount = overrides[r];
        if (overrideCount !== undefined && overrideCount !== null) {
            if (overrideCount > 0) {
                // Preserve existing priority/maxCost if role was already in demandMap,
                // otherwise use a default priority.
                const existingEntry = demandMap[r];
                setDemand(r, overrideCount, {
                    priority: existingEntry?.priority || 99, // Keep existing or use low priority
                    maxCost: existingEntry?.maxCost,
                    isEmergency: existingEntry?.isEmergency
                });
            } else {
                delete demandMap[r]; // Override to 0 means remove demand
            }
        }
    }
    return demandMap;
}


/**
 * Sets a manual override for the demand of a specific role in a room.
 * This override will be used by `determineRoleDemand` until cleared.
 * Useful for temporarily adjusting creep populations via the game console.
 *
 * @param {Room} room - The room to set the override for.
 * @param {Role} role - The role whose demand is to be overridden.
 * @param {number} amount - The desired number of creeps for this role. Set to -1 or null to clear.
 */
export function setRoleDemandOverride(
    room: Room,
    role: Role,
    amount: number | null // Allow null to signify clearing
): void {
    if (!room.memory.roleDemandOverrides) {
        room.memory.roleDemandOverrides = {};
    }
    if (amount === null || amount < 0) { // Clearing specific override
        if (room.memory.roleDemandOverrides[role] !== undefined) {
            delete room.memory.roleDemandOverrides[role];
            console.log(`[${room.name}] 🗑️ Cleared role demand override for: ${role}`);
            if (Object.keys(room.memory.roleDemandOverrides).length === 0) {
                delete room.memory.roleDemandOverrides; // Clean up memory if empty
            }
        } else {
            console.log(`[${room.name}] Info: No override found for role ${role} to clear.`);
        }
    } else {
        room.memory.roleDemandOverrides[role] = amount;
        console.log(`[${room.name}] 🔧 Set role demand override: ${role} -> ${amount}`);
    }
}

/**
 * Clears a manual override for the demand of a specific role in a room.
 * The demand for this role will revert to being dynamically calculated.
 *
 * @param {Room} room - The room to clear the override for.
 * @param {Role} role - The role whose override is to be cleared.
 */
export function clearRoleDemandOverride(room: Room, role: Role): void {
    setRoleDemandOverride(room, role, null); // Utilize the setter with null to clear
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

// Expose control functions to the Game console for easier debugging/management.
// This allows `Game.setRoleDemandOverride(Game.rooms['W1N1'], Role.Miner, 2)` from console.
if (typeof Game !== 'undefined') { // Check if Game object exists (it does in Screeps environment)
    (Game as any).setRoleDemandOverride = setRoleDemandOverride;
    (Game as any).clearRoleDemandOverride = clearRoleDemandOverride;
    (Game as any).clearAllDemandOverrides = clearAllDemandOverrides;
}
