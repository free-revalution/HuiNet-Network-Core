/**
 * TUI Components for HuiNet Monitor
 * React components for terminal UI using Ink
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { AgentInfo, AgentStatus } from '../../daemon/types';

/**
 * Props for TopologyView component
 */
export interface TopologyViewProps {
  machines: Array<{
    machineId: string;
    machineName: string;
    location: string;
    agents: AgentInfo[];
  }>;
  selectedIndex?: number;
}

/**
 * Status color mapping
 */
const STATUS_COLORS: Record<AgentStatus, string> = {
  running: 'green',
  busy: 'yellow',
  idle: 'blue',
  offline: 'gray',
};

/**
 * TopologyView component - displays network topology
 */
export const TopologyView: React.FC<TopologyViewProps> = ({ machines, selectedIndex = 0 }) => {
  if (machines.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No machines in network</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {machines.map((machine, machineIndex) => (
        <Box key={machine.machineId} flexDirection="column" marginBottom={1}>
          <Box>
            <Text bold color="cyan">
              {machine.machineName}
            </Text>
            <Text dimColor> ({machine.location})</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text dimColor>ID: {machine.machineId}</Text>
          </Box>
          {machine.agents.length > 0 ? (
            <Box flexDirection="column" paddingLeft={2} marginTop={1}>
              {machine.agents.map((agent, agentIndex) => (
                <Box key={agent.agentId}>
                  <Text
                    color={selectedIndex === agentIndex ? 'white' : STATUS_COLORS[agent.status]}
                    bold={selectedIndex === agentIndex}
                  >
                    {selectedIndex === agentIndex ? '> ' : '  '}
                    {agent.agentName}
                  </Text>
                  <Text dimColor> - {agent.agentType}</Text>
                  <Text color={STATUS_COLORS[agent.status]}> [{agent.status}]</Text>
                </Box>
              ))}
            </Box>
          ) : (
            <Box paddingLeft={2} marginTop={1}>
              <Text dimColor>No agents running</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Props for StatusBar component
 */
export interface StatusBarProps {
  machineId: string;
  totalAgents: number;
  activeAgents: number;
  uptime?: number;
}

/**
 * StatusBar component - shows statistics at bottom
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  machineId,
  totalAgents,
  activeAgents,
  uptime,
}) => {
  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Box>
        <Text bold>Machine: </Text>
        <Text color="cyan">{machineId}</Text>
      </Box>
      <Box>
        <Text bold>Agents: </Text>
        <Text color="green">{activeAgents}</Text>
        <Text dimColor>/</Text>
        <Text>{totalAgents}</Text>
      </Box>
      {uptime !== undefined && (
        <Box>
          <Text bold>Uptime: </Text>
          <Text color="yellow">{formatUptime(uptime)}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Main menu option type
 */
export interface MenuOption {
  label: string;
  action: () => void;
  key: string;
}

/**
 * Props for MainMenu component
 */
export interface MainMenuProps {
  options: MenuOption[];
  isVisible: boolean;
  onClose: () => void;
}

/**
 * MainMenu component - navigation menu
 */
export const MainMenu: React.FC<MainMenuProps> = ({ options, isVisible, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (!isVisible) return;

    if (key.escape) {
      onClose();
    } else if (key.return) {
      options[selectedIndex].action();
    } else if (input === 'j' || key.downArrow) {
      setSelectedIndex((i) => (i + 1) % options.length);
    } else if (input === 'k' || key.upArrow) {
      setSelectedIndex((i) => (i - 1 + options.length) % options.length);
    }
  });

  if (!isVisible) return null;

  return (
    <Box flexDirection="column">
      <Box borderBottom={true} paddingBottom={1} marginBottom={1}>
        <Text bold underline>
          Main Menu
        </Text>
      </Box>
      {options.map((option, index) => (
        <Box key={option.key}>
          <Text
            bold={index === selectedIndex}
            color={index === selectedIndex ? 'cyan' : 'white'}
          >
            {index === selectedIndex ? '> ' : '  '}
            {option.label}
          </Text>
          <Text dimColor> [{option.key}]</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Press ESC to close, ENTER to select</Text>
      </Box>
    </Box>
  );
};

/**
 * Props for MonitorApp component
 */
export interface MonitorAppProps {
  daemonUrl: string;
  client: any; // DaemonClient - using any to avoid import issues
}

/**
 * Main Monitor App component
 */
export const MonitorApp: React.FC<MonitorAppProps> = ({ daemonUrl, client }) => {
  const { exit } = useApp();
  const [machines, setMachines] = useState<Array<{
    machineId: string;
    machineName: string;
    location: string;
    agents: any[];
  }>>([]);
  const [stats, setStats] = useState({
    machineId: 'unknown',
    totalAgents: 0,
    activeAgents: 0,
  });
  const [startTime] = useState(Date.now());
  const [showMenu, setShowMenu] = useState(false);
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);

  // Fetch topology
  const fetchTopology = useCallback(async () => {
    try {
      const topology = await client.getTopology();
      setMachines(topology.machines);

      // Calculate stats
      const allAgents = topology.machines.flatMap((m: any) => m.agents);
      const activeAgents = allAgents.filter((a: any) => a.status === 'running').length;

      setStats({
        machineId: topology.machines[0]?.machineId || 'unknown',
        totalAgents: allAgents.length,
        activeAgents,
      });
    } catch (error) {
      // Silently ignore fetch errors
    }
  }, [client]);

  // Initial fetch and polling
  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 1000);
    return () => clearInterval(interval);
  }, [fetchTopology]);

  // Handle keyboard input
  useInput((input, key) => {
    if (showMenu) return; // Let menu handle input

    if (key.escape) {
      exit();
    } else if (input === 'q') {
      exit();
    } else if (input === 'm') {
      setShowMenu(true);
    } else if (input === 'j' || key.downArrow) {
      setSelectedAgentIndex((i) => {
        const allAgents = machines.flatMap((m) => m.agents);
        return (i + 1) % Math.max(allAgents.length, 1);
      });
    } else if (input === 'k' || key.upArrow) {
      setSelectedAgentIndex((i) => {
        const allAgents = machines.flatMap((m) => m.agents);
        return (i - 1 + Math.max(allAgents.length, 1)) % Math.max(allAgents.length, 1);
      });
    }
  });

  const menuOptions = [
    {
      key: 'r',
      label: 'Refresh Topology',
      action: () => {
        fetchTopology();
        setShowMenu(false);
      },
    },
    {
      key: 's',
      label: 'Send Message',
      action: () => {
        setShowMenu(false);
        // TODO: Implement message sending UI
      },
    },
    {
      key: 'q',
      label: 'Quit',
      action: () => exit(),
    },
  ];

  const uptime = Date.now() - startTime;

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="double" paddingX={1} marginBottom={1}>
        <Text bold color="green">
          HuiNet Monitor
        </Text>
        <Text dimColor> - {daemonUrl}</Text>
      </Box>

      {/* Main content */}
      {showMenu ? (
        <MainMenu
          options={menuOptions}
          isVisible={showMenu}
          onClose={() => setShowMenu(false)}
        />
      ) : (
        <Box flexGrow={1}>
          <TopologyView machines={machines} selectedIndex={selectedAgentIndex} />
        </Box>
      )}

      {/* Help text */}
      {!showMenu && (
        <Box marginTop={1}>
          <Text dimColor>
            [M]enu [R]efresh [Q]uit | Navigate: J/K or ↑/↓ | ESC to exit
          </Text>
        </Box>
      )}

      {/* Status bar */}
      <Box marginTop={1}>
        <StatusBar
          machineId={stats.machineId}
          totalAgents={stats.totalAgents}
          activeAgents={stats.activeAgents}
          uptime={uptime}
        />
      </Box>
    </Box>
  );
};
