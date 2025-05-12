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
    minEnergyForRatio: 400,
    fallbackBody: [WORK, WORK, CARRY, MOVE],
  },
  miner: {
    ratio: { work: 5, move: 1 },
    minEnergyForRatio: 550,
    dontRepeatBody: true
  },
  builder: {
    ratio: { work: 2, carry: 2, move: 2 },
    minEnergyForRatio: 400,
    fallbackBody: [WORK, CARRY, CARRY, MOVE, MOVE],
  },
  upgrader: {
    ratio: { work: 3, carry: 2, move: 3 },
    minEnergyForRatio: 550,
    fallbackBody: [WORK, WORK, CARRY, MOVE],
  },
  hauler: {
    ratio: { carry: 6, move: 3 },
    minEnergyForRatio: 450,
  },
};