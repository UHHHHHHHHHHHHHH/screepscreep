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
        if (counts[role] < (demand[role] || 0)) { // Use (demand[role] || 0) in case a role has no demand defined
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
function sourcesAreFilled(room: Room): boolean {
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
 * Determines the demand for each creep role in a given room.
 * This is the core logic for deciding how many creeps of each type are needed.
 * The demand is influenced by room phase, construction sites, energy sources,
 * resource levels, and any manual overrides.
 * It includes an emergency harvester demand if no energy income is detected and energy is critically low.
 *
 * @param {Room} room - The room for which to determine role demand.
 * @returns {RoleDemand} An object specifying the number of creeps needed for each role.
 */
export function determineRoleDemand(room: Room): RoleDemand {
    const phase = getRoomPhase(room);
    const currentCreepCounts = countCreepsByRole(room);
    const constructionSitesCount = room.find(FIND_CONSTRUCTION_SITES).length;
    const sources = room.find(FIND_SOURCES);
    const sourceCount = sources.length;

    const baseDemand = zeroDemand(); // Start with all demands at 0
    const stats = getRoomResourceStats(room); // For energyInPiles, etc.

    // --- EMERGENCY Condition: No energy income and critically low available energy ---
    // This overrides ALL other demand logic to prevent a complete stall.
    // It demands a single, basic Harvester to try and kickstart the economy.
    const hasMiners = (currentCreepCounts[Role.Miner] || 0) > 0;
    const hasHarvesters = (currentCreepCounts[Role.Harvester] || 0) > 0;
    // Critically low energy: less than what a basic Harvester (WCM = 200) costs.
    const isEnergyCriticallyLow = room.energyAvailable < (BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE]);

    if (sourceCount > 0 && !hasMiners && !hasHarvesters && isEnergyCriticallyLow) {
        console.log(`[${room.name}] EMERGENCY: No income generation and critically low energy (${room.energyAvailable}). Demanding 1 Harvester.`);
        return {
            ...baseDemand, // Ensure all other roles are 0
            [Role.Harvester]: 1 // Demand exactly one emergency harvester
        };
    }
    // --- End of Emergency Condition ---

    let demand: RoleDemand; // To be populated by phase-specific logic

    // Ideal number of Harvesters in early game (Phase 1) is typically 2 per source.
    const idealEarlyGameHarvesters = sourceCount * 2;

    // --- Define demand based on room phase ---
    switch (phase) {
        case 1: // Early game: Harvesters for income, one Upgrader if income is stable.
            demand = {
                ...baseDemand,
                [Role.Harvester]: idealEarlyGameHarvesters,
                [Role.Upgrader]: sourcesAreFilled(room) ? 1 : 0,
            };
            break;

        case 2: // RCL2: Transition to container mining.
                // Miners for sources with containers, Harvesters for those without.
                // Haulers to move energy from containers. Builders for construction.
            // const containers = room.find(FIND_STRUCTURES, { // This was used to get total count, not per source
            //     filter: s => s.structureType === STRUCTURE_CONTAINER,
            // }) as StructureContainer[];

            let sourcesWithContainers = 0;
            if (room.memory.containerPositions) {
                for (const source of sources) {
                    if (room.memory.containerPositions[source.id]) {
                        const pos = room.memory.containerPositions[source.id];
                        // Verify a container actually exists at the remembered position
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
                [Role.Miner]: sourcesWithContainers, // One miner per source that has an operational container.
                // One hauler per active miner/container. Add an extra if significant energy piles exist.
                [Role.Hauler]: sourcesWithContainers > 0 ? Math.max(1, sourcesWithContainers) + (stats.energyInPiles > 750 ? 1 : 0) : 0,
                // Harvesters for sources that do NOT yet have a container (e.g., 2 per such source).
                [Role.Harvester]: sourcesWithoutContainers * 2,
                // Builders if sources are being worked and there are construction sites.
                [Role.Builder]: sourcesAreFilled(room) && constructionSitesCount > 0 ? Math.min(2, constructionSitesCount) : 0,
                // Upgrader if economy is somewhat stable (container mining started or good energy reserves) and no building.
                [Role.Upgrader]: sourcesAreFilled(room) && constructionSitesCount === 0 &&
                                (sourcesWithContainers > 0 || room.energyAvailable > room.energyCapacityAvailable * 0.5) ? 1 : 0,
            };
            break;

        case 2.5: // RCL2, post-basic infrastructure: Focus on Miners, Haulers, Upgraders, and Builders for roads/etc.
            demand = {
                ...baseDemand,
                [Role.Miner]: sourceCount,
                [Role.Hauler]: sourceCount + (stats.energyInPiles > 1000 ? 1 : 0), // More haulers if lots of dropped energy
                [Role.Builder]: sourcesAreFilled(room) && constructionSitesCount > 0 ? Math.min(2, constructionSitesCount) : 0,
                // More upgraders once core infrastructure is up and sources are filled.
                [Role.Upgrader]: sourcesAreFilled(room) && constructionSitesCount === 0 ? Math.min(3, Math.floor(room.controller!.level * 1.5)) : 0,
            };
            break;

        default: // Phase 3+ (RCL3 and beyond): Mature room operations.
            demand = {
                ...baseDemand,
                [Role.Miner]: sourceCount,
                [Role.Hauler]: sourceCount + (stats.energyInPiles > 1000 ? 1 : 0),
                // Builders needed if there are construction sites, scaled by number of sites (e.g., 1 builder per 5 sites).
                [Role.Builder]: sourcesAreFilled(room) && constructionSitesCount > 0 ? Math.min(3, Math.ceil(constructionSitesCount / 5)) : 0,
                // Upgraders: Number can be dynamic. Example: fewer at very high RCLs, more if controller needs leveling.
                // This is a placeholder; sophisticated upgrader count would consider controller link, energy surplus etc.
                [Role.Upgrader]: sourcesAreFilled(room) && constructionSitesCount === 0 ? Math.min(6, Math.max(1, 8 - room.controller!.level)) : 0,
            };
            break;
    }

    // --- Dynamic Adjustments (applied after phase-based demand) ---
    // Example: If there's a lot of energy in piles, consider adding a temporary hauler
    // if demand isn't already high from other logic.
    if (stats.energyInPiles > 1000 && demand[Role.Hauler] < sourceCount + 1) { // Check if hauler demand is already accounting for piles
        demand[Role.Hauler] = (demand[Role.Hauler] || 0) + 1;
        demand[Role.Hauler] = Math.min(demand[Role.Hauler]!, sourceCount + 2); // Cap extra haulers for piles to avoid over-spawning
    }

    // Example: Reduce builder demand if room energy is very low and builders are present, to conserve energy.
    // This prevents builders from draining energy needed for income generation if economy is struggling.
    if (room.energyAvailable < room.energyCapacityAvailable * 0.3 &&
        (currentCreepCounts[Role.Builder] || 0) > 0 &&
        constructionSitesCount > 0 &&
        demand[Role.Builder] > 0) { // Only reduce if there's a demand for builders already
        demand[Role.Builder] = Math.max(0, (demand[Role.Builder] || 1) -1 ); // Reduce by one, but not below 0. Ensure it's at least 1 before reducing.
    }


    // Apply any manual overrides from room memory. These take final precedence.
    const overrides = room.memory.roleDemandOverrides || {};
    for (const role of allRoles) {
        if (overrides[role] !== undefined && overrides[role] !== null) { // Check for null as well as undefined
            demand[role] = overrides[role]!; // Non-null assertion due to the check
        }
    }

    return demand;
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
