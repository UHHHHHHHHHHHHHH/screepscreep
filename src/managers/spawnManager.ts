/**
 * @fileoverview Manages the creep spawning process for each room.
 * It refreshes a spawn queue based on role demand, selects the next creep
 * to spawn, determines its body and name, and initiates the spawning process.
 * It also handles assigning specific targets like sources or containers to creeps
 * upon spawning.
 * @module managers/spawnManager
 */

import { Role } from "../types/roles";
import { determineRoleDemand } from "./roleDemandManager";
import { getBodyForRole, getBodySignature } from "../roles/roleBodies";
// import { getRoomPhase } from "./roomManager"; // Not directly used in this file, but influences demand
import { countCreepsByRole } from "./creepManager";

/**
 * Finds an available source in the room for a creep of a given role.
 * A source is considered "available" if the number of creeps already assigned
 * to it (for that specific role) is less than `maxPerSource`.
 *
 * @param {Room} room - The room to search for sources in.
 * @param {Role} role - The role of the creep needing a source (e.g., Miner, Harvester).
 * @param {number} [maxPerSource=2] - The maximum number of creeps of this role that can be assigned to a single source.
 *                                    For Miners, this is typically 1.
 * @returns {Id<Source> | null} The ID of an available source, or null if no suitable source is found.
 */
export function getAvailableSourceId(
    room: Room,
    role: Role,
    maxPerSource = 2
): Id<Source> | null {
    const sources = room.find(FIND_SOURCES);
    // Initialize counts for all sources in the room
    const sourceCounts: Record<string, number> = {}; // Using string for Id<Source> key
    for (const source of sources) {
        sourceCounts[source.id] = 0;
    }

    // Count existing creeps assigned to each source for the given role
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        // Ensure creep is in the same room and has the relevant role and a sourceId
        if (creep.room.name === room.name &&
            creep.memory.role === role &&
            creep.memory.sourceId) {
            if (sourceCounts[creep.memory.sourceId] !== undefined) {
                sourceCounts[creep.memory.sourceId]++;
            }
        }
    }

    // Find a source that has fewer than maxPerSource creeps assigned
    const availableSource = sources.find(
        source => sourceCounts[source.id] < maxPerSource
    );

    return availableSource?.id || null;
}

/**
 * Finds an available container in the room, typically for a Hauler creep.
 * A container is considered "available" if no other Hauler is currently assigned to it.
 * (Assumes a 1-to-1 Hauler-to-Container assignment for simplicity in this function).
 *
 * @param {Room} room - The room to search for containers in.
 * @returns {Id<StructureContainer> | null} The ID of an available container, or null if none are found.
 */
export function getAvailableContainerId(room: Room): Id<StructureContainer> | null {
    const containers = room.find(FIND_STRUCTURES, {
        filter: (s): s is StructureContainer => s.structureType === STRUCTURE_CONTAINER,
    }) as StructureContainer[]; // Type assertion for clarity

    if (containers.length === 0) return null;

    const assignedCounts: Record<string, number> = {}; // Using string for Id<StructureContainer> key
    for (const c of containers) {
        assignedCounts[c.id] = 0;
    }

    // Count haulers assigned to each container
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.room.name === room.name &&
            creep.memory.role === Role.Hauler && // Specifically check for Hauler role
            creep.memory.containerId) {
            if (assignedCounts[creep.memory.containerId] !== undefined) {
                assignedCounts[creep.memory.containerId]++;
            }
        }
    }

    // Find a container with zero assigned haulers (or adjust logic if multiple haulers per container is desired)
    const availableContainer = containers.find(c => assignedCounts[c.id] < 1); //  '< 1' means 0
    return availableContainer?.id || null;
}

/**
 * Refreshes the spawn queue for a given room based on current creep counts and role demands.
 * The queue (`room.memory.spawnQueue`) is rebuilt each time this function is called.
 *
 * Prioritization:
 * 1. Emergency Harvesters: If no miners and room energy is very low, prioritize basic harvesters.
 * 2. Core Economy (Miners & Haulers): These are generally prioritized next.
 * 3. Other Roles (Upgraders, Builders): Spawned if the economy is stable (e.g., containers have energy
 *    or room energy is at capacity).
 *
 * @param {Room} room - The room whose spawn queue needs refreshing.
 */
