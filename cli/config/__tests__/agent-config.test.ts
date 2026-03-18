/**
 * Tests for Agent Config Manager
 */

import * as os from 'os';
import * as path from 'path';
import {
  AgentConfigManager,
  type AgentConfig,
} from '../agent-config';

// Mock os operations
jest.mock('os');
const osMock = os as jest.Mocked<typeof os>;

describe('AgentConfigManager', () => {
  let manager: AgentConfigManager;

  beforeEach(() => {
    osMock.homedir.mockReturnValue('/mock');

    manager = new AgentConfigManager({
      global: '/etc/huinet',
      user: '/mock/.huinet',
      globalConfig: '/etc/huinet/config.yaml',
      userConfig: '/mock/.huinet/config.yaml',
      agentsConfig: '/mock/.huinet/agents.yaml',
    });
  });

  describe('getAgents and getAgent', () => {
    it('should return empty array initially', () => {
      expect(manager.getAgents()).toEqual([]);
      expect(manager.getAgent('non-existent')).toBeUndefined();
    });
  });

  describe('parseAgentsConfig', () => {
    it('should parse simple agent config', () => {
      const yamlContent = `
- id: "claude-code"
  name: "Claude Code"
  command: "/usr/local/bin/claude-code"
`;

      const agents = (manager as any).parseAgentsConfig(yamlContent);

      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual({
        id: 'claude-code',
        name: 'Claude Code',
        command: '/usr/local/bin/claude-code',
      });
    });

    it('should parse agent with args array', () => {
      const yamlContent = `
- id: "test"
  name: "Test"
  command: "/bin/test"
  args: ["--arg1", "--arg2"]
`;

      const agents = (manager as any).parseAgentsConfig(yamlContent);

      expect(agents[0].args).toEqual(['--arg1', '--arg2']);
    });

    it('should parse agent with boolean autoStart', () => {
      const yamlContent = `
- id: "test"
  name: "Test"
  command: "/bin/test"
  autoStart: true
`;

      const agents = (manager as any).parseAgentsConfig(yamlContent);

      expect(agents[0].autoStart).toBe(true);
    });

    it('should handle empty config', () => {
      const agents = (manager as any).parseAgentsConfig('');

      expect(agents).toHaveLength(0);
    });

    it('should handle comments', () => {
      const yamlContent = `
# This is a comment
- id: "test"
  name: "Test"
  command: "/bin/test"
`;

      const agents = (manager as any).parseAgentsConfig(yamlContent);

      expect(agents).toHaveLength(1);
    });
  });

  describe('stringifyAgentsConfig', () => {
    it('should generate valid YAML with header', () => {
      const agents: AgentConfig[] = [
        {
          id: 'agent-1',
          name: 'Agent 1',
          command: '/bin/agent1',
          args: ['--arg1', '--arg2'],
        },
      ];

      const yaml = (manager as any).stringifyAgentsConfig(agents);

      expect(yaml).toContain('# HuiNet Agent Configuration');
      expect(yaml).toContain('id: "agent-1"');
      expect(yaml).toContain('name: "Agent 1"');
      expect(yaml).toContain('command: "/bin/agent1"');
      expect(yaml).toContain('args: ["--arg1", "--arg2"]');
    });

    it('should include workdir when present', () => {
      const agents: AgentConfig[] = [
        {
          id: 'agent-1',
          name: 'Agent 1',
          command: '/bin/agent1',
          workdir: '/home/user/project',
        },
      ];

      const yaml = (manager as any).stringifyAgentsConfig(agents);

      expect(yaml).toContain('workdir: "/home/user/project"');
    });

    it('should include env when present', () => {
      const agents: AgentConfig[] = [
        {
          id: 'agent-1',
          name: 'Agent 1',
          command: '/bin/agent1',
          env: {
            API_KEY: 'secret',
          },
        },
      ];

      const yaml = (manager as any).stringifyAgentsConfig(agents);

      expect(yaml).toContain('env:');
      expect(yaml).toContain('API_KEY: "secret"');
    });
  });

  describe('parseValue', () => {
    it('should parse boolean true', () => {
      expect((manager as any).parseValue('true')).toBe(true);
    });

    it('should parse boolean false', () => {
      expect((manager as any).parseValue('false')).toBe(false);
    });

    it('should parse integer', () => {
      expect((manager as any).parseValue('42')).toBe(42);
    });

    it('should parse float', () => {
      expect((manager as any).parseValue('3.14')).toBe(3.14);
    });

    it('should parse quoted string', () => {
      expect((manager as any).parseValue('"hello"')).toBe('hello');
      expect((manager as any).parseValue("'world'")).toBe('world');
    });

    it('should return unquoted string as-is', () => {
      expect((manager as any).parseValue('unquoted')).toBe('unquoted');
    });
  });
});

describe('getConfigPaths', () => {
  it('should return correct paths', () => {
    osMock.homedir.mockReturnValue('/home/testuser');

    const paths = require('../agent-config').getConfigPaths();

    expect(paths.user).toBe('/home/testuser/.huinet');
    expect(paths.agentsConfig).toBe('/home/testuser/.huinet/agents.yaml');
    expect(paths.global).toBe('/etc/huinet');
  });
});
