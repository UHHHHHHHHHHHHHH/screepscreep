import { roleHarvester } from "./role.harvester";
import { roleUpgrader } from "./role.upgrader";

export function loop() {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    switch (creep.memory.role) {
      case "harvester":
        roleHarvester.run(creep);
        break;
      case "upgrader":
        roleUpgrader.run(creep);
        break;
    }
  }
}
