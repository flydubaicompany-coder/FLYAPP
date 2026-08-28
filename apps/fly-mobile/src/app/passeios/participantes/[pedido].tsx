import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { dataCurta, hora } from '@/viagem/tempo';

/**
 * Quem vai (§40.5 e §6.5, passo 5).
 *
 * Um campo por vaga comprada, e nem um a mais: o número de campos vem de
 * `order_items.people`, que é o que o servidor vendeu. Não há botão de
 * "adicionar pessoa" — adicionar pessoa é comprar outra vaga, e isso acontece
 * no carrinho, com preço e disponibilidade.
 *
 * **Nome, e só.** Nada de documento aqui. O passaporte mora em `passports`,
 * com consentimento e registro de quem leu; copiá-lo para dentro do pedido
 * criaria uma segunda cópia do dado mais sensível do app, fora daquele
 * controle.
 *
 * Deixar em branco é uma resposta válida — a lista pode ser completada depois,
 * e um campo vazio simplesmente não vira participante. O que a tela não
 * permite é gravar mais nomes do que vagas; quem recusa isso é
 * `definir_participantes()`, no servidor, e a tela só repete o motivo.
 */

interface Item {
  id: string;
  titulo: string;
  variante: string;
  comeca: string | null;
  timezone: string | null;
  vagas: number;
  /** Um por vaga. Posições vazias são vagas ainda sem nome. */
  nomes: string[];
}

type Estado =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'nao-encontrado' }
  | { kind: 'ready'; referencia: string; encerrado: boolean; itens: Item[] };

export default function ParticipantesScreen() {
  const { pedido: pedidoId } = useLocalSearchParams<{ pedido?: string }>();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ kind: 'loading' });
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!pedidoId) return;
    setEstado({ kind: 'loading' });

    const { data, error } = await supabase()
      .from('orders')
      .select(
        'id, reference, status, order_items(id, tour_title, variant_label, starts_at, timezone, people, order_participants(id, full_name))',
      )
      .eq('id', pedidoId)
      .maybeSingle();

    if (error) return setEstado({ kind: 'error', message: error.message });
    if (!data) return setEstado({ kind: 'nao-encontrado' });

    setEstado({
      kind: 'ready',
      referencia: data.reference,
      // Pedido encerrado vira histórico: a lista é o que foi vendido, e o
      // servidor recusa a alteração de qualquer forma.
      encerrado: ['cancelled', 'refunded'].includes(data.status),
      itens: (data.order_items ?? []).map((i) => {
        const gravados = (i.order_participants ?? []).map((p) => p.full_name);
        return {
          id: i.id,
          titulo: i.tour_title,
          variante: i.variant_label,
          comeca: i.starts_at,
          timezone: i.timezone,
          vagas: i.people,
          // Um campo por vaga, preenchendo com o que já existe.
          nomes: Array.from({ length: i.people }, (_, n) => gravados[n] ?? ''),
        };
      }),
    });
  }, [pedidoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function escrever(itemId: string, posicao: number, valor: string) {
    setEstado((atual) => {
      if (atual.kind !== 'ready') return atual;
      return {
        ...atual,
        itens: atual.itens.map((i) =>
          i.id === itemId ? { ...i, nomes: i.nomes.map((n, k) => (k === posicao ? valor : n)) } : i,
        ),
      };
    });
  }

  async function salvar(item: Item) {
    setSalvando(item.id);
    setAviso(null);

    const { data, error } = await supabase().rpc('definir_participantes', {
      p_order_item: item.id,
      p_nomes: item.nomes,
    });

    setSalvando(null);

    if (error) {
      setAviso('Não consegui salvar agora. Tente de novo.');
      return;
    }

    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha?.ok) {
      // O motivo vem do servidor, que é quem conhece o limite.
      setAviso(linha?.motivo ?? 'Não consegui salvar.');
      return;
    }

    const n = linha.gravados ?? 0;
    setAviso(
      n === 0
        ? 'Lista limpa. Você pode preencher depois.'
        : `${n} ${n === 1 ? 'nome guardado' : 'nomes guardados'} para ${item.titulo}.`,
    );
  }

  if (estado.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-participantes">
        <LoadingSkeleton label="Carregando quem vai" />
      </Screen>
    );
  }

  if (estado.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-participantes">
        <AppHeader kicker="Passeios" title="Não carregou" onBack={() => router.back()} />
        <ErrorState description={estado.message} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (estado.kind === 'nao-encontrado') {
    return (
      <Screen withBottomNav={false} testID="screen-participantes">
        <AppHeader kicker="Passeios" title="Não encontrei" onBack={() => router.back()} />
        <EmptyState title="Este pedido não existe" description="Confira em Meus passeios." />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-participantes">
      <AppHeader kicker={estado.referencia} title="Quem vai" onBack={() => router.back()} />

      {aviso ? <AlertBanner title={aviso} /> : null}

      {estado.encerrado ? (
        <AlertBanner
          severity="warning"
          title="Pedido encerrado"
          description="A lista continua visível como histórico do que foi vendido, mas não muda mais."
        />
      ) : (
        <Text variant="body" tone="muted">
          Um campo por vaga comprada. Só o nome — o passaporte fica no seu cofre, e a Fly não
          precisa dele aqui.
        </Text>
      )}

      {estado.itens.map((item) => (
        <View key={item.id} style={styles.secao}>
          <Kicker>
            {item.vagas} {item.vagas === 1 ? 'vaga' : 'vagas'}
          </Kicker>
          <Card>
            <View style={styles.bloco}>
              <Text variant="body" style={styles.titulo}>
                {item.titulo}
              </Text>
              <Text variant="body" tone="muted">
                {item.variante}
                {item.comeca
                  ? ` · ${dataCurta(item.comeca, item.timezone ?? 'UTC')} ${hora(item.comeca, item.timezone ?? 'UTC')}`
                  : ''}
              </Text>

              {item.nomes.map((nome, n) => (
                <Field
                  key={`${item.id}-${n}`}
                  label={`Pessoa ${n + 1}`}
                  value={nome}
                  editable={!estado.encerrado}
                  autoCapitalize="words"
                  placeholder="Nome completo"
                  onChangeText={(v) => escrever(item.id, n, v)}
                  testID={`participante-${item.id}-${n}`}
                />
              ))}

              {estado.encerrado ? null : (
                <Botao
                  rotulo="Guardar esta lista"
                  ocupado={salvando === item.id}
                  onPress={() => void salvar(item)}
                  testID={`salvar-${item.id}`}
                />
              )}
            </View>
          </Card>
        </View>
      ))}

      <View style={styles.secao}>
        <Botao
          rotulo="Voltar ao pedido"
          variante="fantasma"
          onPress={() => router.replace(`/passeios/pedido/${pedidoId}` as never)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.md },
  secao: { gap: space.md, marginTop: space.section },
  titulo: { fontWeight: '600' },
});
