/**
 * @fileoverview Manages general creep-related utility functions, primarily focused
 * on counting creeps based on their assigned roles within a specific room.
 * This information is vital for other managers like `roleDemandManager` to
 * determine spawning needs.
 * @module managers/creepManager
 */

import { Role } from "../types/roles"; // Import the Role enum for type safety

/**
 * Counts the number of living creeps for each role within a specified room.
 * It iterates through all `Game.creeps`, filters them by the given room,
 * and then aggregates them by the `role` property in their memory.
 *
 * @param {Room} room - The room for which to count creeps. Creeps not in this room are ignored.
 * @returns {Record<Role, number>} A record where keys are `Role` enum values
 *                                 and values are the count of creeps with that role
 *                                 in the specified room. All roles defined in the `Role`
 *                                 enum will be present as keys, initialized to 0 if no
 *                                 creeps of that role exist.
 */
export function countCreepsByRole(room: Room): Record<Role, number> {
    // Initialize counts for all defined roles to zero.
    // This ensures that the returned record always contains all roles,
    // even if some roles have zero creeps.
    const counts = {} as Record<Role, number>;
    for (const roleValue of Object.values(Role)) {
        counts[roleValue as Role] = 0;
    }
    // Alternative initialization (if you prefer the explicit list):
    // const counts: Record<Role, number> = {
    //     [Role.Harvester]: 0,
    //     [Role.Upgrader]: 0,
    //     [Role.Builder]: 0,
    //     [Role.Miner]: 0,
    //     [Role.Hauler]: 0,
    //     // Add any new roles here if you use this explicit method
    // };

    // Iterate over all creeps currently in the game.
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];

        // Filter out creeps not in the target room or creeps that are still spawning.
        // Spawning creeps might not have their roles fully effective yet or might not be in the room.
        if (creep.room.name !== room.name || creep.spawning) {
            continue;
        }

        const creepRole = creep.memory.role as Role;

        // Check if the role from creep memory is a valid, known role.
        // This guards against errors if creep memory is corrupted or contains an outdated role.
        if (counts[creepRole] !== undefined) {
            counts[creepRole]++;
        } else {
            // Optional: Log a warning if a creep has an unrecognized role.
            // This can help identify issues with role assignment or stale memory.
            if (Game.time % 100 === 0) { // Log periodically to avoid spam
                console.log(`Warning: Creep ${creep.name} in room ${room.name} has an unknown role: '${creep.memory.role}'`);
            }
        }
    }

    return counts;
}
