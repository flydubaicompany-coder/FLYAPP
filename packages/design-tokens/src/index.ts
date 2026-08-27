/**
 * @fly/design-tokens
 *
 * Tokens visuais do Fly App, extraidos do projeto Claude Design
 * "Fly App mobile premium". A copia versionada do design esta em
 * docs/design/canvas/ e a procedencia esta em docs/design/DESIGN_SOURCE.md.
 *
 * Nenhum valor aqui pode ser alterado sem um ADR correspondente.
 */
export * from './color';
export * from './typography';
export * from './geometry';
export * from './spacing';
export * from './elevation';
export * from './motion';
export * from './contrast';

import { color } from './color';
import { typography } from './typography';
import { geometry } from './geometry';
import { spacing } from './spacing';
import { elevation } from './elevation';
import { motion } from './motion';

export const tokens = { color, typography, geometry, spacing, elevation, motion } as const;
