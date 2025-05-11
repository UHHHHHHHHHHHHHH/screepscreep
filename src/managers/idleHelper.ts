export function handleIdle(creep: Creep): void {
    // 1. Build if there are construction sites
    const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (sites.length > 0) {
        if (creep.store[RESOURCE_ENERGY] === 0) {
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
    if (controller) {
        if (creep.store[RESOURCE_ENERGY] === 0) {
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
            if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller);
            }
            return;
        }
    }

    // 3. No tasks found
    creep.say("🪑 idle");
}
