import { useCallback, useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
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
import { faltam, hora, ROTULO_STATUS, saidaEminente } from '@/viagem/tempo';

/**
 * Roteiro por dia (§7.3).
 *
 * Dois cuidados que a tela precisa ter, e que só aparecem em uso real:
 *
 * - **O dia certo abre primeiro.** Quem abre o roteiro no meio da viagem
 *   quer ver hoje, não o dia 1. Abrir sempre no primeiro dia obriga a pessoa
 *   a rolar toda vez.
 * - **Alterado é visível sem cor.** A §25.4 proíbe comunicar estado só por
 *   cor; o rótulo textual acompanha, e o leitor de tela anuncia.
 */

interface Atividade {
  id: string;
  titulo: string;
  status: string;
  comeca: string | null;
  termina: string | null;
  saida: string | null;
  ponto: string | null;
  alteradoEm: string | null;
  notaDaMudanca: string | null;
}

/**
 * Um passeio que a pessoa comprou e ligou a esta viagem (§40.11).
 *
 * Não é `Atividade`, e o tipo separado é de propósito: atividade é o que a Fly
 * organizou, compra é o que a pessoa escolheu por conta. Misturar os dois num
 * tipo só faria a tela perder a diferença — e a diferença importa quando algo
 * atrasa e alguém precisa saber com quem falar.
 */
interface Comprado {
  id: string;
  titulo: string;
  variante: string;
  comeca: string | null;
  pessoas: number;
  referencia: string;
}

interface Dia {
  id: string;
  numero: number;
  data: string;
  titulo: string | null;
  atividades: Atividade[];
  comprados: Comprado[];
}

export default function RoteiroScreen() {
  const { data: viagemData } = useViagem();
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<number | null>(null);

  const tripId = viagemData.kind === 'ready' ? viagemData.viagem.id : null;
  const timezone = viagemData.kind === 'ready' ? viagemData.viagem.timezone : 'UTC';
  const diaDeHoje = viagemData.kind === 'ready' ? viagemData.viagem.diaAtual : null;

  const carregar = useCallback(async () => {
    if (!tripId) return;

    const db = supabase();

    const [diasResp, pedidosResp] = await Promise.all([
      db
        .from('trip_days')
        .select(
          'id, day_number, day_date, title, activities(id, title, status, starts_at, ends_at, departure_at, meeting_point, changed_at, change_note, sort_order)',
        )
        .eq('trip_id', tripId)
        .order('day_number'),
      // Os pedidos que a pessoa ligou a esta viagem. Encerrado fica de fora: o
      // roteiro fala do que vai acontecer, e um passeio cancelado no meio da
      // lista é uma informação que atrapalha em vez de ajudar.
      db
        .from('orders')
        .select(
          'id, reference, status, order_items(id, tour_title, variant_label, starts_at, people)',
        )
        .eq('trip_id', tripId)
        .not('status', 'in', '(cancelled,refunded,failed)'),
    ]);

    const { data, error } = diasResp;
    if (error) return setErro(error.message);

    // A compra cai no dia cuja data bate com a do passeio, no fuso do destino.
    // Sem o fuso, um passeio às 21h de Dubai cairia no dia seguinte para quem
    // abrir o app no Brasil.
    const compradosPorData = new Map<string, Comprado[]>();
    for (const pedido of pedidosResp.data ?? []) {
      for (const item of pedido.order_items ?? []) {
        if (!item.starts_at) continue;
        const dia = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
          new Date(item.starts_at),
        );
        const lista = compradosPorData.get(dia) ?? [];
        lista.push({
          id: item.id,
          titulo: item.tour_title,
          variante: item.variant_label,
          comeca: item.starts_at,
          pessoas: item.people,
          referencia: pedido.reference,
        });
        compradosPorData.set(dia, lista);
      }
    }

    setDias(
      (data ?? []).map((d) => ({
        id: d.id,
        numero: d.day_number,
        data: d.day_date,
        titulo: d.title,
        atividades: (d.activities ?? [])
          .slice()
          .sort((a, b) => {
            // Horário manda; sem horário, a ordem definida no painel.
            if (a.starts_at && b.starts_at) return a.starts_at.localeCompare(b.starts_at);
            if (a.starts_at) return -1;
            if (b.starts_at) return 1;
            return a.sort_order - b.sort_order;
          })
          .map((a) => ({
            id: a.id,
            titulo: a.title,
            status: a.status,
            comeca: a.starts_at,
            termina: a.ends_at,
            saida: a.departure_at,
            ponto: a.meeting_point,
            alteradoEm: a.changed_at,
            notaDaMudanca: a.change_note,
          })),
        comprados: (compradosPorData.get(d.day_date) ?? []).sort((a, b) =>
          (a.comeca ?? '').localeCompare(b.comeca ?? ''),
        ),
      })),
    );
  }, [tripId, timezone]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Abre no dia de hoje. Antes ou depois da viagem, no primeiro.
  useEffect(() => {
    if (diaAberto === null && dias && dias.length > 0) {
      setDiaAberto(diaDeHoje ?? dias[0]?.numero ?? 1);
    }
  }, [dias, diaDeHoje, diaAberto]);

  if (viagemData.kind === 'semViagem') {
    return (
      <Screen withBottomNav={false} testID="screen-roteiro">
        <AppHeader kicker="Roteiro" title="Sem viagem ativa" />
        <EmptyState
          title="Nada por aqui ainda"
          description="O roteiro aparece quando sua viagem for publicada."
        />
      </Screen>
    );
  }

  if (erro) {
    return (
      <Screen withBottomNav={false} testID="screen-roteiro">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!dias) {
    return (
      <Screen withBottomNav={false} testID="screen-roteiro">
        <LoadingSkeleton label="Carregando o roteiro" />
      </Screen>
    );
  }

  const dia = dias.find((d) => d.numero === diaAberto) ?? dias[0];

  return (
    <Screen withBottomNav={false} testID="screen-roteiro">
      <AppHeader kicker="Roteiro" title="Dia a dia" />

      {dias.length === 0 ? (
        <EmptyState
          title="O roteiro está sendo montado"
          description="Assim que a Fly publicar, ele aparece aqui — sem você precisar atualizar o app."
        />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seletor}
          >
            {dias.map((d) => {
              const ativo = d.numero === dia?.numero;
              const hoje = d.numero === diaDeHoje;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="tab"
                  accessibilityLabel={`Dia ${d.numero}${hoje ? ', hoje' : ''}`}
                  accessibilityState={{ selected: ativo }}
                  aria-selected={ativo}
                  onPress={() => setDiaAberto(d.numero)}
                  style={[styles.chip, ativo && styles.chipAtivo]}
                  testID={`dia-${d.numero}`}
                >
                  <Text variant="body" tone={ativo ? 'gold' : 'muted'}>
                    Dia {d.numero}
                  </Text>
                  {hoje ? (
                    <Text variant="body" tone="faint">
                      hoje
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {dia ? (
            <View style={styles.lista}>
              {dia.titulo ? <Kicker>{dia.titulo}</Kicker> : null}

              {dia.atividades.length === 0 ? (
                <Card>
                  <Text variant="body" tone="muted">
                    {dia.comprados.length > 0
                      ? 'Nada marcado pela Fly neste dia — mas você comprou o que está abaixo.'
                      : 'Dia livre. Nada marcado pela Fly.'}
                  </Text>
                </Card>
              ) : (
                dia.atividades.map((a) => (
                  <Link key={a.id} href={`/viagem/atividade/${a.id}`} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`${a.titulo}. ${ROTULO_STATUS[a.status] ?? a.status}${
                        a.comeca ? `, ${hora(a.comeca, timezone)}` : ''
                      }`}
                      style={({ pressed }) => [
                        styles.atividade,
                        a.status === 'cancelled' && styles.cancelada,
                        a.status === 'changed' && styles.alterada,
                        pressed && styles.pressed,
                      ]}
                      testID={`atividade-${a.id}`}
                    >
                      <View style={styles.linhaTopo}>
                        <Text variant="body" tone="muted" style={styles.horario}>
                          {hora(a.comeca, timezone) ?? '—'}
                        </Text>
                        <View style={styles.corpo}>
                          <Text variant="body" style={styles.tituloAtividade}>
                            {a.titulo}
                          </Text>

                          {/* Estado em texto, nunca só em cor (§25.4). */}
                          <Text variant="body" tone={a.status === 'changed' ? 'gold' : 'faint'}>
                            {ROTULO_STATUS[a.status] ?? a.status}
                          </Text>

                          {saidaEminente(a.saida) && a.saida ? (
                            <Text variant="body" tone="gold">
                              Sair às {hora(a.saida, timezone)} · {faltam(a.saida)}
                            </Text>
                          ) : null}

                          {a.ponto ? (
                            <Text variant="body" tone="faint" numberOfLines={1}>
                              {a.ponto}
                            </Text>
                          ) : null}

                          {a.status === 'changed' && a.notaDaMudanca ? (
                            <Text variant="body" tone="muted">
                              {a.notaDaMudanca}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  </Link>
                ))
              )}

              {/* O que a pessoa comprou (§40.11).
                  Bloco separado, e não misturado às atividades: atividade é o
                  que a Fly organizou e responde por; compra é escolha dela. A
                  diferença deixa de ser detalhe no dia em que algo atrasa e
                  alguém precisa saber com quem falar. */}
              {dia.comprados.length > 0 ? (
                <View style={styles.comprados}>
                  <Kicker>Você comprou</Kicker>
                  {dia.comprados.map((c) => (
                    <Card key={c.id}>
                      <View style={styles.linhaTopo}>
                        <Text variant="body" tone="muted" style={styles.horario}>
                          {hora(c.comeca, timezone) ?? '—'}
                        </Text>
                        <View style={styles.corpo}>
                          <Text variant="body" style={styles.tituloAtividade}>
                            {c.titulo}
                          </Text>
                          <Text variant="body" tone="muted">
                            {c.variante} · {c.pessoas} {c.pessoas === 1 ? 'pessoa' : 'pessoas'}
                          </Text>
                          <Text variant="body" tone="faint">
                            {c.referencia}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  comprados: { gap: space.md, marginTop: space.section },
  seletor: { gap: space.sm, paddingVertical: space.md },
  chip: {
    minHeight: touchTarget.min,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  chipAtivo: { borderColor: palette.goldBorder },
  lista: { gap: space.md },
  atividade: {
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  alterada: { borderColor: palette.goldBorder },
  cancelada: { opacity: 0.55 },
  linhaTopo: { flexDirection: 'row', gap: space.lg },
  horario: { minWidth: 52 },
  corpo: { flex: 1, gap: space.xs },
  tituloAtividade: { fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
