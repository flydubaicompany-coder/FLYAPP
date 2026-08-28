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
 * Mira do botao Fly Assist / SOS.
 *
 * O handoff pede "glifo escuro de mira" — equivalente ao `dot.scope` das SF
 * Symbols. Substitui o fone de ouvido, que dizia "atendimento" quando o botao
 * precisa dizer "socorro".
 */
export function ScopeIcon({ color, size = 22 }: TabIconProps) {
  return (
    <Frame color={color} size={size}>
      <Path d="M12 4.4a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2Z" />
      <Path d="M12 1.9v3.4M12 18.7v3.4M1.9 12h3.4M18.7 12h3.4" />
      <Path d="M12 10.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z" />
    </Frame>
  );
}