export function refreshSpawnQueue(room: Room): void {
    const demand = determineRoleDemand(room);
    const counts = countCreepsByRole(room);

    // Initialize spawn queue in memory if it doesn't exist
    if (!room.memory.spawnQueue) {
        room.memory.spawnQueue = [];
    }

    const newQueue: SpawnRequest[] = []; // Build a new queue

    const numMiners = counts[Role.Miner] || 0;
    // const numHaulers = counts[Role.Hauler] || 0; // Not directly used in emergency check
    // const numHarvesters = counts[Role.Harvester] || 0; // Not directly used in emergency check

    const containersWithEnergy = room.find(FIND_STRUCTURES, {
        filter: (s): s is StructureContainer =>
            s.structureType === STRUCTURE_CONTAINER &&
            s.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
    });

    // --- Emergency Mode: Critical lack of mining capability and low energy ---
    // If there are no miners and room energy is low (e.g., not enough for a basic miner/harvester),
    // prioritize spawning a basic harvester to kickstart energy collection.
    if (numMiners === 0 && room.energyAvailable <= 300) { // Threshold 300 for a basic harvester body
        console.log(`[${room.name}] 🚨 Emergency queue rebuild: Prioritizing HARVESTER (no miners, low room energy)`);
        // Add a request for a Harvester. 'opts' could specify a smaller, cheaper body if needed.
        newQueue.push({ role: Role.Harvester, timestamp: Game.time /*, opts: { emergency: true } */ });
        room.memory.spawnQueue = newQueue; // Overwrite queue with emergency request
        return; // Exit early, only focus on emergency
    }

    // --- Standard Spawning Priority ---
    // 1. Miners and Haulers (essential for stable economy with containers)
    for (const role of [Role.Miner, Role.Hauler]) {
        const existing = counts[role] || 0;
        const targetDemand = demand[role] || 0;
        const missing = targetDemand - existing;

        if (missing > 0) {
            for (let i = 0; i < missing; i++) {
                newQueue.push({ role, timestamp: Game.time });
            }
        }
    }

    // 2. Other roles (Upgraders, Builders, generic Harvesters if still needed by demand)
    // Only spawn these if the economy is considered healthy enough.
    const economyStable = containersWithEnergy.length > 0 || room.energyAvailable >= room.energyCapacityAvailable;
    if (economyStable) {
        const otherRoles: Role[] = [Role.Upgrader, Role.Builder, Role.Harvester]; // Harvester here for general demand if not emergency
        for (const role of otherRoles) {
            // Skip re-adding miners/haulers if they were already handled
            if (role === Role.Miner || role === Role.Hauler) continue;

            const existing = counts[role] || 0;
            const targetDemand = demand[role] || 0;
            const missing = targetDemand - existing;

            if (missing > 0) {
                for (let i = 0; i < missing; i++) {
                    newQueue.push({ role, timestamp: Game.time });
                }
            }
        }
    } else {
        if (Game.time % 10 === 0) { // Log less frequently
            console.log(`[${room.name}] 🚫 Holding off on Upgraders/Builders/GeneralHarvesters, economy not stable.`);
        }
    }

    room.memory.spawnQueue = newQueue; // Replace old queue with the newly constructed one

    if (Game.time % 20 === 0) { // Log queue summary less frequently to reduce console spam
        const queueSummary = newQueue.map(req => req.role).join(', ') || "empty";
        console.log(`[${room.name}] ♻ Spawn Queue Refreshed: [${queueSummary}]. Demand: ${JSON.stringify(demand)}`);
    }
}

/**
 * Manages the spawning process for a given spawn structure.
 * It checks the room's spawn queue, attempts to spawn the highest priority creep
 * if energy is sufficient and the spawn is not already busy.
 *
 * @param {StructureSpawn} spawn - The spawn structure to manage.
 */
