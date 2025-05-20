// src/managers/spawnManager.ts

import { Role } from "../types/roles";
import { RoleDemandMap, RoleDemandEntry } from "../types/memory";
import { determineRoleDemand } from "./roleDemandManager";
import { getBodyForRole, getBodySignature, calculateCost } from "../roles/roleBodies";
import { getRoomPhase } from "./roomManager";
import { countCreepsByRole } from "./creepManager";

// Helper: Simplified check for stable economy, used before queuing builders/upgraders
function isEconomyStableEnoughForNonEssential(room: Room): boolean {
    if (sourcesAreFilledCheck(room)) return true; // If sources fully covered, good.
    const containersWithEnergy = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY)! > 50 // Min energy in container
    }).length;
    if (containersWithEnergy > 0) return true;
    // Fallback: if room energy is high relative to capacity (e.g. spawn full, extensions mostly full)
    if (room.energyAvailable > room.energyCapacityAvailable * 0.8) return true;
    return false;
}

// Helper: (Can be imported or local) - Checks if sources are generally being worked
function sourcesAreFilledCheck(room: Room): boolean {
    const sources = room.find(FIND_SOURCES);
    if (sources.length === 0) return true;

    return sources.every(source => {
        const miners = Object.values(Game.creeps).filter(c =>
            c.room.name === room.name &&
            c.memory.role === Role.Miner &&
            c.memory.sourceId === source.id
        ).length;
        if (miners >= 1) return true;

        const phase = getRoomPhase(room);
        if (phase < 2.5) {
            const harvesters = Object.values(Game.creeps).filter(c =>
                c.room.name === room.name &&
                c.memory.role === Role.Harvester &&
                c.memory.sourceId === source.id
            ).length;
            if (harvesters >= (phase < 2 ? 2 : 1)) return true;
        }
        return false;
    });
}


/**
 * Gets the ID of an available energy source for a creep.
 * It considers already spawned creeps and creeps currently being processed in the new spawn queue.
 * @param {Room} room - The room to search.
 * @param {Role} role - The role of the creep needing a source.
 * @param {number} maxPerSource - Max creeps of this role per source.
 * @param {SpawnRequest[]} currentNewQueue - The spawn queue being built in the current tick.
 * @returns {Id<Source> | null} Source ID or null.
 */
export function getAvailableSourceId(
    room: Room,
    role: Role,
    maxPerSource: number,
    currentNewQueue: SpawnRequest[]
): Id<Source> | null {
    const sources = room.find(FIND_SOURCES);
    const sourceCounts: Record<Id<Source>, number> = {};
    for (const source of sources) sourceCounts[source.id] = 0;

    // Count creeps in game
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.room.name === room.name && creep.memory.role === role && creep.memory.sourceId) {
            if (sourceCounts[creep.memory.sourceId] !== undefined) sourceCounts[creep.memory.sourceId]++;
        }
    }
    // Count creeps in the queue being built
    for (const request of currentNewQueue) {
        if (request.memory.role === role && request.memory.sourceId) {
            if (sourceCounts[request.memory.sourceId] !== undefined) sourceCounts[request.memory.sourceId]++;
        }
    }

    const availableSource = sources.find(s => (sourceCounts[s.id] || 0) < maxPerSource);
    return availableSource?.id || null;
}

/**
 * Gets the ID of an available container for a Hauler.
 * Considers already spawned Haulers and Haulers in the new spawn queue.
 * @param {Room} room - The room to search.
 * @param {SpawnRequest[]} currentNewQueue - The spawn queue being built.
 * @returns {Id<StructureContainer> | null} Container ID or null.
 */
export function getAvailableContainerId(
    room: Room,
    currentNewQueue: SpawnRequest[]
): Id<StructureContainer> | null {
    const containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER,
    }) as StructureContainer[];
    if (containers.length === 0) return null;

    const assignedCounts: Record<Id<StructureContainer>, number> = {};
    for (const c of containers) assignedCounts[c.id] = 0;

    // Count Haulers in game
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.room.name === room.name && creep.memory.role === Role.Hauler && creep.memory.containerId) {
            if (assignedCounts[creep.memory.containerId] !== undefined) assignedCounts[creep.memory.containerId]++;
        }
    }
    // Count Haulers in the queue being built
    for (const request of currentNewQueue) {
        if (request.memory.role === Role.Hauler && request.memory.containerId) {
            if (assignedCounts[request.memory.containerId] !== undefined) assignedCounts[request.memory.containerId]++;
        }
    }

    const available = containers.find(c => (assignedCounts[c.id] || 0) < 1); // Max 1 hauler per container
    return available?.id || null;
}


