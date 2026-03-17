// cli/ui/command-output.ts
import { REPLContext } from '../context';
import { showMessage } from './display';
import * as handlers from '../commands/handlers';

/**
 * 命令输出显示函数 - 纯 UI 逻辑
 */

export async function displayStatus(context: REPLContext): Promise<void> {
  try {
    await handlers.showStatus(context.huinet, context.config);
  } catch (error) {
    showCommandError(`Failed to get status: ${(error as Error).message}`);
  }
}

export async function displayNodeList(context: REPLContext): Promise<void> {
  try {
    await handlers.listNodes(context.huinet, context.config);
  } catch (error) {
    showCommandError(`Failed to list nodes: ${(error as Error).message}`);
  }
}

export async function displaySendMessage(context: REPLContext, args: string[]): Promise<void> {
  if (args.length < 2) {
    showCommandError('Usage: msg <name> <message>');
    console.log('  Example: msg Alice Hello');
    return;
  }

  console.log('');
  showMessage('info', `Sending message to ${args[0]}...`);

  try {
    await handlers.sendMessage(context.huinet, context.config, args);
    showMessage('success', 'Message sent!');
    console.log('');
  } catch (error) {
    showCommandError(`Send failed: ${(error as Error).message}`);
  }
}

export async function displayConnect(context: REPLContext, args: string[]): Promise<void> {
  if (args.length === 0) {
    showCommandError('Usage: connect <address>');
    console.log('  Example: connect 127.0.0.1:8002');
    return;
  }

  const address = args[0];
  const parts = address.split(':');

  if (parts.length !== 2) {
    showCommandError('Invalid address format. Use host:port');
    return;
  }

  const host = parts[0];
  const port = parseInt(parts[1], 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    showCommandError('Invalid port number');
    return;
  }

  console.log('');
  showMessage('info', `Connecting to ${address}...`);

  try {
    const success = await context.huinet.connectToNode(host, port);
    if (!success) {
      showCommandError(`Failed to connect to ${address}`);
    }
    // Success message shown by peerConnected event
  } catch (error) {
    showCommandError(`Connection error: ${(error as Error).message}`);
  }
}

function showCommandError(message: string): void {
  console.log('');
  showMessage('error', message);
  console.log('');
}

function showCommandSuccess(message: string): void {
  console.log('');
  showMessage('success', message);
  console.log('');
}
