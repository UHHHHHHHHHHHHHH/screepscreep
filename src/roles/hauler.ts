import { BaseRole } from "./base";
import { handleIdle } from "../managers/idleHelper";

export class HaulerRole extends BaseRole {
    run(creep: Creep): void {
        this.updateWorkingState(creep);

        if (creep.memory.atCapacity) {
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
            });

            if (targets.length > 0) {
                if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
                return;
            }
        }

        const container = creep.memory.containerId
            ? Game.getObjectById<StructureContainer>(creep.memory.containerId)
            : null;

        if (container && container.store[RESOURCE_ENERGY] > 0) {
            if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container);
            }
            return;
        }

        handleIdle(creep);
    }
}
