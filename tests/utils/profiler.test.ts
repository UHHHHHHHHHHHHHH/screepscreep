import { profile } from '../../src/utils/profiler';

describe('Profiler', () => {
  let mockGetUsed: jest.SpyInstance;
  let mockLog: jest.SpyInstance;

  beforeEach(() => {
    // Mock Game.cpu.getUsed
    mockGetUsed = jest.spyOn(Game.cpu, 'getUsed');
    // Mock console.log
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {
      // Do nothing
    });
  });

  afterEach(() => {
    // Restore original implementations
    mockGetUsed.mockRestore();
    mockLog.mockRestore();
  });

  test('should execute the function and log CPU usage', () => {
    mockGetUsed.mockReturnValueOnce(10).mockReturnValueOnce(20);
    const mockFn = jest.fn(() => 'test result');

    const result = profile('testLabel', mockFn);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result).toBe('test result');
    expect(mockGetUsed).toHaveBeenCalledTimes(2);
    expect(mockLog).toHaveBeenCalledWith('📊 testLabel: 10.00 CPU');
  });

  test('should handle functions that throw errors', () => {
    mockGetUsed.mockReturnValueOnce(5).mockReturnValueOnce(15);
    const errorFn = jest.fn(() => {
      throw new Error('Test error');
    });

    expect(() => profile('errorTest', errorFn)).toThrow('Test error');
    expect(errorFn).toHaveBeenCalledTimes(1);
    expect(mockGetUsed).toHaveBeenCalledTimes(2);
    expect(mockLog).toHaveBeenCalledWith('📊 errorTest: 10.00 CPU');
  });

  test('should correctly calculate CPU usage for zero duration', () => {
    mockGetUsed.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const mockFn = jest.fn();

    profile('zeroDurationTest', mockFn);

    expect(mockLog).toHaveBeenCalledWith('📊 zeroDurationTest: 0.00 CPU');
  });
});

// Mock Screeps Game object
if (typeof Game === 'undefined') {
  // @ts-ignore
  global.Game = {
    cpu: {
      getUsed: () => 0,
      limit: 20,
      tickLimit: 500,
      bucket: 10000,
      shardLimits: {},
      halt: (): never => { throw new Error('halt called'); },
      setShardLimits: (): 0 | -4 | -10 => 0,
      unlock: (): 0 | -6 | -8 => 0,
      generatePixel: (): 0 | -6 => 0,
      unlocked: false,
      unlockedTime: 0,
    },
    time: 1,
  };
}

// Mock console object if it doesn't exist
if (typeof console === 'undefined') {
  // @ts-ignore
  global.console = {
    log: () => {}, // Basic mock for console.log
  };
}
