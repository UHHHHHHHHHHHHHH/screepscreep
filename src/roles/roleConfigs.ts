import { Role } from "../types/roles";

export interface RoleConfig {
  ratio: Partial<Record<BodyPartConstant, number>>;
  minEnergyForRatio: number;       // if available < this, skip ratio
  fallbackBody?: BodyPartConstant[];
  dontRepeatBody?: boolean;
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
    dontRepeatBody: true
  },
  builder: {
    ratio: { work: 1, carry: 2, move: 2 },
    minEnergyForRatio: 300,        // 1*100 + 2*50 + 2*50
    fallbackBody: [WORK, CARRY, CARRY, MOVE, MOVE],
  },
  upgrader: {
    ratio: { work: 2, carry: 2, move: 3 },
    minEnergyForRatio: 450,        // 2*100 + 2*50 + 3*50
    fallbackBody: [WORK, CARRY, MOVE],
  },
  hauler: {
    ratio: { carry: 6, move: 3 },
    minEnergyForRatio: 450,        // 6*50 + 3*50
  },
};