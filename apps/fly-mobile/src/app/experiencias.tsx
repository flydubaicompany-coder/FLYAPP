import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, Screen, Text } from '@/ui';
import { CardPasseio } from '@/passeios/CardPasseio';
import { usePasseios } from '@/passeios/usePasseios';
import { useSuporteFly } from '@/trip';

/**
 * Mais experiências — Trip Mode.
 *
 * O catálogo é o mesmo de Passeios: mesma consulta, mesmo cartão, mesma
 * imagem. Construir uma segunda listagem seria criar um segundo lugar para
 * cadastrar experiência, e no dia seguinte os dois discordariam.
 *
 * O que muda é o fim do fluxo. Não há checkout nesta viagem — o parceiro de
 * pagamento continua pendente (P09/P38) e o que existe é sandbox. Então o
 * botão não compra: ele **abre a conversa** com a mensagem pronta, e quem
 * fecha a venda é a operação, que é como a Fly já vende hoje.
 *
 * Isso é deliberadamente menos do que a Fase 5 entregou. Prometer "comprar"
 * numa tela cujo pagamento é sandbox seria a única mentira possível numa
 * viagem em que alguém vai clicar de verdade.
 */
export default function MaisExperiencias() {
  const { pagina, carregando, erro, carregarMais, acabou } = usePasseios({});
  const suporte = useSuporteFly();
  const [pedindo, setPedindo] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  async function solicitar(titulo: string) {
    setPedindo(titulo);
    setRecado(null);
    const abriu = await suporte.pedirExperiencia(titulo);
    setPedindo(null);
    if (!abriu) {
      setRecado(
        suporte.pronto
          ? 'Não consegui abrir o WhatsApp. Fale com alguém da equipe Fly.'
          : 'O canal de atendimento ainda não foi configurado.',
      );
    }
  }

  return (
    <Screen scroll>
      <AppHeader kicker="Fly" title="Mais experiências" />

      <Text variant="body" tone="muted" style={styles.intro}>
        Escolha e a equipe Fly organiza pelo WhatsApp. Sem pagamento no app: quem fecha é a
        operação, com você.
      </Text>

      {recado ? <ErrorState description={recado} /> : null}
      {erro ? <ErrorState description={erro} /> : null}
      {carregando && pagina.itens.length === 0 ? <LoadingSkeleton /> : null}

      {!carregando && pagina.itens.length === 0 && !erro ? (
        <EmptyState
          title="Nada por aqui ainda"
          description="A Fly publica as experiências da viagem por aqui. Fale com a equipe se quiser algo específico."
        />
      ) : null}

      {pagina.itens.map((p) => (
        <View key={p.id} style={styles.item}>
          <CardPasseio passeio={p} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Solicitar ${p.titulo}`}
            accessibilityHint="Abre o WhatsApp da Fly com o pedido pronto"
            disabled={!suporte.pronto || pedindo !== null}
            onPress={() => void solicitar(p.titulo)}
            style={({ pressed }) => [
              styles.solicitar,
              pressed && styles.pressionado,
              !suporte.pronto && styles.desligado,
            ]}
            testID={`solicitar-${p.slug}`}
          >
            <Text variant="body" style={styles.solicitarTexto}>
              {pedindo === p.titulo ? 'Abrindo…' : 'Solicitar experiência'}
            </Text>
          </Pressable>
        </View>
      ))}

      {!acabou && pagina.itens.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver mais experiências"
          onPress={() => void carregarMais()}
          style={styles.verMais}
        >
          <Text variant="body" tone="muted">
            {carregando ? 'Carregando…' : 'Ver mais'}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: space.lg,
  },
  item: {
    marginBottom: space.xl,
    gap: space.sm,
  },
  solicitar: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.goldBorder,
    backgroundColor: palette.goldFill,
  },
  solicitarTexto: {
    color: palette.gold,
  },
  pressionado: {
    opacity: 0.7,
  },
  desligado: {
    opacity: 0.45,
  },
  verMais: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
