import { Role } from "../types/roles";
import { determineRoleDemand } from "../roles/roleDemand";
import { getBodyForRole, getBodySignature } from "../roles/roleBodies";
import { getRoomPhase } from "./roomManager";

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

export function manageSpawns(spawn: StructureSpawn): void {
    const room = spawn.room;
    const demand = determineRoleDemand(room);

    const harvestersAlive = Object.values(Game.creeps).filter(
        c => c.memory.role === Role.Harvester
    ).length;

    // 🆘 Emergency bootstrapping logic
    if (getRoomPhase(room) === 1) {
        if (harvestersAlive === 0 && spawn.store[RESOURCE_ENERGY] >= 200) {
            const name = `emergency_harvester_${Game.time}`;
            const result = spawn.spawnCreep([WORK, CARRY, MOVE], name, {
                memory: { role: Role.Harvester },
            });

            if (result === OK) {
                console.log(`🆘 Emergency harvester spawned: ${name}`);
                return;
            }
        }
    }

    for (const role of Object.keys(demand) as Role[]) {
        const desired = demand[role];
        const current = Object.values(Game.creeps).filter(
            c => c.memory.role === role
        ).length;

        if (current < desired) {
            const energy = spawn.room.energyAvailable;
            const body = getBodyForRole(role, energy);
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
                    continue; // skip this role
                }

                result = spawn.spawnCreep(body, name, {
                    memory: { role, sourceId: targetSourceId },
                });

                if (result === OK) {
                    console.log(`Spawning harvester: ${name} → source ${targetSourceId}`);
                }
            } else if (role === Role.Hauler) {
                const targetContainerId = getAvailableContainerId(spawn.room);
                if (!targetContainerId) {
                    console.log("❌ No available container for hauler");
                    continue;
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
                break; // spawn only one per tick
            }
        }
    }
}
