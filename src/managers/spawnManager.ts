import { Role } from "../types/roles";
import { determineRoleDemand } from "./roleDemandManager";
import { getBodyForRole, getBodySignature } from "../roles/roleBodies";
import { getRoomPhase } from "./roomManager";
import { countCreepsByRole } from "./creepManager";

export function getAvailableSourceId(
    room: Room,
    role: Role,
    maxPerSource = 2
): Id<Source> | null {
    const sources = room.find(FIND_SOURCES);
    const sourceCounts: Record<Id<Source>, number> = {};

    for (const source of sources) {
        sourceCounts[source.id] = 0;
    }

    for (const creep of Object.values(Game.creeps)) {
        if (creep.memory.role === role && creep.memory.sourceId) {
            sourceCounts[creep.memory.sourceId] =
                (sourceCounts[creep.memory.sourceId] || 0) + 1;
        }
    }

    const availableSource = sources.find(
        source => sourceCounts[source.id] < maxPerSource
    );

    return availableSource?.id || null;
}

export function getAvailableContainerId(room: Room): Id<StructureContainer> | null {
    const containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER,
    }) as StructureContainer[];

    const assignedCounts: Record<Id<StructureContainer>, number> = {};
    for (const c of containers) assignedCounts[c.id] = 0;

    for (const creep of Object.values(Game.creeps)) {
        if (creep.memory.role === "hauler" && creep.memory.containerId) {
            assignedCounts[creep.memory.containerId] =
                (assignedCounts[creep.memory.containerId] || 0) + 1;
        }
    }

    const available = containers.find(c => assignedCounts[c.id] < 1);
    return available?.id || null;
}

export function refreshSpawnQueue(room: Room) {
    const demand = determineRoleDemand(room);
    const counts = countCreepsByRole(room);

    if (!room.memory.spawnQueue) room.memory.spawnQueue = [];

    const newQueue: { role: Role; timestamp: number; opts?: any }[] = [];

    const noMiners = counts[Role.Miner] === 0;
    const noHaulers = counts[Role.Hauler] === 0;
    const noHarvesters = counts[Role.Harvester] === 0;
    const containersWithEnergy = room.find(FIND_STRUCTURES, {
        filter: s =>
            s.structureType === STRUCTURE_CONTAINER &&
            s.store.getUsedCapacity(RESOURCE_ENERGY)! > 0,
    }) as StructureContainer[];

    // --- Emergency: economy crashed ---
    if (noMiners && room.energyAvailable <= 300) {
        console.log(`[${room.name}] 🚨 Emergency queue rebuild: only HARVESTER (no miners, low room energy)`);
        newQueue.push({ role: Role.Harvester, timestamp: Game.time });
        room.memory.spawnQueue = newQueue;
        return;
    }

    // --- Stable: ensure MINERS and HAULERS first ---
    for (const role of [Role.Miner, Role.Hauler]) {
        const existing = counts[role] || 0;
        const target = demand[role];
        const missing = target - existing;
        if (missing > 0) {
            for (let i = 0; i < missing; i++) {
                newQueue.push({ role, timestamp: Game.time });
            }
        }
    }

    // --- Only allow UPGRADERS and BUILDERS if economy is healthy ---
    if (containersWithEnergy.length > 0 || room.energyAvailable === room.energyCapacityAvailable) {
        for (const role of [Role.Upgrader, Role.Builder]) {
            const existing = counts[role] || 0;
            const target = demand[role];
            const missing = target - existing;
            if (missing > 0) {
                for (let i = 0; i < missing; i++) {
                    newQueue.push({ role, timestamp: Game.time });
                }
            }
        }
    } else {
        console.log(`[${room.name}] 🚫 Skipping upgraders/builders, economy not stable`);
    }

    room.memory.spawnQueue = newQueue;

    if (Game.time % 10 === 0) {
        console.log(`[${room.name}] ♻ Rebuilt queue: ${JSON.stringify(newQueue)}`);
        console.log("demand", JSON.stringify(demand))
    }
}

export function manageSpawns(spawn: StructureSpawn): void {
    const room = spawn.room;
    refreshSpawnQueue(room);

    const queue = room.memory.spawnQueue!;
    if (queue.length === 0) return;

    const request = queue[0];
    const body = getBodyForRole(request.role, room.energyAvailable);
    if (body.length === 0) return; // Can't afford, wait

    const role = request.role;
    const shortRoles: Record<Role, string> = {
        harvester: 'hr',
        builder: 'b',
        upgrader: 'u',
        miner: 'm',
        hauler: 'hl'
    };

    const signature = getBodySignature(body);
    const name = `${shortRoles[role] || role}_${signature}_${Game.time}`;

    let result: ScreepsReturnCode;

    if (role === Role.Harvester || role === Role.Miner) {
        const maxPerSource = role === Role.Miner ? 1 : 2;
        const targetSourceId = getAvailableSourceId(spawn.room, role, maxPerSource);
        if (!targetSourceId) {
            console.log(`❌ No available source for role ${role}`);
            return;
        }

        result = spawn.spawnCreep(body, name, {
            memory: { role, sourceId: targetSourceId },
        });

    } else if (role === Role.Hauler) {
        const targetContainerId = getAvailableContainerId(spawn.room);

        result = spawn.spawnCreep(body, name, {
            memory: { role, containerId: targetContainerId },
        });

    } else {
        result = spawn.spawnCreep(body, name, {
            memory: { role },
        });
    }

    if (result === OK) {
        console.log(`✅ Spawned ${role}: ${name}`);
        queue.shift(); // Remove first entry since it was spawned
    }
}
