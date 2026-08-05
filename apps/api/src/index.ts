import { createApp } from './app';
import { env } from './env';
import { prisma } from './prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`  ▲ CodeNinja API listening on http://localhost:${env.PORT}`);
  console.log(`    health   GET  /health`);
  console.log(`    track    GET  /api/tracks/full-stack-30`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