/**
 * Incrementally refreshes the spawn queue for a room.
 * 1. Filters the existing queue: Removes requests no longer justified by current demand.
 * 2. Appends new requests: Adds requests to the end of the queue for unmet demands.
 * The order of roles for appending new requests can influence spawn priority for new needs.
 *
 * @param {Room} room - The room for which to refresh the spawn queue.
 */
export function refreshSpawnQueue(room: Room): void {
    if (!room.memory.spawnQueue) {
        room.memory.spawnQueue = [];
    }

    const demandMap: RoleDemandMap = determineRoleDemand(room);
    const currentCreepCounts = countCreepsByRole(room);
    const roomEnergyCapacity = room.energyCapacityAvailable;
    const currentRoomEnergy = room.energyAvailable;
    const oldQueue = [...room.memory.spawnQueue]; // Operate on a copy
    let newQueue: SpawnRequest[] = [];

    const shortRoles: Record<Role, string> = {
        [Role.Harvester]: 'hrv', [Role.Builder]: 'bld', [Role.Upgrader]: 'upg',
        [Role.Miner]: 'mnr', [Role.Hauler]: 'hal'
    };

    if (Game.time % 10 === 0) {
        console.log("demand:", JSON.stringify(demandMap))
    }

    // Track how many of each role we've decided to *keep* from the old queue or *add* as new.
    // This is used to ensure we don't over-queue when both pruning and adding.
    const effectiveQueuedCountsThisTick: Record<Role, number> = (Object.values(Role) as Role[]).reduce((acc, r) => {
        acc[r] = 0; return acc;
    }, {} as Record<Role, number>);

    // --- Phase 1: Filter and keep relevant requests from the old queue ---
    for (const request of oldQueue) {
        const role = request.role;
        const demandEntry = demandMap[role];

        if (demandEntry && demandEntry.count > 0) {
            const liveCountForRole = currentCreepCounts[role] || 0;
            const currentEffectiveQueued = effectiveQueuedCountsThisTick[role] || 0;
            if (liveCountForRole + currentEffectiveQueued < demandEntry.count) {
                if (demandEntry.isEmergency && request.memory.role === Role.Harvester) {
                    // maybe emergency stuff 
                }
                newQueue.push(request);
                effectiveQueuedCountsThisTick[role]++;
            }
        }
    }


    // --- Phase 2: Add new requests for unmet demands ---
    // Convert demandMap to an array and sort by priority (lower is higher)
    const sortedDemandEntries = (Object.keys(demandMap) as Role[])
        .map(role => ({ role, ...demandMap[role]! })) // Add role to entry for easier access
        .filter(entry => entry.count > 0) // Only consider roles with positive demand count
        .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    for (const demandEntry of sortedDemandEntries) {
        const role = demandEntry.role;
        const liveCountForRole = currentCreepCounts[role] || 0;
        const alreadyEffectivelyQueued = effectiveQueuedCountsThisTick[role] || 0;
        let numToAddNew = demandEntry.count - liveCountForRole - alreadyEffectivelyQueued;

        if (numToAddNew > 0) {
            // if (!demandEntry.isEmergency && (role === Role.Builder || role === Role.Upgrader) && !isEconomyStableEnoughForNonEssential(room)) {
            //     if (Game.time % 20 === 8 && numToAddNew > 0) console.log(`[${room.name}] 🚫 Postponing new ${role}(s) (${numToAddNew}), economy not stable enough.`);
            //     numToAddNew = 0;
            // }

            for (let i = 0; i < numToAddNew; i++) {
                if (newQueue.length >= 10) break;

                const energyForBody = demandEntry.maxCost || roomEnergyCapacity;
                const isEmergency = demandEntry.isEmergency || false;
                const targetBody = getBodyForRole(role, energyForBody, isEmergency);

                if (targetBody.length === 0) {
                    if (Game.time % 10 === 1) console.log(`[${room.name}] ⚠️ Cannot form body for ${role} (Energy: ${energyForBody}, Emergency: ${isEmergency}). Demand: ${JSON.stringify(demandEntry)}`);
                    continue;
                }

                const bodyCost = calculateCost(targetBody);
                const bodySignature = getBodySignature(targetBody);
                let name = ''; let nameAttempt = 0;
                do {
                    name = `${shortRoles[role] || role[0]}${bodySignature}_${(isEmergency ? "EM_" : "")}${(Game.time % 1000) + i + nameAttempt}`;
                    nameAttempt++;
                } while ((Game.creeps[name] || newQueue.some(req => req.name === name)) && nameAttempt < 10);

                if (Game.creeps[name] || newQueue.some(req => req.name === name)) { /* ... log name fail ... */ continue; }

                const initialMemory: CreepMemory = { role: role };
                // if (isEmergency) initialMemory.isEmergencyCreep = true; // Optional: flag in creep memory

                // Assign Source/Container IDs
                if (role === Role.Miner || role === Role.Harvester) {
                    const maxPerSrc = role === Role.Miner ? 1 : (getRoomPhase(room) < 2.5 ? 2 : 1);
                    const targetSourceId = getAvailableSourceId(room, role, maxPerSrc, newQueue);
                    if (targetSourceId) initialMemory.sourceId = targetSourceId;
                    else if (role === Role.Miner) { /* ... log no miner slot ... */ continue; }
                } else if (role === Role.Hauler) {
                    const targetContainerId = getAvailableContainerId(room, newQueue);
                    if (targetContainerId) initialMemory.containerId = targetContainerId;
                }

                // For emergency harvesters, add to front of queue. Others to back.
                const spawnRequest: SpawnRequest = {
                    role: role, body: targetBody, name: name, memory: initialMemory,
                    timestamp: Game.time, cost: bodyCost
                };

                if (isEmergency) {
                    newQueue.unshift(spawnRequest); // Emergency to the front
                    console.log(`[${room.name}] EMERGENCY: Queued ${name} (Cost: ${bodyCost}) to front.`);
                } else {
                    newQueue.push(spawnRequest);
                }
                effectiveQueuedCountsThisTick[role] = (effectiveQueuedCountsThisTick[role] || 0) + 1;
            }
        }
        if (newQueue.length >= 10) break;
    }


    if (JSON.stringify(room.memory.spawnQueue) !== JSON.stringify(newQueue)) {
        room.memory.spawnQueue = newQueue;
        if (Game.time % 10 === 9 || newQueue.some(r => r.name.includes("_EM_"))) {
            console.log(`[${room.name}] ♻ Spawn Queue updated (${oldQueue.length} -> ${newQueue.length}): ${newQueue.map(r => r.role[0] + (r.name.includes("_EM_") ? "!" : "")).join('') || 'empty'}`);
        }
    }
}


