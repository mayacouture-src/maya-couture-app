import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Le middleware tourne en Edge runtime — il n'importe QUE auth.config.ts
// (pas auth.ts qui amène Prisma + argon2 = Node-only).
// La protection est gérée par le callback `authorized` dans authConfig
// (côté authConfig : authentifié requis pour tout sauf login + api/auth).
export default NextAuth(authConfig).auth;

// Match tout SAUF login, api/auth, internals Next, fichiers statiques.
export const config = {
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"
  ]
};
