import { Role } from "../types/roles";
import { getRoomPhase } from "../managers/roomManager";

export type RoleDemand = Record<Role, number>;

const allRoles = Object.values(Role) as Role[];

export function isRoleDemandSatisfied(room: Room): boolean {
    const demand = determineRoleDemand(room);
    const counts: Record<Role, number> = {
        harvester: 0,
        upgrader: 0,
        builder: 0,
        miner: 0,
        hauler: 0,
    };

    for (const creep of Object.values(Game.creeps)) {
        if (creep.room.name === room.name) {
            counts[creep.memory.role] = (counts[creep.memory.role] || 0) + 1;
        }
    }

    for (const role of Object.keys(demand) as Role[]) {
        if (counts[role] < demand[role]) return false;
    }

    return true;
}

// build a fresh zeroed demand record
function zeroDemand(): RoleDemand {
    return allRoles.reduce((acc, role) => {
        acc[role] = 0;
        return acc;
    }, {} as RoleDemand);
}

export function determineRoleDemand(room: Room): RoleDemand {
    const phase = getRoomPhase(room);
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    const sources = room.find(FIND_SOURCES);
    const idealHarvesters = sources.length * 2;
    const harvestersAlive = Object.values(Game.creeps)
        .filter(c => c.memory.role === Role.Harvester && c.room.name === room.name)
        .length;

    // start from a zeroed record
    const base = zeroDemand();

    switch (phase) {
        case 1:
            return {
                ...base,
                harvester: idealHarvesters,
                upgrader: harvestersAlive >= idealHarvesters ? 1 : 0,
            };
        case 2:
            const containers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER,
            }) as StructureContainer[];

            return {
                ...base,
                harvester: idealHarvesters,
                builder: harvestersAlive >= idealHarvesters && constructionSites > 0 ? 1 : 0,
                hauler: containers.length >= 1 ? 1 : 0,
            };
        case 2.5:
            return {
                ...base,
                miner: sources.length,
                hauler: sources.length,
                builder: harvestersAlive >= idealHarvesters && constructionSites > 0 ? 1 : 0,
            };
        default:
            return {
                ...base,
                harvester: idealHarvesters,
                builder: constructionSites > 0 ? 1 : 0,
                upgrader: constructionSites > 0 ? 0 : 1,
            };
    }
}
