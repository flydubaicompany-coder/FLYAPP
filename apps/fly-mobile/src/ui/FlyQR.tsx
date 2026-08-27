import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'qrcode';
import Svg, { Path, Rect } from 'react-native-svg';
import { radius, space } from '@/theme';
import { Text } from './Text';
import { formatar, soletrar } from './flyId';

/**
 * QR pessoal do Fly ID (§9.1).
 *
 * O conteudo e o `public_id` opaco — nunca o uuid do usuario, nunca nome,
 * nunca e-mail. A §7.8 e literal: "token opaco ou assinado, sem dados pessoais
 * brutos". Um QR e fotografado, impresso e compartilhado sem pensar; o que
 * estiver dentro dele vaza junto.
 *
 * Renderizado como um unico `Path` em vez de centenas de `Rect`: um QR de
 * versao 2 tem 441 modulos, e 441 nos de SVG travam a rolagem em aparelho
 * modesto.
 */

export interface FlyQRProps {
  /** O identificador opaco. */
  value: string;
  size?: number;
  /** Rotulo legivel embaixo do codigo, para leitura manual na base. */
  showValue?: boolean;
}

const QUIET_ZONE = 2;

export function FlyQR({ value, size = 200, showValue = true }: FlyQRProps) {
  const { path, cells } = useMemo(() => construirPath(value), [value]);

  if (!path) {
    return (
      <View style={[styles.container, { width: size }]}>
        <Text variant="body" tone="muted">
          Código indisponível
        </Text>
      </View>
    );
  }

  const total = cells + QUIET_ZONE * 2;

  return (
    <View style={styles.container}>
      <View style={[styles.frame, { width: size, height: size }]}>
        <Svg
          width={size - space.lg * 2}
          height={size - space.lg * 2}
          viewBox={`0 0 ${total} ${total}`}
        >
          {/* Fundo claro: leitor de QR precisa de contraste alto, e nenhum
              aparelho le codigo escuro sobre fundo escuro de forma confiavel. */}
          <Rect x={0} y={0} width={total} height={total} fill="#FFFFFF" />
          <Path d={path} fill="#08080A" />
        </Svg>
      </View>

      {showValue ? (
        <Text variant="body" tone="muted" style={styles.value} accessibilityLabel={soletrar(value)}>
          {formatar(value)}
        </Text>
      ) : null}
    </View>
  );
}

/** Constroi um unico path com um retangulo por modulo escuro. */
function construirPath(value: string): { path: string; cells: number } {
  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const cells = qr.modules.size;
    const data = qr.modules.data;

    let d = '';
    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        if (data[y * cells + x]) {
          d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
        }
      }
    }
    return { path: d, cells };
  } catch {
    return { path: '', cells: 0 };
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space.md,
  },
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    borderRadius: radius.block,
    backgroundColor: '#FFFFFF',
  },
  value: {
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