/**
 * Manages a single spawn structure.
 * Attempts to spawn the highest priority creep from the room's queue if energy is available.
 * @param {StructureSpawn} spawn - The spawn structure to manage.
 */
export function manageSpawns(spawn: StructureSpawn): void {
    if (spawn.spawning) {
        // If spawn is busy, display spawning creep name and time left
        const spawningCreep = Game.creeps[spawn.spawning.name];
        if (spawningCreep) {
            spawn.room.visual.text(
                `🛠️ ${spawn.spawning.name} (${spawn.spawning.remainingTime})`,
                spawn.pos.x + 1,
                spawn.pos.y,
                { align: 'left', opacity: 0.8, font: '0.7 Arial' }
            );
        }
        return;
    }

    const room = spawn.room;
    // `refreshSpawnQueue` should ideally be called once per room per interval from main.ts.
    // Calling it here less frequently for now.
    if (Game.time % 3 === 1 && room.find(FIND_MY_SPAWNS)[0].id === spawn.id) { // Refresh only for the "first" spawn in room
        refreshSpawnQueue(room);
    }


    const queue = room.memory.spawnQueue;
    if (!queue || queue.length === 0) {
        return;
    }

    const request = queue[0]; // Always try to spawn the first in queue

    if (room.energyAvailable < request.cost) {
        // Log only if it's the primary spawn and queue isn't empty, to reduce spam
        if (Game.time % 15 === 2 && spawn.id === room.find(FIND_MY_SPAWNS)[0]?.id) {
            console.log(`[${room.name}/${spawn.name}] ⏳ Waiting for energy (${room.energyAvailable}/${request.cost}) for ${request.role} ${request.name}`);
        }
        return;
    }

    const result = spawn.spawnCreep(request.body, request.name, { memory: request.memory });

    if (result === OK) {
        console.log(`[${room.name}/${spawn.name}] ✅ Spawning ${request.role}: ${request.name} (cost: ${request.cost})`);
        queue.shift(); // Success, remove from queue
    } else if (result !== ERR_BUSY && result !== ERR_NOT_ENOUGH_ENERGY) {
        console.log(`[${room.name}/${spawn.name}] ❌ Failed to spawn ${request.name} (role ${request.role}) with error: ${result}. Body: ${JSON.stringify(request.body)}, Memory: ${JSON.stringify(request.memory)}`);
        // For persistent errors like invalid args or name exists (though name should be unique), remove the request.
        if (result === ERR_INVALID_ARGS || result === ERR_NAME_EXISTS) {
            console.log(`[${room.name}/${spawn.name}] Removing problematic spawn request: ${request.name}`);
            queue.shift();
        }
    }
    // If ERR_BUSY or ERR_NOT_ENOUGH_ENERGY (despite pre-check), let it retry next tick.
}