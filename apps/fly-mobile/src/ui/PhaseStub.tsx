import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import { Text } from './Text';

/**
 * Marcador de area ainda nao construida.
 *
 * A Fase 1 entrega "rotas e layouts de todas as areas principais" (§36.6) sem
 * entregar as telas. Este componente deixa isso explicito para quem abre o app:
 * a area existe, a navegacao funciona, e o conteudo tem fase e dono.
 *
 * Ele **nao** e um placeholder de dado ficticio. Nao invente preco, horario ou
 * disponibilidade aqui (§33).
 */
export interface PhaseStubProps {
  /** Numero da fase que entrega esta area. */
  phase: number;
  /** O que essa area vai fazer, em uma frase. */
  summary: string;
  /** Blocos previstos, na ordem da spec. */
  planned: readonly string[];
  /** Secao da spec, para quem for implementar. */
  specRef: string;
}

export function PhaseStub({ phase, summary, planned, specRef }: PhaseStubProps) {
  return (
    <View style={styles.container} testID={`phase-stub-${phase}`}>
      <View style={styles.badge}>
        <Text variant="caption" tone="gold">
          {`FASE ${phase}`}
        </Text>
      </View>

      <Text variant="body" tone="muted">
        {summary}
      </Text>

      <View style={styles.list}>
        {planned.map((item) => (
          <View key={item} style={styles.row}>
            <View style={styles.marker} />
            <Text variant="body" tone="muted" style={styles.rowLabel}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="body" tone="faint">
        {`Especificação ${specRef}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.goldBorder,
    backgroundColor: palette.goldFill,
  },
  list: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  marker: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: palette.textFaint,
  },
  rowLabel: {
    flex: 1,
  },
});
