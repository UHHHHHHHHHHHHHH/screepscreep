import { BaseRole } from "./base";

export class MinerRole extends BaseRole {
    run(creep: Creep): void {
        const sourceId = creep.memory.sourceId;
        const source = sourceId ? Game.getObjectById<Source>(sourceId) : null;

        if (!source) {
            creep.say("❓ no src");
            return;
        }

        // Move to container near source if not already there
        if (!creep.pos.isNearTo(source)) {
            creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
            return;
        }

        // Harvest if in range
        if (creep.harvest(source) !== OK) {
            creep.say("❌ can't mine");
        }
    }
}
