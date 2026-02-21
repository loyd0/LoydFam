import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@example.com",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const invite = await prisma.invite.findUnique({
        where: { email: user.email },
      });

      if (invite) return true;

      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      return !!existingUser;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email) {
        await prisma.invite.updateMany({
          where: { email: user.email, status: "PENDING" },
          data: { status: "ACCEPTED", usedAt: new Date() },
        });
      }
    },
  },
});

export const { handlers, auth: _auth, signIn, signOut } = nextAuth;

// DEV BYPASS — returns a mock session when no real session exists in development
export async function auth() {
  const session = await _auth();
  if (session) return session;

  if (process.env.NODE_ENV === "development") {
    return {
      user: {
        id: "dev-user",
        email: "sam@loyd.family",
        name: "Sam (Dev)",
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };
  }

  return null;
}
