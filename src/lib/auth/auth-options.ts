// src/lib/auth/auth-options.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { Role as PrismaRole } from '@prisma/client';
import { authConfig } from './auth.config';
import { Role } from './roles';

// ====== Interface de l'utilisateur ======
export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  teamId?: string | null;
  createdAt: Date;
}

// ====== Mapping Prisma Role (snake_case) -> app Role (kebab-case) ======
// Le type Role de l'app utilise des tirets (ex: "chef-de-bloc") incompatible
// avec un enum Prisma (identifiants sans tiret). On mappe explicitement.
const PRISMA_ROLE_TO_APP: Record<PrismaRole, Role> = {
  admin: 'admin',
  superviseur: 'superviseur',
  chef_de_bloc: 'chef-de-bloc',
  chef_de_quart: 'chef-de-quart',
  rondier: 'rondier',
};

function toAppRole(role: PrismaRole): Role {
  return PRISMA_ROLE_TO_APP[role];
}

// ====== Configuration NextAuth ======
export const authOptions: NextAuthOptions = {
  ...authConfig,

  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'email@nexaflow.com' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[NexaFlow][Auth] Tentative de connexion:', credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.warn('[NexaFlow][Auth] Email ou mot de passe manquant');
          return null;
        }

        // Récupérer l'utilisateur depuis PostgreSQL
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            passwordHash: true,
            teamId: true,
          },
        });

        if (!user) {
          console.warn(`[NexaFlow][Auth] Utilisateur introuvable: ${credentials.email}`);
          return null;
        }

        // Vérifier le mot de passe avec bcrypt
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          console.warn(`[NexaFlow][Auth] Mot de passe incorrect pour: ${credentials.email}`);
          return null;
        }

        console.log(`[NexaFlow][Auth] Connexion réussie: ${user.email} (${user.role})`);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: toAppRole(user.role),
          teamId: user.teamId,
        };
      },
    }),
  ],
};

// ====== Types étendus pour la session ======
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }

  interface User {
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role;
    id: string;
  }
}
