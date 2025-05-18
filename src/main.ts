/**
 * @fileoverview Main game loop entry point for the Screeps AI.
 * Orchestrates memory cleaning, spawning, room-level tasks (like construction),
 * and creep role execution for each tick. It also initializes role modules
 * for dynamic dispatch of creep actions.
 * @module main
 */

import { Role } from './types/roles';
import { BaseRole } from './roles/base';
import { cleanCreepMemory } from './managers/memoryManager';
import { manageSpawns } from './managers/spawnManager';
import { manageConstruction } from './managers/constructionManager';
import { UpgraderRole } from './roles/upgrader';
import { BuilderRole } from './roles/builder';
import { HarvesterRole } from './roles/harvester';
// import { manageRoles } from './managers/roleManager'; // Assuming this might be re-introduced or is legacy
import { MinerRole } from './roles/miner';
import { HaulerRole } from './roles/hauler';
import { profile } from './utils/profiler';
import { logRoomEnergyStats } from './managers/resourceManager';

/**
 * A record mapping `Role` enum values to their corresponding `BaseRole` instances.
 * This allows for dynamic dispatch of creep logic based on `creep.memory.role`.
 * @type {Record<Role, BaseRole>}
 */
const roleModules: Record<Role, BaseRole> = {
    harvester: new HarvesterRole(),
    builder: new BuilderRole(),
    upgrader: new UpgraderRole(),
    miner: new MinerRole(),
    hauler: new HaulerRole(),
};

/**
 * The main game loop function, executed by the Screeps game engine every tick.
 * This function orchestrates all AI actions for the current tick.
 *
 * The loop performs the following major operations:
 * 1. Cleans stale creep memory.
 * 2. Manages creep spawning for the first available spawn.
 * 3. Iterates through rooms to manage construction and log energy stats.
 * 4. Iterates through creeps to execute their assigned role logic.
 *
 * @export
 */
export const loop = profile("main loop", function () {
    // const start = Game.cpu.getUsed(); // For manual CPU profiling

    // 1. Memory Management
    cleanCreepMemory();

    // 2. Spawning Management (currently for the first spawn found)
    // TODO: Potentially iterate all spawns or use a more sophisticated spawn selection.
    const spawn = Object.values(Game.spawns)[0];
    if (spawn) {
        manageSpawns(spawn);
    }

    // 3. Room-level Operations
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        manageConstruction(room);

        // Periodically log room energy statistics (e.g., every 10 ticks)
        if (Game.time % 10 === 0) {
            logRoomEnergyStats(room);
        }
    }

    // 4. Creep Role Execution
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (!creep.spawning) { // Ensure creep is fully spawned before trying to run logic
            const role = creep.memory.role;
            if (role && roleModules[role]) {
                roleModules[role].run(creep);
            } else {
                console.log(`Creep ${creep.name} has an unknown or undefined role: ${role}`);
                // Optionally, assign a default role or park the creep
            }
        }
    }

    // const end = Game.cpu.getUsed();
    // console.log(`⏱️ Tick CPU: ${(end - start).toFixed(2)}`); // For manual CPU profiling
});
