import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AppHeader,
  Card,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { useViagem } from '@/viagem/useViagem';

/**
 * Tudo que está incluso (§7.4).
 *
 * A exigência que dá o formato da tela: "itens opcionais devem ser claramente
 * diferenciados de itens já pagos". Não basta uma cor diferente — o item
 * opcional carrega o rótulo, e a seção separa os dois grupos, porque a
 * pergunta que a pessoa faz aqui é "isso eu já paguei?".
 */

const ROTULO_CATEGORIA: Record<string, string> = {
  air: 'Aéreo',
  lodging: 'Hospedagem',
  food: 'Alimentação',
  transport: 'Transporte',
  tours: 'Passeios',
  insurance: 'Seguro',
  benefits: 'Benefícios',
  press_kit: 'Press kit',
  special: 'Serviços especiais',
};

const ORDEM_CATEGORIA = [
  'air',
  'lodging',
  'food',
  'transport',
  'tours',
  'insurance',
  'benefits',
  'press_kit',
  'special',
];

const ROTULO_STATUS: Record<string, string> = {
  included: 'Incluso',
  optional: 'Opcional',
  purchased: 'Comprado',
  unavailable: 'Indisponível',
};

interface Item {
  id: string;
  categoria: string;
  titulo: string;
  detalhes: string | null;
  regras: string | null;
  status: string;
  opcional: boolean;
}

export default function InclusoScreen() {
  const { data: viagemData } = useViagem();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tripId = viagemData.kind === 'ready' ? viagemData.viagem.id : null;

  const carregar = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase()
      .from('trip_inclusions')
      .select('id, category, title, details, rules, status, is_optional, sort_order')
      .eq('trip_id', tripId)
      .order('sort_order');

    if (error) return setErro(error.message);
    setItens(
      (data ?? []).map((i) => ({
        id: i.id,
        categoria: i.category,
        titulo: i.title,
        detalhes: i.details,
        regras: i.rules,
        status: i.status,
        opcional: i.is_optional,
      })),
    );
  }, [tripId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (viagemData.kind === 'semViagem') {
    return (
      <Screen withBottomNav={false} testID="screen-incluso">
        <AppHeader kicker="Incluso" title="Sem viagem ativa" />
        <EmptyState title="Nada por aqui ainda" description="A lista aparece com a sua viagem." />
      </Screen>
    );
  }

  if (erro) {
    return (
      <Screen withBottomNav={false} testID="screen-incluso">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!itens) {
    return (
      <Screen withBottomNav={false} testID="screen-incluso">
        <LoadingSkeleton label="Carregando o que está incluso" />
      </Screen>
    );
  }

  const jaPago = itens.filter((i) => !i.opcional && i.status !== 'unavailable');
  const opcionais = itens.filter((i) => i.opcional);

  function porCategoria(lista: Item[]) {
    return ORDEM_CATEGORIA.map((cat) => ({
      cat,
      itens: lista.filter((i) => i.categoria === cat),
    })).filter((g) => g.itens.length > 0);
  }

  function Grupo({ titulo, lista }: { titulo: string; lista: Item[] }) {
    if (lista.length === 0) return null;
    return (
      <View style={styles.secao}>
        <Kicker>{titulo}</Kicker>
        {porCategoria(lista).map((g) => (
          <View key={g.cat} style={styles.categoria}>
            <Text variant="body" tone="muted">
              {ROTULO_CATEGORIA[g.cat] ?? g.cat}
            </Text>
            {g.itens.map((i) => (
              <Card key={i.id}>
                <View style={styles.item}>
                  <View style={styles.linhaTopo}>
                    <Text variant="body" style={styles.titulo}>
                      {i.titulo}
                    </Text>
                    <Text variant="body" tone={i.opcional ? 'gold' : 'faint'}>
                      {ROTULO_STATUS[i.status] ?? i.status}
                    </Text>
                  </View>
                  {i.detalhes ? (
                    <Text variant="body" tone="muted">
                      {i.detalhes}
                    </Text>
                  ) : null}
                  {i.regras ? (
                    <Text variant="body" tone="faint">
                      {i.regras}
                    </Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-incluso">
      <AppHeader kicker="Sua viagem" title="Tudo que está incluso" />

      {itens.length === 0 ? (
        <EmptyState
          title="A lista está sendo montada"
          description="A Fly publica aqui o que já está pago e o que é opcional."
        />
      ) : (
        <>
          <Grupo titulo="Já está pago" lista={jaPago} />
          <Grupo titulo="Opcional, ainda não contratado" lista={opcionais} />

          <View style={styles.rodape}>
            <Text variant="body" tone="faint">
              Dúvida sobre qualquer item? A Fly responde pelo botão de ajuda.
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  secao: { gap: space.md, marginTop: space.section },
  categoria: { gap: space.sm },
  item: { gap: space.xs },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.md,
  },
  titulo: { fontWeight: '600', flexShrink: 1 },
  rodape: {
    marginTop: space.section,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
});
