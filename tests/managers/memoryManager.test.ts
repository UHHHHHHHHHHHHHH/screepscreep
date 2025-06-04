import { cleanCreepMemory } from '../../src/managers/memoryManager';

// Mock global objects
// @ts-ignore
global.Memory = {
  creeps: {},
  // other memory sections if needed by other tests/modules
};

// @ts-ignore
global.Game = {
  creeps: {},
  // other Game properties if needed
};

// Mock console
global.console = {
  ...global.console, // Preserve other console methods if any
  log: jest.fn(),
};

describe('MemoryManager: cleanCreepMemory', () => {
  beforeEach(() => {
    // Reset Memory and Game.creeps for each test to ensure a clean state
    Memory.creeps = {};
    Game.creeps = {};
    // Clear the console.log mock calls
    (console.log as jest.Mock).mockClear();
  });

  test('should do nothing if Memory.creeps is empty', () => {
    cleanCreepMemory();
    expect(Object.keys(Memory.creeps).length).toBe(0);
    expect(console.log).not.toHaveBeenCalled();
  });

  test('should do nothing if all creeps in Memory.creeps are alive in Game.creeps', () => {
    Memory.creeps['aliveCreep1'] = { role: 'harvester' } as any;
    Memory.creeps['aliveCreep2'] = { role: 'upgrader' } as any;
    Game.creeps['aliveCreep1'] = { name: 'aliveCreep1' } as any;
    Game.creeps['aliveCreep2'] = { name: 'aliveCreep2' } as any;

    cleanCreepMemory();

    expect(Memory.creeps['aliveCreep1']).toBeDefined();
    expect(Memory.creeps['aliveCreep2']).toBeDefined();
    expect(console.log).not.toHaveBeenCalled();
  });

  test('should delete memory for dead creeps (present in Memory.creeps but not in Game.creeps)', () => {
    Memory.creeps['aliveCreep'] = { role: 'builder' } as any;
    Memory.creeps['deadCreep1'] = { role: 'harvester' } as any;
    Memory.creeps['deadCreep2'] = { role: 'upgrader' } as any;
    Game.creeps['aliveCreep'] = { name: 'aliveCreep' } as any;

    cleanCreepMemory();

    expect(Memory.creeps['aliveCreep']).toBeDefined();
    expect(Memory.creeps['deadCreep1']).toBeUndefined();
    expect(Memory.creeps['deadCreep2']).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith('🧹 Cleaned up memory for dead creep: deadCreep1');
    expect(console.log).toHaveBeenCalledWith('🧹 Cleaned up memory for dead creep: deadCreep2');
    expect(console.log).toHaveBeenCalledTimes(2);
  });

  test('should handle Game.creeps being empty', () => {
    Memory.creeps['deadCreep1'] = { role: 'harvester' } as any;
    Memory.creeps['deadCreep2'] = { role: 'upgrader' } as any;
    // Game.creeps is already empty from beforeEach

    cleanCreepMemory();

    expect(Memory.creeps['deadCreep1']).toBeUndefined();
    expect(Memory.creeps['deadCreep2']).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith('🧹 Cleaned up memory for dead creep: deadCreep1');
    expect(console.log).toHaveBeenCalledWith('🧹 Cleaned up memory for dead creep: deadCreep2');
  });

  test('should correctly log names of cleaned creeps', () => {
    const creepNames = ['creepA', 'creepB', 'creepC'];
    creepNames.forEach(name => {
      Memory.creeps[name] = { someData: 'foo' } as any;
    });
    // Game.creeps is empty

    cleanCreepMemory();

    creepNames.forEach(name => {
      expect(Memory.creeps[name]).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(`🧹 Cleaned up memory for dead creep: ${name}`);
    });
    expect(console.log).toHaveBeenCalledTimes(creepNames.length);
  });
});

// Note: initializeRoomMemory tests are omitted as the function was not found in memoryManager.ts
// Relies on global 'Memory' and 'Game' objects being defined, which they are in this test setup.
// CreepMemory and Creep types are not strictly enforced on the mock data here (using 'as any')
// because cleanCreepMemory only checks for key existence and deletes.
// If initializeRoomMemory were present, more detailed RoomMemory and Room/Source object mocking would be needed.
