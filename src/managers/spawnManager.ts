import { Role } from "../types/roles";
import { determineRoleDemand } from "../roles/roleDemand";
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

function enqueueSpawns(room: Room) {
    const demand = determineRoleDemand(room);
    const counts = countCreepsByRole(room);
    room.memory.spawnQueue = room.memory.spawnQueue || [];

    for (const role of Object.keys(demand) as Role[]) {
        const need = demand[role] - (counts[role] || 0);
        for (let i = 0; i < need; i++) {
            // only enqueue if we don’t already have that role+opts in queue
            room.memory.spawnQueue.push({
                role,
                timestamp: Game.time,
                // you can also include e.g. sourceId or containerId here:
                // opts: { sourceId, containerId }
            });
        }
    }
}

export function manageSpawns(spawn: StructureSpawn): void {
    const room = spawn.room;
    enqueueSpawns(room);

    const demand = determineRoleDemand(room);

    const queue = room.memory.spawnQueue!;
    if (queue.length === 0) return;

    if (Game.time % 10 === 0) {
        console.log('demand:\n' + JSON.stringify(demand, null, 2));
    }

    const req = queue[0];
    const role = req.role;
    const body = getBodyForRole(req.role, room.energyAvailable);

    // If we can’t even afford the bare minimum, bail out and wait
    if (body.length === 0) return;

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
            console.log(`❌ No available source for role` + role);
            return
        }

        result = spawn.spawnCreep(body, name, {
            memory: { role, sourceId: targetSourceId },
        });

        if (result === OK) {
            console.log(`Spawning ${role}: ${name} → source ${targetSourceId}`);
        }
    } else if (role === Role.Hauler) {
        const targetContainerId = getAvailableContainerId(spawn.room);
        if (!targetContainerId) {
            console.log("❌ No available container for hauler");
            return
        }

        result = spawn.spawnCreep(body, name, {
            memory: { role, containerId: targetContainerId },
        });

        if (result === OK) {
            console.log(`Spawning hauler: ${name} → container ${targetContainerId}`);
        }
    } else {
        result = spawn.spawnCreep(body, name, {
            memory: { role },
        });

        if (result === OK) {
            console.log(`Spawning ${role}: ${name}`);
        }
    }

    if (result === OK) {
        queue.shift(); 
    }
}
