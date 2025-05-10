import { Role } from "../types/roles";

export const baseRoleBodies: Record<Role, BodyPartConstant[]> = {
  harvester: [WORK, CARRY, MOVE, WORK, WORK],
  upgrader: [WORK, CARRY, MOVE, WORK, CARRY],
  builder: [WORK, CARRY, MOVE, CARRY, MOVE],
};

const partCost: Record<BodyPartConstant, number> = {
  work: 100,
  carry: 50,
  move: 50,
} as Record<BodyPartConstant, number>;

const fallback: BodyPartConstant[] = [WORK, CARRY, MOVE]; // 200 energy

export function getBodyForRole(role: Role, energyAvailable: number): BodyPartConstant[] {
  const base = baseRoleBodies[role];
  if (!base) return fallback;

  const baseCost = base.reduce((sum, part) => sum + partCost[part], 0);

  if (energyAvailable < 200) return fallback;

  // Case A: Can afford at least 2× base → just repeat
  if (energyAvailable >= baseCost * 2) {
    const maxRepeats = Math.floor(energyAvailable / baseCost);
    const body = Array(maxRepeats).fill(base).flat();
    return body.slice(0, 50);
  }

  // Case B: In between 1× and 2× — fill as much as we can in proportion
  const totalParts = Math.min(
    Math.floor(energyAvailable / 50),
    50 // hard part count cap
  );

  const body: BodyPartConstant[] = [];
  let energyLeft = energyAvailable;
  
  // Count how many of each part already added
  const addedCounts = {
    work: 0,
    carry: 0,
    move: 0,
  } as Record<BodyPartConstant, number>;
  
  while (body.length < totalParts) {
    let added = false;
  
    for (const part of base) {
      if (energyLeft < partCost[part]) continue;
  
      body.push(part);
      addedCounts[part]++;
      energyLeft -= partCost[part];
      added = true;
  
      if (body.length >= totalParts) break;
    }
  
    if (!added) break; // can't add more parts
  }

  return body;
}
