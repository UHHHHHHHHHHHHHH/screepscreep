/**
 * @fileoverview Provides functions for determining creep body part compositions
 * based on role and the room's energy capacity. It uses configurations from
 * `roleConfigs.ts` to dynamically generate the "target" body for a creep.
 * This target body is then used by the spawn queue.
 * @module roles/roleBodies
 */

import { Role } from "../types/roles";
import { roleConfigs, RoleConfig } from "./roleConfigs"; // Assuming RoleConfig is exported from roleConfigs

/**
 * Calculates the energy cost of an array of body parts.
 * @param {BodyPartConstant[]} parts - The array of body parts.
 * @returns {number} The total energy cost of the body parts.
 */
export function calculateCost(parts: BodyPartConstant[]): number {
    if (!parts || parts.length === 0) return 0;
    return parts.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

/**
 * Determines the "target" body for a given role based on the room's total energy capacity.
 * This function decides the ideal composition of the creep if sufficient energy capacity is present,
 * or a fallback body if not. It does NOT consider the room's *current available energy* for spawning,
 * as that is handled by the spawn manager when deciding *if* it can spawn the queued request.
 *
 * The logic flow:
 * 1. Retrieves the `RoleConfig`. If none, returns a very basic body or empty if capacity is too low.
 * 2. If `roomEnergyCapacity` is below `config.minEnergyForRatio` (or the base unit cost is 0),
 *    it attempts to use `config.fallbackBody` if affordable with `roomEnergyCapacity`.
 * 3. If `config.dontRepeatBody` is true:
 *    - It tries to build the exact body specified by `config.ratio`.
 *    - This body is only formed if `roomEnergyCapacity` can afford its total cost.
 * 4. If `config.dontRepeatBody` is false:
 *    - The `config.ratio` is treated as a repeating unit.
 *    - It calculates how many full units can be built using the full `roomEnergyCapacity`.
 *    - It then tries to add more parts with any "leftover" capacity from the `roomEnergyCapacity`,
 *      respecting the 50-part limit.
 * 5. If, after the above steps, no `targetBody` is formed (e.g., capacity too low for even the main ratio),
 *    it re-evaluates using `config.fallbackBody` if it wasn't used already and is affordable.
 * 6. As an absolute last resort for critical roles (Harvester, Miner), if `targetBody` is still empty,
 *    it attempts to form a predefined minimal body if `roomEnergyCapacity` allows.
 * 7. The final body is sorted for consistency.
 *
 * @param {Role} role - The role for which to determine the body.
 * @param {number} roomEnergyCapacity - The `room.energyCapacityAvailable` for the room.
 * @returns {BodyPartConstant[]} The determined target body parts. Returns an empty array
 *                               if no suitable body (even minimal fallback) can be defined
 *                               for the given `roomEnergyCapacity`.
 */
export function getBodyForRole(role: Role, roomEnergyCapacity: number): BodyPartConstant[] {
    const cfg = roleConfigs[role];
    if (!cfg) {
        console.log(`ERROR: No RoleConfig found for role: ${role}.`);
        // Return a very basic body if no config, assuming minimal capacity
        const defaultMinimalBody = [WORK, CARRY, MOVE];
        return roomEnergyCapacity >= calculateCost(defaultMinimalBody) ? defaultMinimalBody : [];
    }

    // Create the "unit" of parts from the ratio for repeating, and its cost.
    // Also, preserve the order of parts as defined in the ratio for adding leftovers.
    const unitParts: BodyPartConstant[] = [];
    const ratioOrder: BodyPartConstant[] = []; // Defines priority for adding leftover parts
    for (const [part, count] of Object.entries(cfg.ratio) as [BodyPartConstant, number][]) {
        if (BODYPART_COST[part] === undefined) {
            console.log(`ERROR: Invalid body part '${part}' in ratio for role ${role}`);
            continue; // Skip invalid part
        }
        ratioOrder.push(part);
        for (let i = 0; i < count; i++) {
            unitParts.push(part);
        }
    }
    const unitCost = calculateCost(unitParts);

    let targetBody: BodyPartConstant[] = [];

    // Scenario 1: Room capacity is too low for the main ratio logic OR unitCost is invalid
    if (roomEnergyCapacity < cfg.minEnergyForRatio || unitCost === 0) {
        if (cfg.fallbackBody && cfg.fallbackBody.length > 0 && roomEnergyCapacity >= calculateCost(cfg.fallbackBody)) {
            targetBody = [...cfg.fallbackBody];
        }
        // If no suitable fallback, targetBody remains empty for now, will be handled by final minimal check
    }
    // Scenario 2: Room capacity IS sufficient for main ratio logic
    else {
        if (cfg.dontRepeatBody) {
            // For `dontRepeatBody`, 'unitParts' is the exact desired body.
            // It should be affordable if roomEnergyCapacity >= unitCost (which implies >= minEnergyForRatio here).
            if (roomEnergyCapacity >= unitCost && unitParts.length > 0 && unitParts.length <= 50) {
                targetBody = [...unitParts];
            }
        } else {
            // Handle repeatable body ratios, building up to roomEnergyCapacity
            if (unitParts.length > 0) { // Ensure unit is valid
                const numRepeatsPossibleWithCapacity = Math.floor(roomEnergyCapacity / unitCost);
                const maxTotalPartsFromUnits = unitParts.length > 0 ? Math.floor(50 / unitParts.length) : 0;
                const actualRepeats = Math.min(numRepeatsPossibleWithCapacity, maxTotalPartsFromUnits);

                if (actualRepeats > 0) {
                    for (let i = 0; i < actualRepeats; i++) {
                        targetBody.push(...unitParts);
                    }
                }

                // Try to use "leftover" room capacity to add more individual parts
                let currentBodyCost = calculateCost(targetBody);
                let remainingCapacityForAddons = roomEnergyCapacity - currentBodyCost;

                if (targetBody.length < 50 && remainingCapacityForAddons > 0) {
                    let addedMorePartsThisIteration: boolean;
                    do {
                        addedMorePartsThisIteration = false;
                        for (const part of ratioOrder) { // Add parts according to the defined ratio priorities
                            const partCost = BODYPART_COST[part];
                            if (remainingCapacityForAddons >= partCost && targetBody.length < 50) {
                                targetBody.push(part);
                                remainingCapacityForAddons -= partCost;
                                addedMorePartsThisIteration = true;
                            }
                            if (targetBody.length >= 50) break; // Stop if body is full
                        }
                    } while (addedMorePartsThisIteration && targetBody.length < 50 && remainingCapacityForAddons >= Math.min(...ratioOrder.map(p => BODYPART_COST[p])) ); // Continue if parts were added and can still afford cheapest part
                }
            }
        }
    }

    // Scenario 3: If after the main logic, targetBody is still empty, but a fallback exists and is affordable
    // This can happen if minEnergyForRatio was met, but other constraints (like 50-part limit for dontRepeatBody=false)
    // resulted in an empty body, or if dontRepeatBody body was too expensive for current capacity.
    if (targetBody.length === 0 && cfg.fallbackBody && cfg.fallbackBody.length > 0) {
        if (roomEnergyCapacity >= calculateCost(cfg.fallbackBody)) {
            targetBody = [...cfg.fallbackBody];
        }
    }

    // Scenario 4: Absolute minimal body for critical roles if still no body formed
    if (targetBody.length === 0) {
        let minimalBodyToTry: BodyPartConstant[] = [];
        if (role === Role.Harvester) {
            minimalBodyToTry = [WORK, CARRY, MOVE]; // Cost 200
        } else if (role === Role.Miner) {
            minimalBodyToTry = [WORK, WORK, MOVE]; // Cost 250
        }
        // Add other critical roles here if they need an absolute minimal fallback

        if (minimalBodyToTry.length > 0 && roomEnergyCapacity >= calculateCost(minimalBodyToTry)) {
            targetBody = minimalBodyToTry;
        }
    }

    // Sort the final body for consistency (optional but good practice).
    if (targetBody.length > 0) {
        const partSortOrder: Record<BodyPartConstant, number> = {
            [TOUGH]: 1, [WORK]: 2, [ATTACK]: 3, [RANGED_ATTACK]: 4,
            [CARRY]: 5, [MOVE]: 6, [HEAL]: 7, [CLAIM]: 8
        };
        targetBody.sort((a, b) => (partSortOrder[a] || 99) - (partSortOrder[b] || 99));
    }

    return targetBody;
}

/**
 * Generates a concise string signature for a creep body.
 * Example: [WORK, WORK, CARRY, MOVE] becomes "2w1c1m".
 * This is useful for naming creeps or for logging purposes to quickly identify a creep's build.
 *
 * @param {BodyPartConstant[]} body - The array of body parts.
 * @returns {string} A string signature of the body (e.g., "2w1c1m").
 *                   Returns "empty" if the body is empty or undefined.
 */
export function getBodySignature(body: BodyPartConstant[]): string {
    if (!body || body.length === 0) {
        return "empty";
    }

    const counts: Partial<Record<BodyPartConstant, number>> = {};
    for (const part of body) {
        counts[part] = (counts[part] || 0) + 1;
    }

    // Define a consistent order for parts in the signature
    const signaturePartOrder: BodyPartConstant[] = [
        TOUGH, WORK, CARRY, MOVE, ATTACK, RANGED_ATTACK, HEAL, CLAIM
    ];

    return signaturePartOrder
        .filter(part => counts[part] && counts[part]! > 0) // Only include parts present in the body
        .map(part => `${counts[part]}${part[0]}`) // Use first letter of part type (e.g., 'w' for WORK)
        .join('');
}
