/**
 * Detached hub entry — started by `huinet start`
 */

import { createLocalHub } from '../../src/hub';

async function main(): Promise<void> {
  const hub = createLocalHub();
  await hub.start();

  const shutdown = async () => {
    await hub.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
