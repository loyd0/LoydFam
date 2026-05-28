/**
 * Seed the admin user: sam@loyd.family / Password1!
 *
 * Usage: npx tsx scripts/seed-admin.ts
 */
import bcrypt from "bcryptjs";
import "dotenv/config";

async function main() {
  const { prisma } = await import("../src/lib/prisma");

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
