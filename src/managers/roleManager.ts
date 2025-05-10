import { determineRoleDemand } from "../roles/roleDemand";
import { Role } from "../types/roles";
import { getBodyForRole } from "../roles/roleBodies";

const ROLE_LOCK_DURATION = 100; // Ticks to stay locked into a role after switching
const ROLE_REEVALUATION_INTERVAL = 10; // Ticks between reassessment

function hasCompatibleBody(creep: Creep, targetRole: Role): boolean {
    const desiredParts = getBodyForRole(targetRole, creep.room.energyCapacityAvailable);
    const creepParts = creep.body.map(p => p.type);
  
    // Check if creep has at least all unique parts from desired config
    const required = new Set(desiredParts);
    for (const part of required) {
      if (!creepParts.includes(part)) return false;
    }
    return true;
}

export function manageRoles(): void {
  if (Game.time % ROLE_REEVALUATION_INTERVAL !== 0) return;

  for (const room of Object.values(Game.rooms)) {
    const demand = determineRoleDemand(room);

    for (const role of Object.keys(demand) as Role[]) {
      const desired = demand[role];

      const candidates = Object.values(Game.creeps).filter(c =>
        c.memory.role !== role &&
        (!c.memory.lockUntil || Game.time >= c.memory.lockUntil) &&
        hasCompatibleBody(c, role)
      );

      const currentRoleCounts: Record<Role, number> = {
        harvester: 0,
        upgrader: 0,
        builder: 0,
      };

      for (const creep of Object.values(Game.creeps)) {
        currentRoleCounts[creep.memory.role] =
          (currentRoleCounts[creep.memory.role] || 0) + 1;
      }

      if (currentRoleCounts[role] >= desired) continue;

      // Find a creep in another role to switch to the needed role
      const reassigned = candidates.find(c => {
        const currentCount = currentRoleCounts[c.memory.role];
        const neededForThatRole = demand[c.memory.role] ?? 0;
      
        // ✅ Always allow reassignment if the current role has zero demand
        return neededForThatRole === 0 || currentCount > neededForThatRole;
      });

      if (reassigned) {
        console.log(`🔁 ${reassigned.name}: ${reassigned.memory.role} → ${role}`);
        reassigned.memory.role = role;
        reassigned.memory.lockUntil = Game.time + ROLE_LOCK_DURATION;
        break; // reassign one per tick
      } else {
        console.log(`⚠️ No reassignable creeps found for role '${role}'`);
        console.log(`  Needed: ${desired}, Current: ${currentRoleCounts[role]}`);
        console.log(`  Candidates:`, candidates.map(c => `${c.name} (${c.memory.role})`));
      }      
    }
  }
}
