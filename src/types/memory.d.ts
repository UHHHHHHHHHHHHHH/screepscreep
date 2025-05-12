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
      }
    }
  }
  
  export {};
  