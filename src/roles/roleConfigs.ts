import { Role } from "../types/roles";

export interface RoleConfig {
  ratio: Partial<Record<BodyPartConstant, number>>;
  minEnergyForRatio: number;       // if available < this, skip ratio
  fallbackRole?: Role;             // e.g. for miners, fallbackRole = Role.Harvester
  fallbackBody?: BodyPartConstant[];
}

export const roleConfigs: Record<Role, RoleConfig> = {
  harvester: {
    ratio: { work: 3, carry: 1, move: 1 },
    minEnergyForRatio: 400,        // 3*100 + 1*50 + 1*50
    // harvesters don’t need a fallbackRole—they just fallback to their own fallbackBody
    fallbackBody: [WORK, CARRY, CARRY, MOVE, MOVE],
  },
  miner: {
    ratio: { work: 5, move: 1 },
    minEnergyForRatio: 550,        // 5*100 + 1*50
    fallbackRole: Role.Harvester,  // if we can’t afford miner, spawn a harvester instead
    fallbackBody: [WORK, CARRY, MOVE],
  },
  builder: {
    ratio: { work: 1, carry: 2, move: 2 },
    minEnergyForRatio: 300,        // 1*100 + 2*50 + 2*50
    fallbackBody: [WORK, CARRY, CARRY, MOVE, MOVE],
  },
  upgrader: {
    ratio: { work: 2, carry: 2, move: 1 },
    minEnergyForRatio: 350,        // 2*100 + 2*50 + 1*50
    fallbackBody: [WORK, CARRY, MOVE],
  },
  hauler: {
    ratio: { carry: 6, move: 3 },
    minEnergyForRatio: 450,        // 6*50 + 3*50
    fallbackBody: [CARRY, CARRY, MOVE, MOVE],
  },
};