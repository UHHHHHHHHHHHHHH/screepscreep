import { countCreepsByRole } from '../../src/managers/creepManager';
// Define Role enum locally based on src/types/roles.ts
enum Role {
    Harvester = 'harvester',
    Upgrader = 'upgrader',
    Builder = 'builder',
    Miner = 'miner',
    Hauler = 'hauler',
}

// Mock global Game object and its properties
// @ts-ignore
global.Game = {
  creeps: {},
  time: 0,
};

// Mock console for warning messages
global.console = {
    ...global.console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Helper to create a mock creep with essential properties
function createMockCreep(name: string, role: Role | string | undefined, roomName: string, spawning = false, otherMemory = {}): Creep {
    return {
        name,
        spawning,
        room: { name: roomName } as Room, // Assume Room only needs 'name' for these tests
        memory: { role, ...otherMemory } as CreepMemory,
        // Add other essential Creep properties if required by the type, even if not directly used:
        id: name as Id<Creep>, // Simple ID from name
        body: [],
        carry: { energy: 0 } as StoreDefinition, // Mock store
        carryCapacity: 50,
        fatigue: 0,
        hits: 100,
        hitsMax: 100,
        my: true,
        owner: { username: 'player' },
        saying: undefined,
        store: { getCapacity: () => 50, getUsedCapacity: () => 0, energy: 0 } as Store<RESOURCE_ENERGY, false>,
        ticksToLive: 1500,
        // Mock methods - only if they are called by the function under test (not the case here)
        move: jest.fn(),
        moveTo: jest.fn(),
        transfer: jest.fn(),
        withdraw: jest.fn(),
        harvest: jest.fn(),
        upgradeController: jest.fn(),
        build: jest.fn(),
        // ... any other methods or properties needed to satisfy the Creep type
        prototype: undefined, // Required by type, but not used
    } as unknown as Creep; // Use unknown as Creep to bypass strict type checks for unmocked methods if many
}


describe('CreepManager: countCreepsByRole', () => {
  let mockRoom: Room;

  beforeEach(() => {
    Game.creeps = {};
    Game.time = 1;
    (console.log as jest.Mock).mockClear();

    mockRoom = {
      name: 'W1N1',
    } as Room;
  });

  test('should return all roles with 0 counts for an empty room', () => {
    const counts = countCreepsByRole(mockRoom);
    expect(counts[Role.Harvester]).toBe(0);
    expect(counts[Role.Upgrader]).toBe(0);
    expect(counts[Role.Builder]).toBe(0);
    expect(counts[Role.Miner]).toBe(0);
    expect(counts[Role.Hauler]).toBe(0);
    expect(Object.keys(counts).length).toBe(Object.keys(Role).length);
  });

  test('should correctly count creeps of various roles in the specified room', () => {
    Game.creeps = {
      harvester1: createMockCreep('harvester1', Role.Harvester, mockRoom.name),
      harvester2: createMockCreep('harvester2', Role.Harvester, mockRoom.name),
      upgrader1: createMockCreep('upgrader1', Role.Upgrader, mockRoom.name),
      builder1: createMockCreep('builder1', Role.Builder, mockRoom.name),
    };
    const counts = countCreepsByRole(mockRoom);
    expect(counts[Role.Harvester]).toBe(2);
    expect(counts[Role.Upgrader]).toBe(1);
    expect(counts[Role.Builder]).toBe(1);
    expect(counts[Role.Miner]).toBe(0);
    expect(counts[Role.Hauler]).toBe(0);
  });

  test('should ignore creeps in different rooms', () => {
    Game.creeps = {
      harvester1W1N1: createMockCreep('harvester1W1N1', Role.Harvester, mockRoom.name),
      harvester1W1N2: createMockCreep('harvester1W1N2', Role.Harvester, 'W1N2'), // Different room
    };
    const counts = countCreepsByRole(mockRoom);
    expect(counts[Role.Harvester]).toBe(1);
  });

  test('should ignore spawning creeps', () => {
    Game.creeps = {
      harvester1: createMockCreep('harvester1', Role.Harvester, mockRoom.name, true), // Spawning
      upgrader1: createMockCreep('upgrader1', Role.Upgrader, mockRoom.name, false),
    };
    const counts = countCreepsByRole(mockRoom);
    expect(counts[Role.Harvester]).toBe(0);
    expect(counts[Role.Upgrader]).toBe(1);
  });

  test('should ignore creeps with unknown roles and log a warning periodically', () => {
    Game.time = 100;
    const unknownRole = 'unknownRole';
    Game.creeps = {
      harvester1: createMockCreep('harvester1', Role.Harvester, mockRoom.name),
      unknownRoleCreep: createMockCreep('unknownRoleCreep', unknownRole, mockRoom.name),
    };
    // Temporarily modify the type of memory for unknownRoleCreep for this test
    (Game.creeps.unknownRoleCreep.memory as any).role = unknownRole;

    const counts = countCreepsByRole(mockRoom);
    expect(counts[Role.Harvester]).toBe(1);
    expect(counts[unknownRole as Role]).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith(
      `Warning: Creep unknownRoleCreep in room ${mockRoom.name} has an unknown role: '${unknownRole}'`
    );

    (console.log as jest.Mock).mockClear();
    Game.time = 101;
    const anotherUnknownRole = 'anotherUnknownRole';
    Game.creeps['anotherUnknown'] = createMockCreep('anotherUnknown', anotherUnknownRole, mockRoom.name);
    (Game.creeps.anotherUnknown.memory as any).role = anotherUnknownRole;
    countCreepsByRole(mockRoom);
    expect(console.log).not.toHaveBeenCalled();
  });

   test('should correctly initialize all roles to 0 even if some creeps have those roles but are in wrong room/spawning', () => {
    Game.creeps = {
      harvester_other_room: createMockCreep('h_other', Role.Harvester, 'W1N2'),
      upgrader_spawning: createMockCreep('u_spawning', Role.Upgrader, mockRoom.name, true),
      builder_ok: createMockCreep('b_ok', Role.Builder, mockRoom.name),
    };
    const counts = countCreepsByRole(mockRoom);
    expect(counts[Role.Harvester]).toBe(0);
    expect(counts[Role.Upgrader]).toBe(0);
    expect(counts[Role.Builder]).toBe(1);
    expect(counts[Role.Miner]).toBe(0);
    expect(counts[Role.Hauler]).toBe(0);
  });

  test('should handle creep memory without a role property (role is undefined)', () => {
    Game.time = 200;
    Game.creeps = {
      noRoleCreep: createMockCreep('noRoleCreep', undefined, mockRoom.name), // Role is undefined
      harvester1: createMockCreep('harvester1', Role.Harvester, mockRoom.name),
    };
    const counts = countCreepsByRole(mockRoom);
    expect(counts[Role.Harvester]).toBe(1);
    expect(console.log).toHaveBeenCalledWith(
      `Warning: Creep noRoleCreep in room ${mockRoom.name} has an unknown role: 'undefined'`
    );
  });
});

// Note: manageCreepRoles tests are omitted as the function was not found in creepManager.ts
// The global type declarations for CreepMemory etc. have been removed to rely on project/Screeps types.
// This should resolve TS2687 and TS2717.
// The createMockCreep helper is used to provide more complete Creep objects to resolve TS2352.
// Forcing memory.role to 'any' for specific tests on unknown roles.
