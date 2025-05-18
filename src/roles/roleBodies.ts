/**
 * @fileoverview Provides functions for determining creep body part compositions
 * based on role and available energy. It uses configurations from `roleConfigs.ts`
 * to dynamically generate creep bodies.
 * @module roles/roleBodies
 */

import { Role } from "../types/roles";
import { roleConfigs } from "./roleConfigs"; // Import RoleConfig for type clarity

// Helper function to calculate the cost of a body or a unit of parts
function calculateCost(parts: BodyPartConstant[]): number {
    return parts.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

/**
 * Generates a creep body array based on the specified role, available energy,
 * and configurations in `roleConfigs.ts`.
 *
 * The process is as follows:
 * 1. Retrieve the `RoleConfig` for the given role.
 * 2. If `energy` is less than `config.minEnergyForRatio` OR if the base `ratio` unit is too expensive
 *    (or costs 0), the `config.fallbackBody` is used. If no `fallbackBody` is defined, a
 *    minimal [WORK, CARRY, MOVE] body is returned, or an empty array if that's also too expensive.
 * 3. If `config.dontRepeatBody` is true:
 *    The function attempts to build the exact body defined by `config.ratio`.
 *    `config.minEnergyForRatio` should ideally be the cost of this exact body.
 *    No parts beyond those in the `ratio` should be added.
 *    *Current Observation: Logic for strictly adhering to `dontRepeatBody` and not adding
 *    extra parts might need review.*
 * 4. If `config.dontRepeatBody` is false (or undefined):
 *    a. The `config.ratio` is treated as a repeating unit.
 *    b. Calculate how many full units can be afforded with the available `energy`.
 *    c. Construct the body with these full units, ensuring the total part count does not exceed 50.
 *    d. Attempt to use any leftover energy to add more individual parts, prioritizing
 *       them according to the order they appear in the `ratio` definition, again
 *       respecting the 50-part limit.
 * 5. The final body array is typically sorted for consistency (e.g., TOUGH, WORK, MOVE, CARRY).
 *
 * @param {Role} role - The role for which to generate the body.
 * @param {number} energy - The total energy available in the room for spawning.
 * @returns {BodyPartConstant[]} An array of body parts for the creep. Can be empty if
 *                               no valid body can be formed with the given energy.
 */
export function getBodyForRole(role: Role, energy: number): BodyPartConstant[] {
    const cfg = roleConfigs[role];
    if (!cfg) {
        // Ultimate fallback if a role is not configured
        console.log(`ERROR: No RoleConfig found for role: ${role}. Using default [W,C,M].`);
        const defaultBody = [WORK, CARRY, MOVE];
        return energy >= calculateCost(defaultBody) ? defaultBody : [];
    }

    // Step 1: Create the "unit" of parts from the ratio for repeating, and its cost.
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

    // Step 2: Handle fallback scenarios
    // If energy is too low for the ratio-based body, or if the unit itself is free/invalid.
    if (energy < cfg.minEnergyForRatio || unitCost === 0) {
        const fallback = cfg.fallbackBody || [];
        if (fallback.length > 0 && energy >= calculateCost(fallback)) {
            return fallback; // Use defined fallback if affordable
        }
        // If no fallback or fallback is too expensive, try a minimal body
        let minimalBody = [WORK, CARRY, MOVE];
        if (role === Role.Miner) minimalBody = [WORK, MOVE]; // Miner specific minimal

        if (energy >= calculateCost(minimalBody)) {
            return minimalBody;
        }
        return []; // Cannot afford even a minimal body
    }

    let body: BodyPartConstant[] = [];

    // Step 3: Handle `dontRepeatBody` (fixed body definition)
    if (cfg.dontRepeatBody) {
        // The 'unitParts' here represents the complete, exact body.
        // No repetition, no adding extra parts with leftover energy.
        if (energy >= unitCost && unitParts.length <= 50) {
            body = [...unitParts]; // Build the exact body defined by the ratio
        }
        // If energy is less than unitCost, it should have been caught by minEnergyForRatio check,
        // but as a safeguard, an empty body will be returned if not affordable.
    } else {
        // Step 4: Handle repeatable body ratios
        // Calculate how many full "units" can be afforded.
        const numRepeats = Math.floor(energy / unitCost);
        // Ensure total parts do not exceed 50.
        const maxPossibleUnits = unitParts.length > 0 ? Math.floor(50 / unitParts.length) : 0;
        const actualRepeats = Math.min(numRepeats, maxPossibleUnits);

        for (let i = 0; i < actualRepeats; i++) {
            body.push(...unitParts);
        }

        // Try to use leftover energy to add more individual parts, following ratioOrder.
        let leftoverEnergy = energy - (actualRepeats * unitCost);
        if (body.length < 50) { // Only add if there's room in the body
            let addedMorePartsThisIteration: boolean;
            do {
                addedMorePartsThisIteration = false;
                for (const part of ratioOrder) {
                    const partCost = BODYPART_COST[part];
                    if (leftoverEnergy >= partCost && body.length < 50) {
                        body.push(part);
                        leftoverEnergy -= partCost;
                        addedMorePartsThisIteration = true;
                    }
                    if (body.length >= 50) break; // Stop if body is full
                }
            } while (addedMorePartsThisIteration && body.length < 50);
        }
    }

    // Step 5: Sort the final body for consistency (optional but good practice).
    // Common Screeps sort order: TOUGH, defensive, WORK, CARRY, MOVE, offensive, CLAIM, HEAL.
    // Simplified sort for common parts:
    const partSortOrder: Record<BodyPartConstant, number> = {
        [TOUGH]: 1, [WORK]: 2, [ATTACK]: 3, [RANGED_ATTACK]: 4,
        [CARRY]: 5, [MOVE]: 6, [HEAL]: 7, [CLAIM]: 8
    };
    body.sort((a, b) => (partSortOrder[a] || 99) - (partSortOrder[b] || 99));

    // Final check: if body is empty but fallback exists and is affordable, use fallback.
    // This can happen if minEnergyForRatio was met, but due to 50-part limit or other constraints,
    // the ratio-based body ended up empty.
    if (body.length === 0 && cfg.fallbackBody && energy >= calculateCost(cfg.fallbackBody)) {
        return cfg.fallbackBody;
    }

    return body;
}

/**
 * Generates a concise string signature for a creep body.
 * Example: [WORK, WORK, CARRY, MOVE] becomes "2w1c1m".
 * This is useful for naming creeps or for logging purposes to quickly identify a creep's build.
 *
 * @param {BodyPartConstant[]} body - The array of body parts.
 * @returns {string} A string signature of the body (e.g., "2w1c1m").
 *                   Returns an empty string if the body is empty.
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
