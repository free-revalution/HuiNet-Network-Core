/**
 * HuiNet 双节点通信测试
 *
 * 这个示例在同一个进程中创建两个 HuiNet 节点
 * 用于测试节点之间的发现和通信功能
 *
 * 运行方式：
 *   npx ts-node examples/two-node-test.ts
 */

import { HuiNet } from '../src';

/**
 * 创建一个测试节点
 */
async function createTestNode(name: string, port: number, bootstrap?: string[]): Promise<HuiNet> {
  console.log(`\n🔧 正在创建节点: ${name} (端口 ${port})`);

  const huinet = new HuiNet({
    listenPort: port,
    listenHost: '127.0.0.1',  // 本地测试
    enableMDNS: false,         // 本地测试关闭 mDNS
    bootstrapNodes: bootstrap,
  });

  // 设置事件监听
  huinet.on('ready', () => {
    console.log(`✅ ${name} 就绪! NodeID: ${huinet.getNodeID().substring(0, 16)}...`);
  });

  huinet.on('nodeDiscovered', (node) => {
    console.log(`🔍 ${name} 发现节点: ${node.nodeId.substring(0, 16)}...`);
  });

  huinet.on('peerConnected', (nodeID) => {
    console.log(`✨ ${name} 连接到: ${nodeID.substring(0, 16)}...`);
  });

  huinet.on('peerDisconnected', (nodeID) => {
    console.log(`💔 ${name} 断开连接: ${nodeID.substring(0, 16)}...`);
  });

  await huinet.start();
  return huinet;
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       HuiNet 双节点通信测试                      ║');
  console.log('╚══════════════════════════════════════════════════╝');

  try {
    // 第一步：创建第一个节点（Alice）
    console.log('\n📌 步骤 1: 创建节点 Alice');
    const alice = await createTestNode('Alice', 8001);

    // 等待 Alice 完全启动
    await new Promise(resolve => setTimeout(resolve, 500));

    // 第二步：创建第二个节点（Bob），使用 Alice 作为引导节点
    console.log('\n📌 步骤 2: 创建节点 Bob（使用 Alice 作为引导节点）');
    const bob = await createTestNode('Bob', 8002, ['127.0.0.1:8001']);

    // 等待连接建立
    console.log('\n⏳ 等待节点建立连接...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 第三步：查看节点状态
    console.log('\n📊 步骤 3: 查看节点状态');

    console.log('\n--- Alice 的路由表 ---');
    const aliceRouting = alice.getRoutingTable();
    console.log(`核心节点: ${aliceRouting.getCoreNodes().size}`);
    console.log(`活跃节点: ${aliceRouting.getActiveNodes().size}`);
    console.log(`已知节点: ${aliceRouting.getKnownNodes().size}`);

    console.log('\n--- Bob 的路由表 ---');
    const bobRouting = bob.getRoutingTable();
    console.log(`核心节点: ${bobRouting.getCoreNodes().size}`);
    console.log(`活跃节点: ${bobRouting.getActiveNodes().size}`);
    console.log(`已知节点: ${bobRouting.getKnownNodes().size}`);

    // 第四步：测试发送消息
    console.log('\n📌 步骤 4: 测试节点间通信');

    const aliceNodeID = alice.getNodeID();
    const bobNodeID = bob.getNodeID();

    console.log(`\nAlice 的 NodeID: ${aliceNodeID}`);
    console.log(`Bob 的 NodeID: ${bobNodeID}`);

    // Bob 向 Alice 发送消息
    console.log('\n📤 Bob 向 Alice 发送测试消息...');
    try {
      await bob.send(aliceNodeID, {
        type: 'greeting',
        from: 'Bob',
        text: 'Hello Alice! 这是来自 Bob 的消息',
        timestamp: Date.now()
      });
      console.log('✅ Bob 发送消息成功');
    } catch (error) {
      console.error('❌ Bob 发送消息失败:', (error as Error).message);
    }

    // Alice 向 Bob 发送消息
    console.log('\n📤 Alice 向 Bob 发送测试消息...');
    try {
      await alice.send(bobNodeID, {
        type: 'greeting',
        from: 'Alice',
        text: 'Hello Bob! 很高兴收到你的消息',
        timestamp: Date.now()
      });
      console.log('✅ Alice 发送消息成功');
    } catch (error) {
      console.error('❌ Alice 发送消息失败:', (error as Error).message);
    }

    // 等待消息处理
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 第五步：显示最终状态
    console.log('\n📌 步骤 5: 最终状态');
    console.log('\n--- Alice 的已知节点 ---');
    aliceRouting.getKnownNodes().forEach((node, id) => {
      console.log(`  ${id.substring(0, 16)}... @ ${node.address}`);
    });

    console.log('\n--- Bob 的已知节点 ---');
    bobRouting.getKnownNodes().forEach((node, id) => {
      console.log(`  ${id.substring(0, 16)}... @ ${node.address}`);
    });

    // 清理
    console.log('\n🧹 清理资源...');
    await alice.stop();
    await bob.stop();

    console.log('\n✅ 测试完成！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}
