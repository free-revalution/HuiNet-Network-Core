/**
 * 欢迎界面和显示辅助函数
 */

import { HuiNet } from '@huinet/network';

/**
 * 显示欢迎界面
 */
export function showWelcome(huinet: HuiNet, name: string): void {
  // 清屏
  console.clear();

  // NodeID 缩短显示
  const nodeID = huinet.getNodeID();
  const shortNodeID = nodeID.substring(0, 20) + '...';

  // 绘制欢迎框
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    🌐 HuiNet v1.0.0                       ║
╠════════════════════════════════════════════════════════════╣
║  名称: ${padRight(name, 50)}║
║  NodeID: ${padRight(shortNodeID, 48)}║
║  状态: ● 已就绪${' '.repeat(41)}║
╠════════════════════════════════════════════════════════════╣
║  💡 提示:                                                  ║
║    - 输入 ${padRight('help', 10)} 查看所有命令                          ║
║    - 输入 ${padRight('ls', 10)} 查看已发现的节点                        ║
║    - 输入 ${padRight('quit', 10)} 退出程序                               ║
║    - 支持自然语言，试试 "给小明发消息说你好"             ║
╚════════════════════════════════════════════════════════════╝
  `);
}

/**
 * 显示帮助信息
 */
export function showHelp(): void {
  console.log(`
📖 命令帮助

  📊 状态查询:
    status              查看我的节点状态
    ls                  列出所有已发现的节点

  💬 消息发送:
    msg <别名> <内容>    给指定节点发送消息
    broadcast <内容>    给所有连接的节点广播消息
    history             查看消息历史

  🔗 连接管理:
    alias <名称> <ID>   为节点设置易记的别名
    connect <地址>      手动连接到指定地址
    disconnect <别名>   断开与指定节点的连接

  🛠️ 其他:
    help                显示此帮助信息
    clear               清屏
    quit / exit         退出程序

  🗣️ 自然语言示例:
    "给小明发消息说你好"
    "查看有哪些节点"
    "我的状态怎么样"
    "断开和小明的连接"
  `);
}

/**
 * 右侧填充空格
 */
function padRight(str: string, length: number): string {
  return (str + ' '.repeat(length)).substring(0, length);
}

/**
 * 显示分隔线
 */
export function showSeparator(): void {
  console.log('─'.repeat(58));
}

/**
 * 显示标题
 */
export function showTitle(title: string): void {
  showSeparator();
  console.log(`  ${title}`);
  showSeparator();
}
