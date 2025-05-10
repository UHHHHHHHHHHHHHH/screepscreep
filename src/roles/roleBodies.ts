import { Role } from "../types/roles";

export const roleBodies: Record<Role, BodyPartConstant[]> = {
  harvester: [WORK, WORK, CARRY, MOVE],
  upgrader: [WORK, CARRY, MOVE, MOVE],
  builder:  [WORK, CARRY, MOVE, MOVE],
};
