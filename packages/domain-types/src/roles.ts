/**
 * Papeis do ecossistema Fly (spec §18).
 *
 * Principio da spec, literal: "o papel permite uma funcao; a atribuicao limita
 * a viagem; o consentimento limita o dado."
 *
 * O papel vive em tabela protegida no banco, NUNCA em metadado editavel pelo
 * usuario (spec §21.4). Esta lista existe para tipar o cliente — ela nao
 * autoriza nada por si so. Toda decisao de acesso e tomada por RLS no servidor.
 */

export const FLY_ROLES = [
  'customer',
  'family_lead',
  'creator',
  'guide',
  'base',
  'media',
  'experience',
  'support',
  'finance',
  'trip_manager',
  'admin',
] as const;

export type FlyRole = (typeof FLY_ROLES)[number];

export function isFlyRole(value: string): value is FlyRole {
  return (FLY_ROLES as readonly string[]).includes(value);
}

/** Papeis internos da equipe — tudo que nao e cliente ou familiar do cliente. */
export const STAFF_ROLES = [
  'guide',
  'base',
  'media',
  'experience',
  'support',
  'finance',
  'trip_manager',
  'admin',
] as const satisfies readonly FlyRole[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: FlyRole): role is StaffRole {
  return (STAFF_ROLES as readonly FlyRole[]).includes(role);
}

/** Superficies do ecossistema (spec §2.1). */
export const FLY_SURFACES = ['fly_app', 'fly_ops', 'fly_crew'] as const;
export type FlySurface = (typeof FLY_SURFACES)[number];

/**
 * Em que superficie cada papel entra. Isto e uma dica de roteamento de UI,
 * nao um controle de seguranca — o servidor decide de novo, sempre.
 */
export const ROLE_SURFACES: Record<FlyRole, readonly FlySurface[]> = {
  customer: ['fly_app'],
  family_lead: ['fly_app'],
  creator: ['fly_app'],
  guide: ['fly_crew'],
  base: ['fly_crew'],
  media: ['fly_crew'],
  experience: ['fly_crew', 'fly_ops'],
  support: ['fly_crew', 'fly_ops'],
  finance: ['fly_ops'],
  trip_manager: ['fly_ops', 'fly_crew'],
  admin: ['fly_ops', 'fly_crew'],
};
