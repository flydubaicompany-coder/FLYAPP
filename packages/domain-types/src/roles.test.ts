import { describe, expect, it } from 'vitest';
import {
  DatabaseConstants,
  FLY_ROLES,
  ROLE_SURFACES,
  STAFF_ROLES,
  isFlyRole,
  isStaffRole,
  type FlyRole,
} from './index';

describe('papeis', () => {
  it('reconhece um papel valido e recusa um invento', () => {
    expect(isFlyRole('guide')).toBe(true);
    expect(isFlyRole('super_admin')).toBe(false);
  });

  it('nao classifica cliente nem familiar como equipe', () => {
    expect(isStaffRole('customer')).toBe(false);
    expect(isStaffRole('family_lead')).toBe(false);
    expect(isStaffRole('creator')).toBe(false);
  });

  it('classifica todo papel de STAFF_ROLES como equipe', () => {
    for (const role of STAFF_ROLES) {
      expect(isStaffRole(role)).toBe(true);
    }
  });

  it('mapeia superficie para todos os papeis, sem sobrar nenhum', () => {
    const mapped = Object.keys(ROLE_SURFACES).sort();
    expect(mapped).toEqual([...FLY_ROLES].sort());
  });

  it('da pelo menos uma superficie a cada papel', () => {
    for (const role of FLY_ROLES) {
      expect(ROLE_SURFACES[role].length).toBeGreaterThan(0);
    }
  });

  it('mantem o cliente fora das superficies internas', () => {
    const clientFacing: FlyRole[] = ['customer', 'family_lead', 'creator'];
    for (const role of clientFacing) {
      expect(ROLE_SURFACES[role]).toEqual(['fly_app']);
    }
  });
});

describe('papeis do TypeScript x enum do banco', () => {
  /**
   * O enum public.fly_role e FLY_ROLES precisam andar juntos. Se uma migration
   * acrescentar um papel e ninguem atualizar roles.ts, este teste quebra — que
   * e exatamente o momento de descobrir, e nao em producao.
   */
  it('tem exatamente os mesmos papeis, sem sobra de nenhum lado', () => {
    expect([...DatabaseConstants.public.Enums.fly_role].sort()).toEqual([...FLY_ROLES].sort());
  });

  it('mantem a mesma ordem, para que o enum do Postgres nao seja reordenado', () => {
    expect([...DatabaseConstants.public.Enums.fly_role]).toEqual([...FLY_ROLES]);
  });
});
