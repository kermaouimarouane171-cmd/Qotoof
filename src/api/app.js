import { startServer } from './server.js';

startServer().catch((error) => {
  console.error('[api] Failed to start server', error);
  process.exit(1);
});
