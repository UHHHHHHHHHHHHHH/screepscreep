import { Role } from "../types/roles";

export type RoleDemand = Record<Role, number>;

export function determineRoleDemand(room: Room): RoleDemand {
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
  const sources = room.find(FIND_SOURCES);

  // Simple assumption: 2 harvesters per source (safe early game max)
  const idealHarvesters = sources.length * 2;

  return {
    harvester: idealHarvesters,
    builder: constructionSites > 0 ? 1 : 0,
    upgrader: constructionSites > 0 ? 0 : 1,
  };
}
