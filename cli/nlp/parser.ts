/**
 * 自然语言解析器
 *
 * 将用户的自然语言输入转换为命令
 */

export interface ParsedCommand {
  command: string;
  args: string[];
}

/**
 * 解析自然语言输入
 */
export function parseNaturalLanguage(input: string): ParsedCommand {
  const trimmed = input.trim().toLowerCase();

  // 定义自然语言模式
  const patterns: Array<{
    regex: RegExp;
    handler: (...args: string[]) => ParsedCommand;
  }> = [
    // ===== 发送消息 =====
    {
      regex: /给(.+?)发(消息|说)(.+)/,
      handler: (_, alias, __, message) => ({
        command: 'msg',
        args: [alias.trim(), message.trim()]
      })
    },
    {
      regex: /告诉(.+?)(.+)/,
      handler: (_, alias, message) => ({
        command: 'msg',
        args: [alias.trim(), message.trim()]
      })
    },
    {
      regex: /向(.+?)发送(.+)/,
      handler: (_, alias, message) => ({
        command: 'msg',
        args: [alias.trim(), message.trim()]
      })
    },

    // ===== 查看节点 =====
    {
      regex: /(看看|查看|显示|有哪些)?节点/,
      handler: () => ({ command: 'ls', args: [] })
    },
    {
      regex: /谁在(线|网上)/,
      handler: () => ({ command: 'ls', args: [] })
    },
    {
      regex: /发现(了)?哪些节点/,
      handler: () => ({ command: 'ls', args: [] })
    },

    // ===== 查看状态 =====
    {
      regex: /(我的)?状态/,
      handler: () => ({ command: 'status', args: [] })
    },
    {
      regex: /我(怎么样|如何)/,
      handler: () => ({ command: 'status', args: [] })
    },

    // ===== 断开连接 =====
    {
      regex: /断开(和)?(.+?)的连接/,
      handler: (_, __, alias) => ({
        command: 'disconnect',
        args: [alias.trim()]
      })
    },
    {
      regex: /和(.+?)断开/,
      handler: (_, alias) => ({
        command: 'disconnect',
        args: [alias.trim()]
      })
    },

    // ===== 清屏 =====
    {
      regex: /清屏|清空|clean/,
      handler: () => ({ command: 'clear', args: [] })
    },

    // ===== 退出 =====
    {
      regex: /退出|再见|bye/,
      handler: () => ({ command: 'quit', args: [] })
    },
  ];

  // 尝试匹配所有模式
  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      return pattern.handler(...match);
    }
  }

  // 没有匹配到任何模式
  return { command: '', args: [] };
}

/**
 * 获取命令建议
 */
export function getSuggestions(input: string): string[] {
  const trimmed = input.trim().toLowerCase();
  const suggestions: string[] = [];

  if (trimmed.includes('发') || trimmed.includes('消息') || trimmed.includes('说')) {
    suggestions.push('msg <别名> <消息内容>');
  }

  if (trimmed.includes('节点') || trimmed.includes('谁') || trimmed.includes('在线')) {
    suggestions.push('ls');
  }

  if (trimmed.includes('状态') || trimmed.includes('怎么样')) {
    suggestions.push('status');
  }

  if (trimmed.includes('断开')) {
    suggestions.push('disconnect <别名>');
  }

  if (trimmed.includes('退出') || trimmed.includes('再见')) {
    suggestions.push('quit');
  }

  return suggestions;
}
