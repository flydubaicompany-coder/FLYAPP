/**
 * @fly/domain-types
 *
 * Tipos de dominio compartilhados. Na Fase 0 cobrem papeis, superficies e os
 * tipos gerados do banco — o modelo completo da §19 da spec chega nas fases
 * seguintes, uma migration por vez.
 */
export * from './roles';
export * from './moeda';
export type { Database, Json } from './database.types';
export { Constants as DatabaseConstants } from './database.types';
