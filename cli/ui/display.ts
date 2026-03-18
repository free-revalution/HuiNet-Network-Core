/**
 * Display utilities for beautiful CLI output
 */

import * as readline from 'readline';

/**
 * Get terminal width
 */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * ANSI color codes
 */
export const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

/**
 * Box drawing characters (rounded style)
 */
const Box = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
};

/**
 * Create a padded string that fits the terminal width
 */
function fitWidth(text: string, width: number): string {
  // Remove ANSI codes for length calculation
  // eslint-disable-next-line no-control-regex
  const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = width - cleanText.length;

  if (padding > 0) {
    return text + ' '.repeat(padding);
  }
  return text;
}

/**
 * Center text within width
 */
function centerText(text: string, width: number): string {
  // Remove ANSI codes for length calculation
  // eslint-disable-next-line no-control-regex
  const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = width - cleanText.length;

  if (padding > 0) {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }
  return text;
}

/**
 * Wrap text to fit width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draw a horizontal line
 */
function drawLine(width: number, color: string = Colors.cyan): string {
  return color + Box.horizontal.repeat(width) + Colors.reset;
}

/**
 * Draw a box around content
 */
function drawBox(lines: string[], width: number): string[] {
  const result: string[] = [];

  // Top border
  result.push(Colors.cyan + Box.topLeft + Box.horizontal.repeat(width - 2) + Box.topRight + Colors.reset);

  // Content
  for (const line of lines) {
    result.push(Colors.cyan + Box.vertical + Colors.reset + ' ' + fitWidth(line, width - 3) + Colors.cyan + Box.vertical + Colors.reset);
  }

  // Bottom border
  result.push(Colors.cyan + Box.bottomLeft + Box.horizontal.repeat(width - 2) + Box.bottomRight + Colors.reset);

  return result;
}

/**
 * Show welcome screen
 */
export function showWelcome(huinet: any, name: string): void {
  console.clear();

  const width = getTerminalWidth();
  const contentWidth = width - 4;

  // ASCII logo (blue)
  const logo = [
    `${Colors.cyan}    ██╗  ██╗██╗   ██╗██╗███╗   ██╗███████╗████████╗   ${Colors.reset}`,
    `${Colors.cyan}    ██║  ██║██║   ██║██║████╗  ██║██╔════╝╚══██╔══╝   ${Colors.reset}`,
    `${Colors.cyan}    ███████║██║   ██║██║██╔██╗ ██║█████╗     ██║      ${Colors.reset}`,
    `${Colors.cyan}    ██╔══██║██║   ██║██║██║╚██╗██║██╔══╝     ██║      ${Colors.reset}`,
    `${Colors.cyan}    ██║  ██║╚██████╔╝██║██║ ╚████║███████╗   ██║      ${Colors.reset}`,
    `${Colors.cyan}    ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝      ${Colors.reset}`,
  ];

  // Title line
  const titleWidth = contentWidth - 4;
  const titleLine = drawLine(titleWidth);

  console.log('');
  console.log(Colors.cyan + Box.topLeft + Box.horizontal.repeat(titleWidth) + Box.topRight + Colors.reset);
  for (const line of logo) {
    console.log(Colors.cyan + Box.vertical + Colors.reset + centerText(line, titleWidth) + Colors.cyan + Box.vertical + Colors.reset);
  }
  console.log(Colors.cyan + Box.vertical + Colors.reset + centerText(`${Colors.bright}HuiNet v1.0.0 - P2P Agent Networking${Colors.reset}`, titleWidth) + Colors.cyan + Box.vertical + Colors.reset);
  console.log(Colors.cyan + Box.bottomLeft + Box.horizontal.repeat(titleWidth) + Box.bottomRight + Colors.reset);

  // Info box
  const nodeID = huinet.getNodeID();
  const shortNodeID = nodeID.length > 30 ? nodeID.substring(0, 30) + '...' : nodeID;

  const infoLines = [
    `${Colors.bright}Name:${Colors.reset} ${name}`,
    `${Colors.bright}NodeID:${Colors.reset} ${shortNodeID}`,
    `${Colors.bright}Status:${Colors.reset} ${Colors.green}● Ready${Colors.reset}`,
  ];

  // Use consistent width for all boxes (80% of terminal width, max 70 chars)
  const boxWidth = Math.min(70, Math.floor(width * 0.8));

  const infoBox = drawBox(infoLines, boxWidth);

  console.log('');
  for (const line of infoBox) {
    console.log(' '.repeat(4) + line);
  }

  // Tips box
  const tips = [
    `${Colors.cyan}Tips:${Colors.reset}`,
    `  • Type ${Colors.yellow}"help"${Colors.reset} to see all commands`,
    `  • Type ${Colors.yellow}"ls"${Colors.reset} to see discovered nodes`,
    `  • Type ${Colors.yellow}"msg <name> <text>"${Colors.reset} to send a message`,
    `  • Type ${Colors.yellow}"fullnodeid"${Colors.reset} to show complete NodeID`,
    `  • Type ${Colors.yellow}"quit"${Colors.reset} to exit`,
  ];

  const tipsBox = drawBox(tips, boxWidth);

  console.log('');
  for (const line of tipsBox) {
    console.log(' '.repeat(4) + line);
  }

  console.log('');
}

