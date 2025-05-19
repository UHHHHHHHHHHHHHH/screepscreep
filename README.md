# Screeps AI Project Architecture (screepscreep)

## 1. Overview & Philosophy
This Screeps AI is designed to manage an empire, focusing on efficient resource gathering, construction, and creep role management. It utilizes a modular TypeScript structure with distinct managers for various game aspects and class-based roles for creep behavior. The AI aims for clarity, maintainability, and adaptability, leveraging TypeScript's type safety and a clear separation of concerns between modules.

## 2. Core Concepts in Screeps (and how this AI uses them)

*   **Game Loop (`main.ts`):** The `loop` function in `main.ts` is the entry point, executed every game tick.
    *   It begins by cleaning stale creep memory via `memoryManager.cleanCreepMemory()`.
    *   It then iterates through all owned rooms:
        *   Calls `spawnManager.manageSpawns()` for the first available spawn in each room.
        *   Periodically calls `spawnManager.refreshSpawnQueue()` for each room to update the spawn queue based on current needs (this call might be further optimized or moved based on frequency needs).
        *   Periodically calls `constructionManager.manageConstruction()` to handle building projects.
        *   Periodically calls `resourceManager.logRoomEnergyStats()` to log energy statistics.
    *   Finally, it iterates through all creeps, retrieving their assigned role from `creep.memory.role` and executing the `run(creep)` method of the corresponding role module instance.

*   **Memory (`Memory` global, `types/memory.d.ts`):**
    *   The structure of the global `Memory` object, particularly `CreepMemory` and `RoomMemory`, is defined in `types/memory.d.ts`. This includes `SpawnRequest` and `RoleDemandEntry` structures.
    *   `Memory.creeps[creepName].role` is crucial for determining creep behavior.
    *   `RoomMemory.spawnQueue` holds `SpawnRequest` objects.
    *   `RoomMemory.containerPositions` stores locations for containers near sources.
    *   `RoomMemory.roadSitesPlanned` stores coordinates for future roads.
    *   `RoomMemory.resourceStats` caches energy statistics.
    *   `RoomMemory.roleDemandOverrides` allows manual adjustment of creep counts.

*   **Rooms (`managers/roomManager.ts`, `main.ts`):**
    *   `main.ts` iterates through `Game.rooms` for room-specific manager calls.
    *   `roomManager.getRoomPhase()` determines a room's development stage, influencing decisions in `constructionManager` and `roleDemandManager`.
    *   Further room-specific strategies (e.g., defense, remote mining setup) would be centralized in `roomManager.ts`.

*   **Spawning (`managers/spawnManager.ts`, `managers/roleDemandManager.ts`, `roles/roleBodies.ts`):**
    *   **Demand Calculation (`roleDemandManager.ts`):**
        *   `determineRoleDemand()` calculates the desired number of creeps for each role per room.
        *   It returns a `RoleDemandMap`, where each entry can specify `count`, `maxCost` (for budget-constrained creeps like emergency harvesters), `isEmergency` status, and `priority`.
        *   This logic considers room phase, existing structures, creep counts, and critical conditions (e.g., economic collapse).
    *   **Body Generation (`roleBodies.ts`):**
        *   `getBodyForRole()` generates a creep body based on the role, the energy available for construction (either `room.energyCapacityAvailable` or a `maxCost` from demand), and an `isEmergencyBuild` flag.
    *   **Queue Management (`spawnManager.ts`):**
        *   `refreshSpawnQueue()` (called periodically per room) updates `room.memory.spawnQueue`. It compares current demand (from `roleDemandManager`) with live creeps and the existing queue.
        *   It prunes unneeded requests and appends new ones based on demand priority. For new requests, it calls `getBodyForRole()` with appropriate energy constraints (e.g., `maxCost` for emergency roles, `room.energyCapacityAvailable` for standard roles).
        *   Emergency harvester requests are prioritized and placed at the front of the queue.
    *   **Actual Spawning (`spawnManager.ts`):**
        *   `manageSpawns()` is called for each spawn. If not busy and `room.energyAvailable` meets the `cost` of the first `SpawnRequest` in the queue, it attempts to spawn the creep.

