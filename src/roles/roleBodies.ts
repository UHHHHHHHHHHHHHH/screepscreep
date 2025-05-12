import { Role } from "../types/roles";
import { roleConfigs } from "./roleConfigs";

export function getBodyForRole(role: Role, energy: number): BodyPartConstant[] {
  const cfg = roleConfigs[role];
  if (!cfg) {
    // unexpected role → ultimate fallback
    return [WORK, CARRY, MOVE];
  }

  // compute the “unit” and cost
  const unitParts: BodyPartConstant[] = [];
  const ratioOrder: BodyPartConstant[] = [];
  for (const [part, cnt] of Object.entries(cfg.ratio) as [BodyPartConstant, number][]) {
    ratioOrder.push(part);
    for (let i = 0; i < cnt; i++) unitParts.push(part);
  }
  const unitCost = unitParts.reduce((sum, p) => sum + BODYPART_COST[p], 0);

  // if we can’t even afford one ratio-unit, do fallback logic
  if (energy < cfg.minEnergyForRatio || unitCost === 0) {
    // use this role’s fallbackBody
    return cfg.fallbackBody || [];
  }

  // ok, we can afford ratio: repeat as many times as capacity allows (capped at 50 parts)
  const repeats = cfg.dontRepeatBody ? 1 : Math.floor(energy / unitCost);
  const maxRepeats = Math.min(repeats, Math.floor(50 / unitParts.length));
  const body: BodyPartConstant[] = [];
  for (let i = 0; i < maxRepeats * unitParts.length; i++) {
    body.push(unitParts[i % unitParts.length]);
  }

  let leftover = energy - maxRepeats * unitCost;
  let added: boolean;
  do {
    added = false;
    for (const part of ratioOrder) {
      const cost = BODYPART_COST[part];
      if (leftover >= cost && body.length < 50) {
        body.push(part);
        leftover -= cost;
        added = true;
      }
    }
  } while (added);

  return body;
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