/**
 * Show title box
 */
export function showTitle(title: string): void {
  const width = getTerminalWidth();
  const line = Colors.cyan + Box.horizontal.repeat(width - 2) + Colors.reset;
  console.log('\n' + Box.topLeft + line + Box.topRight);
  console.log(Box.vertical + ' ' + Colors.bright + title + Colors.reset + fitWidth('', width - title.length - 5) + Box.vertical);
  console.log(Box.bottomLeft + line + Box.bottomRight);
}

/**
 * Show help
 */
export function showHelp(): void {
  const width = getTerminalWidth() - 8;

  console.log('');
  console.log(Colors.bright + Colors.cyan + 'Available Commands:' + Colors.reset);
  console.log('');

  const sections = [
    {
      title: `${Colors.yellow}Basic Commands:${Colors.reset}`,
      commands: [
        { cmd: 'help', desc: 'Show this help message' },
        { cmd: 'status', desc: 'Show detailed node status' },
        { cmd: 'ls', desc: 'List all discovered nodes' },
        { cmd: 'fullnodeid', desc: 'Show complete NodeID' },
        { cmd: 'quit', desc: 'Exit the program' },
      ]
    },
    {
      title: `${Colors.yellow}Messaging:${Colors.reset}`,
      commands: [
        { cmd: 'msg <name> <text>', desc: 'Send message to a node' },
        { cmd: 'broadcast <text>', desc: 'Broadcast to all nodes' },
        { cmd: 'history', desc: 'Show message history' },
      ]
    },
    {
      title: `${Colors.yellow}Node Management:${Colors.reset}`,
      commands: [
        { cmd: 'alias <name> <id>', desc: 'Set a friendly name for a node' },
        { cmd: 'aliases', desc: 'List all aliases' },
        { cmd: 'connect <address>', desc: 'Manually connect to a node' },
        { cmd: 'disconnect <name>', desc: 'Disconnect from a node' },
      ]
    },
    {
      title: `${Colors.yellow}Natural Language:${Colors.reset}`,
      commands: [
        { cmd: '"send hello to Alice"', desc: 'Send message naturally' },
        { cmd: '"show me all nodes"', desc: 'List discovered nodes' },
        { cmd: '"what is my status"', desc: 'Show node status' },
      ]
    },
  ];

  for (const section of sections) {
    console.log(section.title);
    console.log('');

    for (const { cmd, desc } of section.commands) {
      const paddedCmd = Colors.cyan + cmd.padEnd(30) + Colors.reset;
      console.log(`  ${paddedCmd} ${desc}`);
    }

    console.log('');
  }
}

/**
 * Show message
 */
export function showMessage(type: 'info' | 'success' | 'error' | 'warning', text: string): void {
  const icons = {
    info: `${Colors.blue}ℹ${Colors.reset}`,
    success: `${Colors.green}✓${Colors.reset}`,
    error: `${Colors.red}✗${Colors.reset}`,
    warning: `${Colors.yellow}⚠${Colors.reset}`,
  };

  const icon = icons[type];
  console.log(`  ${icon} ${text}`);
}

/**
 * Clear screen
 */
export function clearScreen(): void {
  console.clear();
}
