import type { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Os icones do Perfil, copiados tracado a tracado de
 * `docs/design/extracao/06-perfil.html`.
 *
 * Todos partem do mesmo `viewBox` de 24, com `strokeWidth` 1.7 e pontas
 * redondas — e o que da a eles o mesmo peso otico numa lista. O tamanho
 * padrao e 19, que e a medida do design; a engrenagem do cabecalho usa 17.
 */

const TRACO = 'rgba(245,245,247,.72)';

export interface IconeProps {
  size?: number;
  color?: string;
}

function Base({ size = 19, children }: { size?: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

const traco = (color: string) => ({
  stroke: color,
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function EngrenagemIcon({ size = 17, color = 'rgba(245,245,247,.8)' }: IconeProps) {
  return (
    <Base size={size}>
      <Circle cx={12} cy={12} r={3.2} {...traco(color)} />
      <Path
        d="M19.2 14.6a7.8 7.8 0 0 0 0-5.2l-2-.5-1-1.7.6-2a7.8 7.8 0 0 0-4.5-2.6L11 4.4H9l-1.3-1.8a7.8 7.8 0 0 0-4.5 2.6l.6 2-1 1.7-2 .5a7.8 7.8 0 0 0 0 5.2l2 .5 1 1.7-.6 2a7.8 7.8 0 0 0 4.5 2.6L9 19.6h2l1.3 1.8a7.8 7.8 0 0 0 4.5-2.6l-.6-2 1-1.7z"
        {...traco(color)}
      />
    </Base>
  );
}

export function PessoaIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Circle cx={12} cy={8.3} r={3.7} {...traco(color)} />
      <Path d="M4.9 20.2c.9-3.9 3.7-5.8 7.1-5.8s6.2 1.9 7.1 5.8" {...traco(color)} />
    </Base>
  );
}

export function DocumentoIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path d="M5.4 4.6h13.2v14.8H5.4z" {...traco(color)} />
      <Path d="M8.8 9h6.4" {...traco(color)} />
      <Path d="M8.8 13h4.2" {...traco(color)} />
    </Base>
  );
}

export function AcompanhantesIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Circle cx={9.2} cy={8.6} r={3.3} {...traco(color)} />
      <Path d="M3.2 20c.8-3.4 3.1-5.1 6-5.1s5.2 1.7 6 5.1" {...traco(color)} />
      <Path d="M16.4 6.2a3.3 3.3 0 0 1 0 6.2" {...traco(color)} />
      <Path d="M17.6 14.6c2 .5 3.4 2.1 3.9 4.6" {...traco(color)} />
    </Base>
  );
}

export function TelefoneIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path
        d="M15.6 13.4l-1.9 1.9a13.6 13.6 0 0 1-5-5l1.9-1.9-2.7-4.6-2.7 1a2 2 0 0 0-1.1 2.2 18.8 18.8 0 0 0 14.9 11.9 2 2 0 0 0 2-1.2l1-2.6z"
        {...traco(color)}
      />
    </Base>
  );
}

export function SinoIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path d="M18 15.2v-4.6a6 6 0 1 0-12 0v4.6L4.4 17.8h15.2z" {...traco(color)} />
      <Path d="M9.7 20.4a2.5 2.5 0 0 0 4.6 0" {...traco(color)} />
    </Base>
  );
}

export function GloboIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Circle cx={12} cy={12} r={8.4} {...traco(color)} />
      <Path d="M3.6 12h16.8" {...traco(color)} />
      <Path
        d="M12 3.6c2.2 2.4 3.4 5.3 3.4 8.4s-1.2 6-3.4 8.4c-2.2-2.4-3.4-5.3-3.4-8.4s1.2-6 3.4-8.4z"
        {...traco(color)}
      />
    </Base>
  );
}

export function EscudoIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path
        d="M12 3.4l6.6 2.6v5.2c0 4.2-2.7 7.4-6.6 8.8-3.9-1.4-6.6-4.6-6.6-8.8V6z"
        {...traco(color)}
      />
      <Path d="M9.4 12.2l1.9 1.9 3.5-3.9" {...traco(color)} />
    </Base>
  );
}

export function CadeadoIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path d="M5.9 10.4h12.2v9.4H5.9z" {...traco(color)} />
      <Path d="M8.6 10.4V7.8a3.4 3.4 0 0 1 6.8 0v2.6" {...traco(color)} />
      <Circle cx={12} cy={15.1} r={1.3} {...traco(color)} />
    </Base>
  );
}

export function TrofeuIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path d="M8 4.2h8v5a4 4 0 0 1-8 0z" {...traco(color)} />
      <Path d="M8 5.6H5.4v1.8A2.8 2.8 0 0 0 8 10.1" {...traco(color)} />
      <Path d="M16 5.6h2.6v1.8A2.8 2.8 0 0 1 16 10.1" {...traco(color)} />
      <Path d="M12 13.2v3.2" {...traco(color)} />
      <Path d="M8.6 19.8h6.8l-.8-3.4H9.4z" {...traco(color)} />
    </Base>
  );
}

export function InfoIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Circle cx={12} cy={12} r={8.4} {...traco(color)} />
      <Path d="M12 11v5.2" {...traco(color)} />
      <Path d="M12 7.9v.1" {...traco(color)} />
    </Base>
  );
}

export function QuadradosIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path d="M4.6 4.6h6v6h-6z" {...traco(color)} />
      <Path d="M13.4 4.6h6v6h-6z" {...traco(color)} />
      <Path d="M4.6 13.4h6v6h-6z" {...traco(color)} />
      <Path d="M13.4 13.4h6v6h-6z" {...traco(color)} />
    </Base>
  );
}

export function PulsoIcon({ size, color = TRACO }: IconeProps) {
  return (
    <Base size={size}>
      <Path d="M3.4 12h4l2.2-5.4 4.4 11L16.4 12h4.2" {...traco(color)} />
    </Base>
  );
}

/** O chevron das linhas: 15, traco 2.2, bem mais apagado que o icone. */
export function ChevronIcon({ size = 15, color = 'rgba(245,245,247,.28)' }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
