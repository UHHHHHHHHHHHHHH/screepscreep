import { BaseRole } from "./base";

export class MinerRole extends BaseRole {
  run(creep: Creep): void {
    const sourceId = creep.memory.sourceId;
    const source = sourceId ? Game.getObjectById<Source>(sourceId) : null;

    if (!source) {
      creep.say("❓ no src");
      return;
    }

    // 🔍 Find the container near the source
    const container = creep.room.find(FIND_STRUCTURES, {
      filter: (s): s is StructureContainer =>
        s.structureType === STRUCTURE_CONTAINER &&
        s.pos.isNearTo(source.pos),
    })[0];

    if (!container) {
      creep.say("❌ no box");
      return;
    }

    // 🧭 Move onto the container tile
    if (!creep.pos.isEqualTo(container.pos)) {
      creep.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
      return;
    }

    // ⛏ Harvest once positioned
    const result = creep.harvest(source);
    if (result !== OK) {
      creep.say("💀 fail");
    }
  }
}
