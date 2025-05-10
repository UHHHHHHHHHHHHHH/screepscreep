import { BaseRole } from "./base";

export class HaulerRole extends BaseRole {
    run(creep: Creep): void {
        this.updateWorkingState(creep);

        if (creep.memory.working) {
            // Deliver to spawn/extensions
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
            });

            if (targets.length > 0) {
                if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
            }
        } else {
            // Withdraw from containers
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.store[RESOURCE_ENERGY] > 0,
            });

            if (containers.length > 0) {
                if (creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(containers[0]);
                }
            } else {
                creep.say("❌ no energy");
            }
        }
    }
}
