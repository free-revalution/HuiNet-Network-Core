import { HuiNet } from '../src';

async function main() {
  // Create a HuiNet instance
  const huinet = new HuiNet({
    listenPort: 8000,
    enableMDNS: true,
  });

  // Event handlers
  huinet.on('ready', () => {
    console.log(`HuiNet ready! NodeID: ${huinet.getNodeID()}`);
  });

  huinet.on('nodeDiscovered', (node) => {
    console.log(`Discovered node: ${node.nodeId}`);
  });

  huinet.on('peerConnected', (nodeID) => {
    console.log(`Connected to: ${nodeID}`);
  });

  huinet.on('peerDisconnected', (nodeID) => {
    console.log(`Disconnected from: ${nodeID}`);
  });

  // Start the network service
  await huinet.start();

  // Keep running
  process.on('SIGINT', async () => {
    console.log('Stopping...');
    await huinet.stop();
    process.exit(0);
  });
}

main().catch(console.error);
