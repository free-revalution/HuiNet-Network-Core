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
  console.log('');
  showMessage('info', `Sending message to ${args[0]}...`);

  try {
    await handlers.sendMessage(context.huinet, context.config, args);
    showMessage('success', 'Message sent!');
    console.log('');
  } catch (error) {
    showCommandError((error as Error).message);
  }
}

export async function displayConnect(context: REPLContext, args: string[]): Promise<void> {
  console.log('');
  showMessage('info', `Connecting to ${args[0]}...`);

  try {
    const success = await handlers.connectTo(context.huinet, args);
    if (!success) {
      showCommandError(`Failed to connect to ${args[0]}`);
    }
    // Success message shown by peerConnected event
  } catch (error) {
    showCommandError((error as Error).message);
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
