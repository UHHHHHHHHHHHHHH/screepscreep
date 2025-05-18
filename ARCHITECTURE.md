# Screeps AI Project Architecture

## 1. Overview & Philosophy
This Screeps AI is designed to manage an empire, focusing on efficient resource gathering, construction, and creep role management. It utilizes a modular TypeScript structure with distinct managers for various game aspects and class-based roles for creep behavior. The AI aims for clarity and maintainability, leveraging TypeScript's type safety.

## 2. Core Concepts in Screeps (and how this AI uses them)
*   **Game Loop (`main.ts`):** The `loop` function in `main.ts` is the entry point, executed every game tick.
    *   It begins by cleaning stale creep memory (`memoryManager.ts`).
    *   It then handles spawning logic for the first available spawn (`spawnManager.ts`).
    *   It iterates through all owned rooms to manage construction (`constructionManager.ts`) and log energy statistics (`resourceManager.ts` periodically).
    *   Finally, it iterates through all creeps, retrieving their assigned role from `creep.memory.role` and executing the `run` method of the corresponding role module.
*   **Memory (`Memory` global, `types/memory.d.ts`):**
    *   The structure of the global `Memory` object is (or will be) defined in `types/memory.d.ts`.
    *   `Memory.creeps[creepName].role` is crucial for determining creevp behavior.
    *   Other memory structures are likely managed by specific managers (e.g., `Memory.rooms` by `roomManager.ts` or other relevant managers).
*   **Rooms:**
    *   Currently, `main.ts` iterates through `Game.rooms` for basic tasks like construction (`manageConstruction`) and stats logging (`logRoomEnergyStats`).
    *   A dedicated `roomManager.ts` exists, suggesting more comprehensive room-level strategy and management is planned or implemented there.
*   **Spawning (`managers/spawnManager.ts`):**
    *   The `manageSpawns` function from `spawnManager.ts` is responsible for deciding what creeps to spawn.
    *   The `roleDemandManager.ts` likely plays a role in determining the required number of creeps for each role, which `spawnManager.ts` would then fulfill.
*   **Creeps & Roles (`roles/`, `managers/roleManager.ts`):**
    *   Creep roles are defined as classes (e.g., `HarvesterRole`, `BuilderRole`) in the `roles/` directory, likely inheriting from a `BaseRole` (`roles/base.ts`).
    *   `main.ts` maintains a `roleModules` mapping to instantiate and access these role objects.
    *   Each creep has a `creep.memory.role` (of type `Role` from `types/roles.ts`) which dictates its behavior. The `run(creep)` method on the role object is called for each creep.
    *   `roleBodies.ts` likely defines standard body part compositions for different roles.
    *   `roleConfigs.ts` might hold configurations like target counts or specific settings for roles.
    *   `roleManager.ts` (currently commented out in `main.ts`) might provide higher-level orchestration or assignment logic for roles, or was part of a previous design.
*   **Managers (`managers/`):**
    *   This directory contains modules responsible for specific, high-level aspects of the AI:
        *   `constructionManager.ts`: Handles placement and management of construction sites.
        *   `creepManager.ts`: Likely for general creep management tasks beyond individual role execution.
        *   `idleHelper.ts`: Potentially helps idle creeps find tasks or move to standby positions.
        *   `memoryManager.ts`: Cleans and manages the `Memory` object.
        *   `resourceManager.ts`: Tracks and manages resources, including logging stats.
        *   `roadManager.ts`: Manages road planning and maintenance.
        *   `roleDemandManager.ts`: Calculates the required number of creeps per role.
        *   `roomManager.ts`: Overall management of individual room strategies, defenses, and resource exploitation.
        *   `spawnManager.ts`: Manages the creep spawning process.
*   **Utilities (`utils/`):**
    *   `profiler.ts`: Provides a simple profiling wrapper for performance monitoring.
*   **Types (`types/`):**
    *   Contains TypeScript definition files for custom types used throughout the project, such as `memory.d.ts` for `Memory` structure and `roles.ts` for role-related enums or types.

## 3. Directory Structure
```bash
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
    │ ├── roleManager.ts # (Currently unused in main.ts)
    │ ├── roomManager.ts
    │ └── spawnManager.ts
    ├── roles/ # Creep role logic and configurations
    │ ├── base.ts # Base class for roles
    │ ├── builder.ts
    │ ├── harvester.ts
    │ ├── hauler.ts
    │ ├── miner.ts
    │ ├── roleBodies.ts # Body part definitions for roles
    │ ├── roleConfigs.ts# Configurations for roles
    │ └── upgrader.ts
    ├── types/ # TypeScript type definitions
    │ ├── memory.d.ts # Structure of the global Memory object
    │ └── roles.ts # Role-related enums or types
    └── utils/ # Utility functions and modules
    └── profiler.ts # Performance profiler
```

## 4. Data Flow Examples (High-Level)
*   **Creep Spawning:**
    1.  `roleDemandManager.ts` (likely) assesses current creep population against targets defined perhaps in `roleConfigs.ts` or room memory.
    2.  It communicates a need for a specific role to `spawnManager.ts`.
    3.  `spawnManager.ts` (via `manageSpawns` in `main.ts`) checks available energy and selects an appropriate body from `roleBodies.ts`.
    4.  `Spawn.spawnCreep()` is called with the chosen body and initial memory (including `memory.role`).
*   **Creep Action Execution:**
    1.  `main.ts` iterates through `Game.creeps`.
    2.  For each creep, `creep.memory.role` is read.
    3.  The corresponding role instance (e.g., `new HarvesterRole()`) is retrieved from `roleModules`.
    4.  The `roleInstance.run(creep)` method is called, executing the role-specific logic for that tick.

## 5. Key Modules/Files (and their primary responsibility)
*   `main.ts`: Orchestrates the main game loop, calling various managers and role execution logic.
*   `managers/spawnManager.ts`: Manages the spawning of new creeps based on demand.
*   `managers/constructionManager.ts`: Manages construction projects within rooms.
*   `managers/memoryManager.ts`: Handles cleanup and potentially initialization of game memory.
*   `roles/base.ts`: Provides a foundational class or interface for all creep roles.
*   `roles/<roleName>.ts` (e.g., `harvester.ts`): Implements the specific logic and behavior for a given creep role.
*   `types/memory.d.ts`: Defines the expected structure of the `Memory` object for type safety.

## 6. Future Development / TODOs (Optional)
*   Integrate `roomManager.ts` more deeply for room-specific strategies.
*   Refine or integrate `roleManager.ts` if it serves a distinct purpose from the current role execution model.
*   Expand on `idleHelper.ts` functionality.
*   Develop more sophisticated resource management in `resourceManager.ts`.
*   Implement road planning and building via `roadManager.ts`.
