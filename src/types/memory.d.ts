import { Role } from "./roles";

declare global {
    interface CreepMemory {
      role: Role; // or any other roles you use
      working?: boolean;
      lockUntil?: number;
      sourceId?: Id<Source>;
      containerId?: Id<StructureContainer> | null;
    }
    interface RoomMemory {
      containerPositions?: {
        [sourceId: string]: { x: number, y: number };
      };
      spawnQueue?: SpawnRequest[];
    }
    interface SpawnRequest {
      role: Role;
      opts?: any;          // e.g. { sourceId, containerId, … }
      timestamp: number;   // when it was enqueued (for debugging/prioritization)
    }
  }
  export {};
  