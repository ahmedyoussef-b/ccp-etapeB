// src/lib/auth/auth.config.ts
// Configuration partagée NextAuth (sans providers) pour rester compatible
// avec le middleware qui s'exécute en edge runtime.
import type { NextAuthOptions } from 'next-auth';
import { Role } from './roles';

export const authConfig: Omit<NextAuthOptions, 'providers'> = {
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role?: Role; id?: string };
        if (u.role) token.role = u.role;
        if (u.id) token.id = u.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role;
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 heures
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};