*   **Creeps & Roles (`roles/`, `managers/roleManager.ts`):**
    *   Creep roles are defined as classes (e.g., `HarvesterRole`, `BuilderRole`) in the `roles/` directory, inheriting from `BaseRole` (`roles/base.ts`).
    *   `main.ts` maintains a `roleModules` mapping to instantiate and access these role objects for dispatching the `run(creep)` method.
    *   `creep.memory.role` dictates behavior. `BaseRole.collectEnergy()` now conditionally avoids withdrawing from spawns/extensions if the spawn queue is active.
    *   `roleConfigs.ts` defines base configurations for roles (ratios, fallback bodies, min energy for ratio).
    *   `roleManager.ts` (currently unused in `main.ts`) could potentially handle dynamic role reassignment in the future.

*   **Managers (`managers/`):**
    *   This directory contains modules for specific, high-level AI aspects:
        *   `constructionManager.ts`: Manages automated placement of construction sites for extensions, containers, and delegates road construction to `roadManager.ts`, based on room phase.
        *   `creepManager.ts`: Provides utility functions, currently `countCreepsByRole()`.
        *   `idleHelper.ts`: Provides fallback logic for creeps without active tasks, directing them to pickup energy, build, or upgrade.
        *   `memoryManager.ts`: `cleanCreepMemory()` removes memory for dead creeps.
        *   `resourceManager.ts`: Calculates, caches (`room.memory.resourceStats`), and logs energy statistics for rooms.
        *   `roadManager.ts`: Plans road networks (e.g., sources to spawn, spawn to controller) once and incrementally builds them.
        *   `roleDemandManager.ts`: Calculates detailed creep role needs per room (count, maxCost, emergency status, priority).
        *   `roomManager.ts`: Currently provides `getRoomPhase()` to define room development stages.
        *   `spawnManager.ts`: Manages the `room.memory.spawnQueue` and executes spawning at structures.

*   **Utilities (`utils/`):**
    *   `profiler.ts`: A simple wrapper for CPU performance monitoring of functions.

*   **Types (`types/`):**
    *   Contains TypeScript definition files:
        *   `memory.d.ts`: Defines custom `Memory` structures (e.g., `CreepMemory`, `RoomMemory`, `SpawnRequest`, `RoleDemandEntry`, `RoleDemandMap`).
        *   `roles.ts`: Defines the `Role` enum.

## 3. Directory Structure

src/
├── main.ts # Main game loop entry point
├── managers/ # Modules for managing specific game aspects
│ ├── constructionManager.ts
│ ├── creepManager.ts
│ ├── idleHelper.ts
│ ├── memoryManager.ts
│ ├── resourceManager.ts
│ ├── roadManager.ts
│ ├── roleDemandManager.ts
│ ├── roleManager.ts # Currently unused, for potential future role reassignment
│ ├── roomManager.ts
│ └── spawnManager.ts
├── roles/ # Creep role logic and configurations
│ ├── base.ts # Base class for all creep roles
│ ├── builder.ts
│ ├── harvester.ts
│ ├── hauler.ts
│ ├── miner.ts
│ ├── roleBodies.ts # Generates creep body part arrays
│ ├── roleConfigs.ts # Configurations for creep roles (ratios, fallbacks)
│ └── upgrader.ts
├── types/ # TypeScript type definitions
│ ├── memory.d.ts # Defines structure of Memory, SpawnRequest, RoleDemandEntry etc.
│ └── roles.ts # Defines the Role enum
└── utils/ # Utility functions and modules
└── profiler.ts # Simple performance profiler


## 4. Data Flow Example: Creep Spawning (Revised)

1.  **Demand Assessment (`main.ts` calls `roleDemandManager.determineRoleDemand()` via `refreshSpawnQueue`):**
    *   `roleDemandManager.determineRoleDemand(room)` is called. It assesses current creep population (`creepManager.countCreepsByRole`), room phase (`roomManager.getRoomPhase`), available resources (`resourceManager.getRoomResourceStats`), and other conditions.
    *   It returns a `RoleDemandMap` detailing for each `Role`: desired `count`, and if applicable, `maxCost`, `isEmergency`, and `priority`. For an emergency, it might demand 1 Harvester with a low `maxCost` and high `priority`.

