/**
 * CLI 上下文管理
 *
 * 提供统一的上下文接口，替代全局变量
 */

import readline from 'readline';
import { HuiNet } from '../src';
import { ConfigManager } from './storage/config';

/**
 * REPL 上下文，包含所有需要的状态
 * 替代全局变量，使代码可测试和可维护
 */
export interface REPLContext {
  /** HuiNet 节点实例 */
  huinet: HuiNet;

  /** 配置管理器 */
  config: ConfigManager;

  /** readline 接口 */
  rl: readline.Interface;

  /** 是否已显示欢迎界面 */
  welcomeShown?: boolean;

  /** REPL 是否在运行 */
  running?: boolean;
}

/**
 * 创建 REPL 上下文
 */
export function createREPLContext(
  huinet: HuiNet,
  config: ConfigManager,
  rl: readline.Interface
): REPLContext {
  return {
    huinet,
    config,
    rl,
    welcomeShown: false,
    running: true
  };
}
