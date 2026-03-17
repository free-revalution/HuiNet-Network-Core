/**
 * Two-Node Communication Test
 *
 * This script creates two HuiNet nodes that can communicate with each other.
 * Run this to verify that the communication works correctly.
 */

import { HuiNet } from '../src';
import { TransportType, NodeState } from '../src/types/connection';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTwoNodes(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       HuiNet Two-Node Communication Test                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Create Node A (Alice)
  console.log('📦 Creating Node A (Alice) on 127.0.0.1:8001...');
  const alice = new HuiNet({
    listenPort: 8001,
    listenHost: '127.0.0.1',
    enableMDNS: false,
  });

  await new Promise<void>((resolve) => {
    alice.on('ready', () => {
      console.log(`✅ Alice ready! NodeID: ${alice.getNodeID().substring(0, 20)}...`);
      resolve();
    });
    alice.start();
  });

  await sleep(500);

  // Create Node B (Bob)
  console.log('📦 Creating Node B (Bob) on 127.0.0.1:8002...');
  const bob = new HuiNet({
    listenPort: 8002,
    listenHost: '127.0.0.1',
    enableMDNS: false,
  });

  await new Promise<void>((resolve) => {
    bob.on('ready', () => {
      console.log(`✅ Bob ready! NodeID: ${bob.getNodeID().substring(0, 20)}...`);
      resolve();
    });
    bob.start();
  });

  await sleep(500);

  // Get Node IDs
  const aliceNodeID = alice.getNodeID();
  const bobNodeID = bob.getNodeID();

  console.log('');
  console.log('📋 Node Information:');
  console.log(`  Alice NodeID: ${aliceNodeID}`);
  console.log(`  Bob NodeID:   ${bobNodeID}`);
  console.log('');

  // Manually add Bob to Alice's routing table
  console.log('🔗 Adding Bob to Alice\'s routing table...');
  alice.getRoutingTable().addKnownNode({
    nodeID: bobNodeID,
    addresses: [{
      type: TransportType.TCP,
      host: '127.0.0.1',
      port: 8002,
      priority: 1,
      lastVerified: Date.now(),
    }],
    publicKey: Buffer.alloc(32),
    metadata: {
      version: '1.0.0',
      capabilities: [],
      startTime: Date.now(),
    },
    state: NodeState.ONLINE,
    lastSeen: Date.now(),
    connectionCount: 0,
  });
  console.log('  ✅ Bob added to Alice\'s routing table');

  // Manually add Alice to Bob's routing table
  console.log('🔗 Adding Alice to Bob\'s routing table...');
  bob.getRoutingTable().addKnownNode({
    nodeID: aliceNodeID,
    addresses: [{
      type: TransportType.TCP,
      host: '127.0.0.1',
      port: 8001,
      priority: 1,
      lastVerified: Date.now(),
    }],
    publicKey: Buffer.alloc(32),
    metadata: {
      version: '1.0.0',
      capabilities: [],
      startTime: Date.now(),
    },
    state: NodeState.ONLINE,
    lastSeen: Date.now(),
    connectionCount: 0,
  });
  console.log('  ✅ Alice added to Bob\'s routing table');

  // Test 1: Bob sends message to Alice
  console.log('');
  console.log('📤 Test 1: Bob sends message to Alice...');
  console.log('   Bob sending to:', aliceNodeID.substring(0, 20) + '...');

  let messageReceived = false;

  alice.once('message', (from, data) => {
    messageReceived = true;
    console.log(`📨 Alice received message!`);
    console.log(`   From: ${from.substring(0, 20)}...`);
    console.log(`   Text: ${data.data?.text || '(no text)'}`);
  });

  bob.on('error', (error) => {
    console.log(`   Bob error:`, error);
  });

  try {
    await bob.send(aliceNodeID, {
      type: 'chat',
      text: 'Hello Alice! This is Bob.',
    });
    console.log('   ✅ Bob.send() called successfully');
  } catch (error) {
    console.log('   ❌ Bob.send() failed:', error);
  }

  await sleep(2000);

  if (messageReceived) {
    console.log('✅ Test 1 PASSED: Message received');
  } else {
    console.log('❌ Test 1 FAILED: Message not received (waited 2 seconds)');
  }

  // Test 2: Alice sends message to Bob
  console.log('');
  console.log('📤 Test 2: Alice sends message to Bob...');
  console.log('   Alice sending to:', bobNodeID.substring(0, 20) + '...');

  messageReceived = false;

  bob.once('message', (from, data) => {
    messageReceived = true;
    console.log(`📨 Bob received message!`);
    console.log(`   From: ${from.substring(0, 20)}...`);
    console.log(`   Text: ${data.data?.text || '(no text)'}`);
  });

  alice.on('error', (error) => {
    console.log(`   Alice error:`, error);
  });

  try {
    await alice.send(bobNodeID, {
      type: 'chat',
      text: 'Hi Bob! Nice to meet you.',
    });
    console.log('   ✅ Alice.send() called successfully');
  } catch (error) {
    console.log('   ❌ Alice.send() failed:', error);
  }

  await sleep(2000);

  if (messageReceived) {
    console.log('✅ Test 2 PASSED: Message received');
  } else {
    console.log('❌ Test 2 FAILED: Message not received (waited 2 seconds)');
  }

  // Cleanup
  console.log('');
  console.log('🧹 Cleaning up...');
  await alice.stop();
  await bob.stop();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Complete!                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

// Run the test
testTwoNodes().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
