import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL!;

// Local development convenience: when pointed at a plain Postgres instance
// (e.g. `postgresql://...@localhost:5432/...`), route the Neon serverless
// driver through a local WebSocket proxy. Production (real Neon endpoints) is
// untouched — this branch never runs there.
if (/@(localhost|127\.0\.0\.1)/.test(connectionString ?? "")) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
  neonConfig.wsProxy = (host) => `${host}:80/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
