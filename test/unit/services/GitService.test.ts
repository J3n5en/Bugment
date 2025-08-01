import { spawn } from "child_process";

// Test the actual base SHA extraction logic
describe("PR Base SHA Fix", () => {
  test("should extract correct base SHA from merge commit", async () => {
    // Mock a merge commit scenario
    const mockMergeSha = "abc123def456";
    const mockBaseSha = "base123sha456";
    const mockHeadSha = "head123sha456";

    // Mock process.env.GITHUB_SHA
    const originalGithubSha = process.env.GITHUB_SHA;
    process.env.GITHUB_SHA = mockMergeSha;

    // Mock spawn to simulate git commands
    const originalSpawn = require("child_process").spawn;
    const mockSpawn = jest.fn().mockImplementation((command, args, options) => {
      if (command === "git") {
        // Handle git cat-file command (check if merge commit)
        if (
          args[0] === "cat-file" &&
          args[1] === "-p" &&
          args[2] === mockMergeSha
        ) {
          return {
            stdout: {
              on: (event: string, callback: Function) => {
                if (event === "data") {
                  // Simulate merge commit output with two parent lines
                  callback(
                    Buffer.from(
                      `tree abc123\nparent ${mockBaseSha}\nparent def456\nauthor Test\n`
                    )
                  );
                }
              },
            },
            stderr: {
              on: (event: string, callback: Function) => {
                // No error
              },
            },
            on: (event: string, callback: Function) => {
              if (event === "close") {
                callback(0); // Success
              }
            },
          };
        }

        // Handle git rev-parse command (get first parent)
        if (args[0] === "rev-parse" && args[1] === `${mockMergeSha}^1`) {
          return {
            stdout: {
              on: (event: string, callback: Function) => {
                if (event === "data") {
                  callback(Buffer.from(mockBaseSha + "\n"));
                }
              },
            },
            stderr: {
              on: (event: string, callback: Function) => {
                // No error
              },
            },
            on: (event: string, callback: Function) => {
              if (event === "close") {
                callback(0); // Success
              }
            },
          };
        }
      }
      return originalSpawn(command, args, options);
    });

    require("child_process").spawn = mockSpawn;

    try {
      // Import the GitService class after mocking
      const { GitService } = require("../../../src/services/GitService");
      const mockPrInfo = {
        number: 123,
        title: "Test PR",
        body: "Test body",
        baseSha: mockBaseSha,
        headSha: "head123",
        owner: "test-owner",
        repo: "test-repo",
      };
      const gitService = new GitService(mockPrInfo, "/mock/workspace");

      // Test the getActualBaseSha method
      const actualBaseSha = await (gitService as any).getActualBaseSha();

      expect(actualBaseSha).toBe(mockBaseSha);

      // Should first call git cat-file to check if it's a merge commit
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["cat-file", "-p", mockMergeSha],
        expect.objectContaining({
          cwd: "/mock/workspace",
          stdio: ["pipe", "pipe", "pipe"],
        })
      );

      // Then call git rev-parse to get the first parent
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        ["rev-parse", `${mockMergeSha}^1`],
        expect.objectContaining({
          cwd: "/mock/workspace",
          stdio: ["pipe", "pipe", "pipe"],
        })
      );
    } finally {
      // Restore original values
      process.env.GITHUB_SHA = originalGithubSha;
      require("child_process").spawn = originalSpawn;
    }
  });

  test("should fallback to original base SHA on git command failure", async () => {
    const mockMergeSha = "abc123def456";
    const originalBaseSha = "original123base456";

    // Mock process.env.GITHUB_SHA
    const originalGithubSha = process.env.GITHUB_SHA;
    process.env.GITHUB_SHA = mockMergeSha;

    // Mock spawn to simulate git command failure
    const originalSpawn = require("child_process").spawn;
    const mockSpawn = jest.fn().mockImplementation((command, args, options) => {
      if (command === "git") {
        // Handle git cat-file command (check if merge commit) - simulate success
        if (
          args[0] === "cat-file" &&
          args[1] === "-p" &&
          args[2] === mockMergeSha
        ) {
          return {
            stdout: {
              on: (event: string, callback: Function) => {
                if (event === "data") {
                  // Simulate merge commit output with two parent lines
                  callback(
                    Buffer.from(
                      `tree abc123\nparent ${originalBaseSha}\nparent def456\nauthor Test\n`
                    )
                  );
                }
              },
            },
            stderr: {
              on: (event: string, callback: Function) => {
                // No error
              },
            },
            on: (event: string, callback: Function) => {
              if (event === "close") {
                callback(0); // Success
              }
            },
          };
        }

        // Handle git rev-parse command - simulate failure
        if (args[0] === "rev-parse") {
          return {
            stdout: {
              on: (event: string, callback: Function) => {
                // No output
              },
            },
            stderr: {
              on: (event: string, callback: Function) => {
                if (event === "data") {
                  callback(Buffer.from("fatal: bad revision\n"));
                }
              },
            },
            on: (event: string, callback: Function) => {
              if (event === "close") {
                callback(1); // Failure
              }
            },
          };
        }
      }
      return originalSpawn(command, args, options);
    });

    require("child_process").spawn = mockSpawn;

    try {
      // Mock the prInfo to have original base SHA
      const { GitService } = require("../../../src/services/GitService");
      const mockPrInfo = {
        number: 123,
        title: "Test PR",
        body: "Test body",
        baseSha: originalBaseSha,
        headSha: "head123",
        owner: "test-owner",
        repo: "test-repo",
      };
      const gitService = new GitService(mockPrInfo, "/mock/workspace");

      // Test the getActualBaseSha method
      const actualBaseSha = await (gitService as any).getActualBaseSha();

      expect(actualBaseSha).toBe(originalBaseSha);
    } finally {
      // Restore original values
      process.env.GITHUB_SHA = originalGithubSha;
      require("child_process").spawn = originalSpawn;
    }
  });
});
