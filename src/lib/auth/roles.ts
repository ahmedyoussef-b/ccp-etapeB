// src/lib/auth/roles.ts
export type Role = 'admin' | 'superviseur' | 'chef-de-bloc' | 'chef-de-quart' | 'rondier';

export const ROLES = {
  ADMIN: 'admin',
  SUPERVISEUR: 'superviseur',
  CHEF_DE_BLOC: 'chef-de-bloc',
  CHEF_DE_QUART: 'chef-de-quart',
  RONDIER: 'rondier',
} as const;

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 5,
  superviseur: 4,
  'chef-de-bloc': 3,
  'chef-de-quart': 2,
  rondier: 1,
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  superviseur: 'Superviseur',
  'chef-de-bloc': 'Chef de bloc',
  'chef-de-quart': 'Chef de quart',
  rondier: 'Rondier',
};

// Permissions par rôle
export const PERMISSIONS = {
  // Procédures
  CREATE_PROCEDURE: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART],
  EDIT_PROCEDURE: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART],
  DELETE_PROCEDURE: [ROLES.ADMIN, ROLES.SUPERVISEUR],
  APPROVE_PROCEDURE: [ROLES.ADMIN, ROLES.SUPERVISEUR],
  EXECUTE_PROCEDURE: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART, ROLES.RONDIER],

  // Utilisateurs
  MANAGE_USERS: [ROLES.ADMIN, ROLES.SUPERVISEUR],
  VIEW_USERS: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART],

  // Équipes
  MANAGE_TEAMS: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART],
  VIEW_TEAMS: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART, ROLES.RONDIER],

  // Rapports
  CREATE_REPORT: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART, ROLES.RONDIER],
  VIEW_REPORTS: [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART, ROLES.RONDIER],
} as const;

export function hasPermission(role: Role, permission: keyof typeof PERMISSIONS): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isAdmin(role: Role): boolean {
  return role === ROLES.ADMIN;
}

const EDIT_ROLES: Role[] = [ROLES.ADMIN, ROLES.SUPERVISEUR, ROLES.CHEF_DE_BLOC, ROLES.CHEF_DE_QUART];
const APPROVE_ROLES: Role[] = [ROLES.ADMIN, ROLES.SUPERVISEUR];

export function canEdit(role: Role): boolean {
  return EDIT_ROLES.includes(role);
}

export function canApprove(role: Role): boolean {
  return APPROVE_ROLES.includes(role);
}