export function manageSpawns(spawn: StructureSpawn): void {
    if (spawn.spawning) { // If spawn is already busy, do nothing
        // Optionally, render a visual indicating spawning progress
        // spawn.room.visual.text(`🛠️ ${spawn.spawning.name}`, spawn.pos.x + 1, spawn.pos.y, { align: 'left', opacity: 0.8 });
        return;
    }

    const room = spawn.room;
    refreshSpawnQueue(room); // Ensure queue is up-to-date

    const queue = room.memory.spawnQueue;
    if (!queue || queue.length === 0) {
        return; // Nothing in the queue
    }

    const request = queue[0]; // Get the first request (highest priority)
    const roleToSpawn = request.role;

    // Get the body for the role based on current room energy.
    // `getBodyForRole` will try to return a fallback or minimal body if the ideal one isn't affordable.
    // It returns an empty array only if even a minimal body is unaffordable.
    const body = getBodyForRole(roleToSpawn, room.energyAvailable);

    if (body.length === 0) {
        // Cannot afford even a minimal body for this role with current energy.
        // The spawn will wait. No need to remove request from queue yet.
        if (Game.time % 10 === 0) { // Log this state occasionally
            console.log(`[${room.name}] ⚠️ Insufficient energy (${room.energyAvailable}) for role ${roleToSpawn}. Required body too expensive. Waiting...`);
        }
        return;
    }

    // Generate a unique name for the creep
    const shortRoles: Partial<Record<Role, string>> = { // Use Partial as not all roles might be in shortRoles
        [Role.Harvester]: 'hrv',
        [Role.Builder]: 'bld',
        [Role.Upgrader]: 'upg',
        [Role.Miner]: 'min',
        [Role.Hauler]: 'hul'
    };
    const roleAbbreviation = shortRoles[roleToSpawn] || roleToSpawn.substring(0, 3); // Fallback to first 3 letters
    const signature = getBodySignature(body);
    const name = `${roleAbbreviation}_${signature}_${Game.time % 1000}`; // Use modulo to keep name shorter

    // Prepare memory for the new creep
    const memory: CreepMemory = { role: roleToSpawn };
    let spawnResult: ScreepsReturnCode = OK; // Initialize to a non-error state for type checking

    // Assign specific memory properties based on role
    if (roleToSpawn === Role.Harvester || roleToSpawn === Role.Miner) {
        const maxUnitsPerSource = (roleToSpawn === Role.Miner) ? 1 : 2;
        const targetSourceId = getAvailableSourceId(spawn.room, roleToSpawn, maxUnitsPerSource);
        if (targetSourceId) {
            memory.sourceId = targetSourceId;
        } else {
            // No available source for this critical role. This is problematic.
            // The creep will spawn but won't have a sourceId.
            // It might get stuck or pick one randomly later, which is not ideal.
            // Consider delaying spawn or logging a more severe warning.
            console.log(`[${room.name}] ⚠️ CRITICAL: No available source for spawning ${roleToSpawn} ${name}. Spawning without target!`);
            // Optionally, could remove from queue and re-evaluate next tick:
            // queue.shift(); return;
        }
    } else if (roleToSpawn === Role.Hauler) {
        const targetContainerId = getAvailableContainerId(spawn.room);
        if (targetContainerId) {
            memory.containerId = targetContainerId;
        } else {
            // No specific container available for this hauler.
            // It will rely on `handleIdle` or other logic to find work.
            // This is acceptable if haulers are also meant to pick up dropped resources.
            if(room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER}).length > 0){
                 console.log(`[${room.name}] INFO: No specific unassigned container for ${roleToSpawn} ${name}. It will find work or use handleIdle.`);
            }
            // memory.containerId will remain undefined/null by default.
        }
    }

    // Attempt to spawn the creep
    spawnResult = spawn.spawnCreep(body, name, { memory });

    if (spawnResult === OK) {
        console.log(`[${room.name}] ✅ Spawning ${roleToSpawn}: ${name} with body [${body.join(',')}]`);
        queue.shift(); // Remove the spawned request from the queue
        room.memory.spawnQueue = queue; // Update memory
    } else if (spawnResult === ERR_NOT_ENOUGH_ENERGY) {
        // This should ideally be caught by `body.length === 0` check earlier,
        // but as a failsafe, if spawnCreep still returns it.
        if (Game.time % 10 === 0) {
            console.log(`[${room.name}] ⚠️ Spawn attempt for ${name} failed: ERR_NOT_ENOUGH_ENERGY. Available: ${room.energyAvailable}, Cost: ${calculateCost(body)} (This check should be redundant)`);
        }
    } else if (spawnResult !== ERR_BUSY) { // ERR_BUSY is handled by the initial check
        console.log(`[${room.name}] ❌ Spawn attempt for ${name} failed with error: ${spawnResult}`);
        // Consider if the request should be removed from queue on other errors or retried.
        // For now, it stays, and will be re-evaluated.
    }
}

// Helper to calculate body cost, can be moved to a utility file if used elsewhere
function calculateCost(bodyParts: BodyPartConstant[]): number {
    return bodyParts.reduce((cost, part) => cost + BODYPART_COST[part], 0);
}
