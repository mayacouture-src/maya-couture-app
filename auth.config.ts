import type { NextAuthConfig } from "next-auth";

// Config edge-safe : pas d'import Node-only ici (pas de Prisma, pas d'argon2).
// C'est ce fichier qui est utilisé par le middleware.
export default {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 60
  },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      // Le matcher du middleware exclut déjà /login et /api/auth/*.
      // Donc tout ce qui passe ici doit être authentifié.
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: "ADMIN" | "STAFF" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "STAFF";
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
