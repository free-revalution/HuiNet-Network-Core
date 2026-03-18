/**
 * Agent type configurations for the launcher
 * Defines supported AI agent types and their detection methods
 */

/**
 * Agent type configuration
 */
export interface AgentTypeConfig {
  /** Human-readable name of the agent type */
  name: string;
  /** Command to launch the agent */
  command: string;
  /** Default arguments for the command */
  args: string[];
  /** Function to detect if a command is this type of agent */
  detect: (command: string) => boolean;
}

/**
 * Agent type: Claude Code
 */
const claudeCodeConfig: AgentTypeConfig = {
  name: 'claude-code',
  command: 'claude',
  args: [],
  detect: (command: string) => {
    return command.includes('claude') || command.includes('Claude');
  },
};

/**
 * Agent type: Cursor
 */
const cursorConfig: AgentTypeConfig = {
  name: 'cursor',
  command: 'cursor',
  args: [],
  detect: (command: string) => {
    return command.includes('cursor') || command.includes('Cursor');
  },
};

/**
 * Agent type: OpenClaw
 */
const openclawConfig: AgentTypeConfig = {
  name: 'openclaw',
  command: 'openclaw',
  args: [],
  detect: (command: string) => {
    return command.includes('openclaw') || command.includes('OpenClaw');
  },
};

/**
 * Agent type: Windsurf
 */
const windsurfConfig: AgentTypeConfig = {
  name: 'windsurf',
  command: 'windsurf',
  args: [],
  detect: (command: string) => {
    return command.includes('windsurf') || command.includes('Windsurf');
  },
};

/**
 * Registry of all supported agent types
 */
export const AGENT_TYPES: Record<string, AgentTypeConfig> = {
  'claude-code': claudeCodeConfig,
  cursor: cursorConfig,
  openclaw: openclawConfig,
  windsurf: windsurfConfig,
};

/**
 * Detect agent type from command string
 * Returns the agent type key or 'unknown' if not detected
 */
export function detectAgentType(command: string): string {
  for (const [key, config] of Object.entries(AGENT_TYPES)) {
    if (config.detect(command)) {
      return key;
    }
  }
  return 'unknown';
}

/**
 * Get agent config by type key
 */
export function getAgentConfig(type: string): AgentTypeConfig | undefined {
  return AGENT_TYPES[type];
}
