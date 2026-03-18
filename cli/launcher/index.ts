/**
 * Main launcher logic for HuiNet agents
 * Handles agent detection, daemon communication, and process supervision
 */

import { Supervisor } from './supervisor';
import { detectAgentType } from './agent-types';

/**
 * Launch an AI agent with HuiNet integration
 *
 * @param agentCommand - Command to launch the agent
 * @param args - Arguments to pass to the agent command
 * @param daemonUrl - URL of the HuiNet daemon (default: http://localhost:3000)
 */
export async function launch(
  agentCommand: string,
  args: string[],
  daemonUrl: string = 'http://localhost:3000'
): Promise<void> {
  // Detect agent type from command
  const agentType = detectAgentType(agentCommand);

  // Check daemon availability
  try {
    const statusUrl = new URL('/api/status', daemonUrl);
    const statusResponse = await fetch(statusUrl.toString());

    if (!statusResponse.ok) {
      throw new Error(`Daemon status check failed: ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json() as { status: string };
    if (statusData.status !== 'running') {
      throw new Error('Daemon is not running');
    }

  } catch (error) {
    throw new Error(`Failed to connect to daemon at ${daemonUrl}: ${error}`);
  }

  // Register agent with daemon
  let agentId: string;
  let proxyPort: number;

  try {
    const registerUrl = new URL('/api/agents/register', daemonUrl);
    const registerResponse = await fetch(registerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentType,
        agentName: `${agentType}-${Date.now()}`,
        pid: process.pid,
        status: 'running',
      }),
    });

    if (!registerResponse.ok) {
      throw new Error(`Agent registration failed: ${registerResponse.statusText}`);
    }

    const registerData = await registerResponse.json() as { agentId: string; proxyPort: number };
    agentId = registerData.agentId;
    proxyPort = registerData.proxyPort;

  } catch (error) {
    throw new Error(`Failed to register agent: ${error}`);
  }

  // Setup environment variables
  const env: Record<string, string> = {
    HUINET_AGENT_ID: agentId,
    HUINET_AGENT_TYPE: agentType,
    HTTP_PROXY: `http://localhost:${proxyPort}`,
    HTTPS_PROXY: `http://localhost:${proxyPort}`,
    http_proxy: `http://localhost:${proxyPort}`,
    https_proxy: `http://localhost:${proxyPort}`,
  };

  // Create supervisor
  const supervisor = new Supervisor(daemonUrl, agentId);

  // Handle supervisor events
  supervisor.on('error', (err: Error) => {
    console.error('Supervisor error:', err);
  });

  supervisor.on('process-exit', (code: number | null, signal: string | null) => {
    console.log(`Agent process exited: code=${code}, signal=${signal}`);
  });

  // Handle SIGINT for graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await supervisor.stop();
    process.exit(0);
  });

  // Launch the agent
  try {
    await supervisor.launch(agentCommand, args, env);
    console.log(`Agent launched with ID: ${agentId}`);
    console.log(`Proxy configured on port: ${proxyPort}`);
  } catch (error) {
    console.error('Failed to launch agent:', error);
    await supervisor.stop();
    throw error;
  }
}
