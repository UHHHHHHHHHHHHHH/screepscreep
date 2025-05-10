import { Role } from "../types/roles";

type BodyRatio = Partial<Record<BodyPartConstant, number>>;

export const baseRoleRatios: Record<Role, BodyRatio> = {
  harvester: { work: 3, carry: 1, move: 1 },
  builder: { work: 1, carry: 2, move: 2 },
  upgrader: { work: 2, carry: 2, move: 1 },
};

function generateBodyFromRatio(
  ratio: BodyRatio,
  energyAvailable: number,
  partCosts: Record<BodyPartConstant, number> = { work: 100, carry: 50, move: 50 } as Record<BodyPartConstant, number>
): BodyPartConstant[] {
    const parts: BodyPartConstant[] = [];

    const unitParts: BodyPartConstant[] = [];
    for (const part in ratio) {
        const count = ratio[part as BodyPartConstant]!;
        for (let i = 0; i < count; i++) {
        unitParts.push(part as BodyPartConstant);
        }
    }

    const unitCost = unitParts.reduce((sum, part) => sum + partCosts[part], 0);
    const maxRepeats = Math.floor(energyAvailable / unitCost);
    const maxParts = Math.min(maxRepeats * unitParts.length, 50);

    for (let i = 0; i < maxParts; i++) {
        parts.push(unitParts[i % unitParts.length]);
    }

    return parts;
}

const fallbackBody: BodyPartConstant[] = [WORK, CARRY, CARRY, MOVE, MOVE];

export function getBodyForRole(role: Role, energyAvailable: number): BodyPartConstant[] {
  const ratio = baseRoleRatios[role];
  if (!ratio) return fallbackBody;

  const body = generateBodyFromRatio(ratio, energyAvailable);
  return body.length > 0 ? body : fallbackBody;
}

export function getBodySignature(body: BodyPartConstant[]): string {
    const counts: Record<BodyPartConstant, number> = {
      work: 0,
      carry: 0,
      move: 0,
      attack: 0,
      ranged_attack: 0,
      tough: 0,
      heal: 0,
      claim: 0,
    };
  
    for (const part of body) counts[part]++;
  
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${count}${type[0]}`)
      .join('');
  }
  
