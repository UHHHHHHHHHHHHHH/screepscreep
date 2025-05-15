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

    // Ensure queue exists
    if (!room.memory.spawnQueue) room.memory.spawnQueue = [];

    const queue = room.memory.spawnQueue;

    // Build a fresh tally of existing queued per role
    const queuedCounts = Object.values(Role).reduce((acc, r) => {
        acc[r] = 0;
        return acc;
    }, {} as Record<Role, number>);
    for (const req of queue) {
        queuedCounts[req.role] = (queuedCounts[req.role] || 0) + 1;
    }

    // Calculate needed spawns and rebuild queue cleanly
    const newQueue: typeof queue = [];

    for (const role of Object.values(Role) as Role[]) {
        const existing = counts[role] || 0;
        const queued = queuedCounts[role] || 0;
        const target = demand[role];

        const missing = target - existing - queued;
        if (missing > 0) {
            for (let i = 0; i < missing; i++) {
                newQueue.push({ role, timestamp: Game.time });
            }
        }
    }

    room.memory.spawnQueue = newQueue;

    // Debug
    if (Game.time % 10 === 0) {
        console.log(`[${room.name}] Updated spawnQueue: ${JSON.stringify(newQueue)}`);
    }
}

export function manageSpawns(spawn: StructureSpawn): void {
    const room = spawn.room;
    refreshSpawnQueue(room);

    const queue = room.memory.spawnQueue!;
    if (queue.length === 0) return;

    const counts = countCreepsByRole(room);

    // Emergency mode: if no miners, haulers or harvesters → must spawn basic harvester ASAP
    const noMiners = counts[Role.Miner] === 0;
    const noHaulers = counts[Role.Hauler] === 0;
    const noHarvesters = counts[Role.Harvester] === 0;

    // Check if we have containers with energy stored
    const containersWithEnergy = room.find(FIND_STRUCTURES, {
        filter: s =>
            s.structureType === STRUCTURE_CONTAINER &&
            s.store.getUsedCapacity(RESOURCE_ENERGY)! > 0,
    }) as StructureContainer[];

    let selectedIndex = -1;
    let selectedReq: typeof queue[0] | null = null;
    let selectedBody: BodyPartConstant[] = [];

    // --- Tier 1: Critical recovery ---
    if ((noMiners && containersWithEnergy.length === 0) || (noHaulers && containersWithEnergy.length === 0) || (noHarvesters && room.energyAvailable < 300)) {
        console.log(`[${room.name}] ⚠ Emergency spawn mode: Prioritizing harvester`);
        const candidateIndex = queue.findIndex(q => q.role === Role.Harvester);
        if (candidateIndex !== -1) {
            const body = getBodyForRole(Role.Harvester, room.energyAvailable);
            if (body.length > 0) {
                selectedIndex = candidateIndex;
                selectedReq = queue[candidateIndex];
                selectedBody = body;
            }
        }
    }

    // --- Tier 2: Ensure economy stability (miners/haulers) ---
    if (!selectedReq) {
        const priorityRoles: Role[] = [Role.Miner, Role.Hauler];
        for (const role of priorityRoles) {
            const candidateIndex = queue.findIndex(q => q.role === role);
            if (candidateIndex !== -1) {
                const body = getBodyForRole(role, room.energyAvailable);
                if (body.length > 0) {
                    selectedIndex = candidateIndex;
                    selectedReq = queue[candidateIndex];
                    selectedBody = body;
                    break;
                }
            }
        }
    }

    // --- Tier 3: Everything else (upgraders, builders) ---
    if (!selectedReq) {
        const candidateIndex = queue.findIndex(q => q.role === Role.Upgrader || q.role === Role.Builder);
        if (candidateIndex !== -1) {
            const candidate = queue[candidateIndex];
            const body = getBodyForRole(candidate.role, room.energyAvailable);
            if (body.length > 0) {
                selectedIndex = candidateIndex;
                selectedReq = candidate;
                selectedBody = body;
            }
        }
    }

    if (!selectedReq) return; // Can't afford anything still? wait.

    // Proceed to spawn like before
    const role = selectedReq.role;
    const body = selectedBody;

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
        queue.splice(selectedIndex, 1); // Remove the spawned request
    }
}
