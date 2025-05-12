import { BaseRole } from "./base";

export class MinerRole extends BaseRole {
  run(creep: Creep): void {
    const sourceId = creep.memory.sourceId;
    const positions = creep.room.memory.containerPositions;

    if (!sourceId) {
      creep.say("❓ no src");
      return;
    }

    if (!positions || !positions[sourceId]) {
      creep.say("❌ no pos");
      return;
    }

    // grab the cached coords
    const { x, y } = positions[sourceId];
    const containerPos = new RoomPosition(x, y, creep.room.name);

    // move onto the container tile
    if (!creep.pos.isEqualTo(containerPos)) {
      creep.moveTo(containerPos, { visualizePathStyle: { stroke: "#ffaa00" }} );
      return;
    }

    // once in place, harvest from the source
    const source = Game.getObjectById<Source>(sourceId);
    if (!source) {
      creep.say("❓ src gone");
      return;
    }

    const result = creep.harvest(source);
    if (result !== OK) creep.say("💀 fail");
  }
}