2.  **Queue Refresh (`main.ts` calls `spawnManager.refreshSpawnQueue()` periodically):**
    *   `spawnManager.refreshSpawnQueue(room)` takes the `RoleDemandMap`.
    *   It filters the existing `room.memory.spawnQueue`, removing requests no longer justified.
    *   It iterates through the `RoleDemandMap` (respecting `priority`). For unmet demands:
        *   It calls `roles.roleBodies.getBodyForRole(role, energyForBody, isEmergency)`, where `energyForBody` is `demand.maxCost` (if set, e.g., for emergency harvester using `room.energyAvailable`) or `room.energyCapacityAvailable` (for standard creeps). `isEmergency` is passed from the demand.
        *   A `SpawnRequest` object (containing the generated `body`, `name`, `memory`, `cost`) is created.
        *   Emergency requests are added to the front of `newQueue`; others are added based on demand priority relative to other new needs.
    *   The `room.memory.spawnQueue` is updated.

3.  **Spawning Attempt (`main.ts` calls `spawnManager.manageSpawns()`):**
    *   `spawnManager.manageSpawns(spawn)` checks the first `SpawnRequest` in `room.memory.spawnQueue`.
    *   If `spawn.room.energyAvailable >= request.cost`, `spawn.spawnCreep(request.body, request.name, { memory: request.memory })` is called.
    *   On success, the request is removed from the queue.

## 5. Key Modules/Files (and their primary responsibility - Revised)

*   `main.ts`: Orchestrates the main game loop, calling managers for room-level operations (spawning, construction, stats) and then executing individual creep role logic.
*   `managers/roleDemandManager.ts`: The central brain for deciding *what* creeps are needed, *how many*, and under *what constraints* (e.g., cost for emergencies).
*   `roles/roleBodies.ts`: Responsible for translating a role, energy budget, and emergency status into an optimal `BodyPartConstant[]` array.
*   `managers/spawnManager.ts`: Manages the `room.memory.spawnQueue` by processing demands from `roleDemandManager` and body definitions from `roleBodies`, and handles the actual `spawnCreep` calls.
*   `managers/constructionManager.ts`: Manages automated construction of extensions, containers, and delegates road building, driven by room phase.
*   `managers/memoryManager.ts`: Handles cleanup of game memory (e.g., for dead creeps).
*   `roles/base.ts`: Provides a foundational class for all creep roles, including shared logic like energy collection (now with spawn queue awareness) and delivery.
*   `roles/<roleName>.ts` (e.g., `harvester.ts`): Implements the specific logic for a given creep role.
*   `types/memory.d.ts`: Defines all custom `Memory` structures, crucial for type safety and understanding data organization.
*   `managers/roomManager.ts`: Defines room development stages (`getRoomPhase()`) influencing strategic decisions.

## 6. Future Development / Potential TODOs

*   **Room Manager Expansion:**
    *   Implement more sophisticated room-level strategies in `roomManager.ts` (e.g., defense posture, requesting scouts, managing remote mining operations, tower targeting logic).
    *   Centralize decisions about when a room should expand (e.g., claim new rooms, send settlers).
*   **Role Manager Integration (`roleManager.ts`):**
    *   Implement dynamic role reassignment for idle or underutilized creeps if critical needs arise elsewhere.
*   **Advanced Spawning Logic:**
    *   More granular prioritization within the spawn queue (e.g., hauler for a specific productive miner before other less critical roles).
    *   Support for multiple spawns per room with intelligent spawn selection.
*   **Construction Enhancements:**
    *   More dynamic extension placement algorithms (e.g., based on stamp patterns or pathing).
    *   Automated placement of other structures: Towers, Storage, Terminal, Labs, Nuker, Observer, Power Spawn, Factories.
    *   Automated rampart/wall placement strategies.
*   **Resource Management:**
    *   Track other resources (minerals, compounds) in `resourceManager.ts`.
    *   Implement logic for market transactions or resource balancing between rooms.
*   **Combat System:**
    *   Define combat roles and squad-based tactics.
    *   Automated defense responses.
*   **Inter-Room Operations:**
    *   Logistics for remote mining and energy/resource transport between rooms.
    *   Scouting and room reservation.
*   **UI/Visuals:**
    *   More comprehensive `RoomVisual` overlays for debugging and status monitoring.
*   **Memory Optimization:**
    *   Regularly review memory usage and implement strategies to reduce it if it becomes a bottleneck (e.g., using short-hand keys, cleaning up stale memory sections beyond just creeps).
*   **Testing Framework:**
    *   Consider setting up unit tests or simulation tests for key logic components.
