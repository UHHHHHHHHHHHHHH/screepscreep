import { Role } from "../types/roles";

export type RoleDemand = Record<Role, number>;

export function determineRoleDemand(room: Room): RoleDemand {
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;

  return {
    harvester: 2,
    builder: constructionSites > 0 ? 1 : 0,
    upgrader: constructionSites > 0 ? 0 : 1,
    // Add more as needed later
  };
}
