/**
 * Seed the admin user: sam@loyd.family / Password1!
 *
 * Usage: npx tsx scripts/seed-admin.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";

async function main() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  const email = "sam@loyd.family";
  const password = "Password1!";
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, role: "ADMIN" },
    create: {
      email,
      name: "Sam Loyd",
      passwordHash: hash,
      role: "ADMIN",
    },
  });

  console.log(`✅ Admin user seeded: ${user.email} (id: ${user.id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
