import { isRoleDemandSatisfied } from "../roles/roleDemand";

export function handleIdle(creep: Creep): void {
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        const pile = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
        });
        if (pile) {
            if (creep.pickup(pile) === ERR_NOT_IN_RANGE) {
                creep.moveTo(pile);
            }
            return;
        }
    }

    // 1. Build if there are construction sites
    const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (sites.length > 0) {
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) !== 0) {
            // Get energy from containers
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.store[RESOURCE_ENERGY] > 0,
            });

            if (containers.length > 0) {
                if (creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(containers[0]);
                }
                return;
            }
        } else {
            const target = creep.pos.findClosestByPath(sites);
            if (target && creep.build(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
            return;
        }
    }

    // 2. Upgrade controller if nothing to build
    const controller = creep.room.controller;
    if (controller && isRoleDemandSatisfied(creep.room)) {
        // Energy check (optional)
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s): s is StructureContainer =>
                s.structureType === STRUCTURE_CONTAINER &&
                s.store[RESOURCE_ENERGY] > 0,
        });

        const totalStored = containers.reduce(
            (sum, c) => sum + c.store[RESOURCE_ENERGY],
            0
        );

        const threshold = 200;

        if (totalStored >= threshold || creep.room.energyAvailable >= threshold) {
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) !== 0) {
                if (containers.length > 0) {
                    if (creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(containers[0]);
                    }
                    return;
                }
            } else {
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller);
                }
                return;
            }
        }
    }

    // 3. No tasks found
    creep.say("🪑 idle");
}
