import { spawn } from 'child_process';

// Test the actual base SHA extraction logic
describe('PR Base SHA Fix', () => {
  test('should extract correct base SHA from merge commit', async () => {
    // Mock a merge commit scenario
    const mockMergeSha = 'abc123def456';
    const mockBaseSha = 'base123sha456';
    const mockHeadSha = 'head123sha456';
    
    // Mock process.env.GITHUB_SHA
    const originalGithubSha = process.env.GITHUB_SHA;
    process.env.GITHUB_SHA = mockMergeSha;
    
    // Mock spawn to simulate git rev-parse command
    const originalSpawn = require('child_process').spawn;
    const mockSpawn = jest.fn().mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse' && args[1] === `${mockMergeSha}^1`) {
        return {
          stdout: {
            on: (event: string, callback: Function) => {
              if (event === 'data') {
                callback(Buffer.from(mockBaseSha + '\n'));
              }
            }
          },
          stderr: {
            on: (event: string, callback: Function) => {
              // No error
            }
          },
          on: (event: string, callback: Function) => {
            if (event === 'close') {
              callback(0); // Success
            }
          }
        };
      }
      return originalSpawn(command, args, options);
    });
    
    require('child_process').spawn = mockSpawn;
    
    try {
      // Import the class after mocking
      const { BugmentAction } = require('../src/action');
      const action = new BugmentAction();
      
      // Test the getActualBaseSha method
      const actualBaseSha = await (action as any).getActualBaseSha('/mock/workspace');
      
      expect(actualBaseSha).toBe(mockBaseSha);
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['rev-parse', `${mockMergeSha}^1`],
        expect.objectContaining({
          cwd: '/mock/workspace',
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
    } finally {
      // Restore original values
      process.env.GITHUB_SHA = originalGithubSha;
      require('child_process').spawn = originalSpawn;
    }
  });

  test('should fallback to original base SHA on git command failure', async () => {
    const mockMergeSha = 'abc123def456';
    const originalBaseSha = 'original123base456';
    
    // Mock process.env.GITHUB_SHA
    const originalGithubSha = process.env.GITHUB_SHA;
    process.env.GITHUB_SHA = mockMergeSha;
    
    // Mock spawn to simulate git command failure
    const originalSpawn = require('child_process').spawn;
    const mockSpawn = jest.fn().mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        return {
          stdout: {
            on: (event: string, callback: Function) => {
              // No output
            }
          },
          stderr: {
            on: (event: string, callback: Function) => {
              if (event === 'data') {
                callback(Buffer.from('fatal: bad revision\n'));
              }
            }
          },
          on: (event: string, callback: Function) => {
            if (event === 'close') {
              callback(1); // Failure
            }
          }
        };
      }
      return originalSpawn(command, args, options);
    });
    
    require('child_process').spawn = mockSpawn;
    
    try {
      // Mock the prInfo to have original base SHA
      const { BugmentAction } = require('../src/action');
      const action = new BugmentAction();
      (action as any).prInfo = { baseSha: originalBaseSha };
      
      // Test the getActualBaseSha method
      const actualBaseSha = await (action as any).getActualBaseSha('/mock/workspace');
      
      expect(actualBaseSha).toBe(originalBaseSha);
    } finally {
      // Restore original values
      process.env.GITHUB_SHA = originalGithubSha;
      require('child_process').spawn = originalSpawn;
    }
  });
});
