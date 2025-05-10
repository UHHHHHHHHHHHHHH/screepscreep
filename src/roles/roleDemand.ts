import { Role } from "../types/roles";
import { getRoomPhase } from "../managers/roomManager";

export type RoleDemand = Record<Role, number>;

const allRoles = Object.values(Role) as Role[];

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
            return {
                ...base,
                harvester: idealHarvesters,
                builder: harvestersAlive >= idealHarvesters && constructionSites > 0 ? 1 : 0,
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
