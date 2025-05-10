import { Role } from "./roles";

declare global {
    interface CreepMemory {
      role: Role; // or any other roles you use
      working?: boolean;
    }
  }
  
  export {};
  