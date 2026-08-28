import Svg, { Circle, Path } from 'react-native-svg';
import { bottomBar } from '@/theme';

/**
 * Icones das abas.
 *
 * Os paths sao os do prototipo do Claude Design, copiados literalmente — nao
 * substitutos de uma biblioteca de icones. Trocar por Feather ou Ionicons
 * mudaria o peso do traco e a construcao dos glifos, que e justamente o que
 * faz a barra parecer desenhada e nao montada.
 *
 * `stroke="currentColor"` no design vira a prop `color` aqui.
 */

export interface TabIconProps {
  color: string;
  size?: number;
}

function Frame({
  color,
  size = bottomBar.iconSize,
  children,
}: TabIconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={bottomBar.iconStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function HomeIcon(props: TabIconProps) {
  return (
    <Frame {...props}>
      <Path d="M3.4 10.6L12 4l8.6 6.6V20a1 1 0 0 1-1 1h-4.8v-6H10.2v6H5.4a1 1 0 0 1-1-1z" />
    </Frame>
  );
}

export function ToursIcon(props: TabIconProps) {
  return (
    <Frame {...props}>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M15.4 8.6l-2.1 4.7-4.7 2.1 2.1-4.7z" />
    </Frame>
  );
}

export function WalletIcon(props: TabIconProps) {
  return (
    <Frame {...props}>
      <Path d="M3 8.4A3.4 3.4 0 0 1 6.4 5h11.2A3.4 3.4 0 0 1 21 8.4v7.2a3.4 3.4 0 0 1-3.4 3.4H6.4A3.4 3.4 0 0 1 3 15.6z" />
      <Path d="M14.8 12h6.2" />
    </Frame>
  );
}

export function ProfileIcon(props: TabIconProps) {
  return (
    <Frame {...props}>
      <Circle cx={12} cy={8.3} r={3.7} />
      <Path d="M4.9 20.2c.9-3.9 3.7-5.8 7.1-5.8s6.2 1.9 7.1 5.8" />
    </Frame>
  );
}

/** Carrinho da coluna flutuante. */
export function CartIcon({ color, size = 22 }: TabIconProps) {
  return (
    <Frame color={color} size={size}>
      <Path d="M4 5h2.2l2.1 9.6a1.6 1.6 0 0 0 1.6 1.3h7.4a1.6 1.6 0 0 0 1.6-1.3L20 8H7" />
      <Circle cx={10.5} cy={19.5} r={1.3} />
      <Circle cx={17.5} cy={19.5} r={1.3} />
    </Frame>
  );
}

/**
 * Fly Assist / SOS.
 *
 * Deliberadamente diferente do carrinho em forma e em cor (§4.2: "o botao de
 * emergencia nunca deve ter a mesma cor ou icone do carrinho").
 */
export function AssistIcon({ color, size = 22 }: TabIconProps) {
  return (
    <Frame color={color} size={size}>
      <Path d="M12 3.2a8.8 8.8 0 0 1 8.8 8.8v4.2a2.6 2.6 0 0 1-2.6 2.6h-1.1v-6.2h3.7" />
      <Path d="M3.2 16.2V12A8.8 8.8 0 0 1 12 3.2" />
      <Path d="M3.2 12.6h3.7v6.2H5.8a2.6 2.6 0 0 1-2.6-2.6" />
      <Path d="M12 20.8h2.4" />
    </Frame>
  );
}

/**
 * Boia salva-vidas do botao Fly Assist / SOS.
 *
 * Copiado do prototipo: dois circulos concentricos (8.6 e 3.4) e quatro
 * tracos diagonais. Nao e uma mira — eu tinha desenhado uma, e a leitura muda:
 * mira e alvo, boia e socorro.
 */
export function LifeRingIcon({ color, size = 23 }: TabIconProps) {
  return (
    <Frame color={color} size={size}>
      <Circle cx={12} cy={12} r={8.6} />
      <Circle cx={12} cy={12} r={3.4} />
      <Path d="M6 6l3.6 3.6" />
      <Path d="M18 6l-3.6 3.6" />
      <Path d="M18 18l-3.6-3.6" />
      <Path d="M6 18l3.6-3.6" />
    </Frame>
  );
}

/**
 * Carrinho do botao flutuante. Traco 1.6, tamanho 22, como o prototipo.
 */
export function CartFloatIcon({ color, size = 22 }: TabIconProps) {
  return (
    <Frame color={color} size={size}>
      <Path d="M3 4.6h2.5l2.6 11.2h9.3l2.3-8.2H6.7" />
      <Circle cx={9.7} cy={19.3} r={1.5} />
      <Circle cx={17.3} cy={19.3} r={1.5} />
    </Frame>
  );
}
