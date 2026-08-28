import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  Card,
  EmptyState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { Pressable } from 'react-native';
import { supabase } from '@/auth/client';
import { formatar, type Dinheiro, type Moeda } from '@/passeios/dinheiro';
import { reservar } from '@/passeios/useCarrinho';
import { dataCurta, hora } from '@/viagem/tempo';

/**
 * Detalhe do passeio (§6.4).
 *
 * A ordem dos blocos segue o que a pessoa precisa saber para decidir, e não a
 * ordem em que o banco devolve: o que é, quanto custa, quando tem vaga, e o
 * que a regra exige dela. Política de cancelamento vem **antes** do botão de
 * comprar — depois do botão, ninguém lê.
 */

interface Variante {
  id: string;
  rotulo: string;
  descricao: string | null;
  preco: Dinheiro;
  cobrePessoas: number;
  minPessoas: number;
  maxPessoas: number | null;
}

interface Slot {
  id: string;
  varianteId: string;
  comeca: string;
  timezone: string;
  vagas: number;
}

interface Detalhe {
  id: string;
  titulo: string;
  resumo: string | null;
  descricao: string | null;
  notaFly: string | null;
  incluso: string | null;
  naoIncluso: string | null;
  cidade: string | null;
  pontoEncontro: string | null;
  duracaoMin: number | null;
  roupa: string | null;
  idadeMin: number | null;
  saude: string | null;
  seguranca: string | null;
  acessibilidade: string | null;
  soProposta: boolean;
  politicaTitulo: string | null;
  politicaTexto: string | null;
  variantes: Variante[];
}

export default function DetalheDoPasseio() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const router = useRouter();

  const [passeio, setPasseio] = useState<Detalhe | null | 'nao-encontrado'>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [varianteEscolhida, setVarianteEscolhida] = useState<string | null>(null);
  const [slotEscolhido, setSlotEscolhido] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);

  const carregar = useCallback(async () => {
    if (!slug) return;
    const db = supabase();

    const { data } = await db
      .from('tours')
      .select(
        'id, title, summary, description, fly_note, included, not_included, city, meeting_point, duration_minutes, dress_code, min_age, health_notes, safety_notes, accessibility_notes, is_quote_only, cancellation_policies(label, description), tour_variants(id, label, description, price_cents, currency, covers_people, min_people, max_people, is_active, sort_order)',
      )
      .eq('slug', slug)
      .maybeSingle();

    if (!data) return setPasseio('nao-encontrado');

    const variantes: Variante[] = (data.tour_variants ?? [])
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        id: v.id,
        rotulo: v.label,
        descricao: v.description,
        preco: { centavos: v.price_cents, moeda: v.currency as Moeda },
        cobrePessoas: v.covers_people,
        minPessoas: v.min_people,
        maxPessoas: v.max_people,
      }));

    setPasseio({
      id: data.id,
      titulo: data.title,
      resumo: data.summary,
      descricao: data.description,
      notaFly: data.fly_note,
      incluso: data.included,
      naoIncluso: data.not_included,
      cidade: data.city,
      pontoEncontro: data.meeting_point,
      duracaoMin: data.duration_minutes,
      roupa: data.dress_code,
      idadeMin: data.min_age,
      saude: data.health_notes,
      seguranca: data.safety_notes,
      acessibilidade: data.accessibility_notes,
      soProposta: data.is_quote_only,
      politicaTitulo: data.cancellation_policies?.label ?? null,
      politicaTexto: data.cancellation_policies?.description ?? null,
      variantes,
    });

    const primeira = variantes[0];
    if (primeira) {
      setVarianteEscolhida((atual) => atual ?? primeira.id);
      setPessoas((atual) => Math.max(atual, primeira.minPessoas));
    }
  }, [slug]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Horários da variante escolhida, com as vagas contadas no servidor.
  useEffect(() => {
    if (!varianteEscolhida) return;
    void (async () => {
      const db = supabase();
      const { data } = await db
        .from('tour_slots')
        .select('id, variant_id, starts_at, timezone')
        .eq('variant_id', varianteEscolhida)
        .eq('is_active', true)
        .gt('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(12);

      // `vagas_livres` desconta venda e reservas ativas. Contar aqui seria
      // contar sem saber o que está no carrinho dos outros.
      const comVagas = await Promise.all(
        (data ?? []).map(async (s) => {
          const { data: v } = await db.rpc('vagas_livres', { p_slot: s.id });
          return {
            id: s.id,
            varianteId: s.variant_id,
            comeca: s.starts_at,
            timezone: s.timezone,
            vagas: typeof v === 'number' ? v : 0,
          };
        }),
      );

      setSlots(comVagas);
      setSlotEscolhido(null);
    })();
  }, [varianteEscolhida]);

  async function adicionar() {
    if (!slotEscolhido) return setAviso('Escolha um horário.');
    setReservando(true);
    setAviso(null);

    const r = await reservar(slotEscolhido, pessoas);
    setReservando(false);

    if (!r.ok) {
      setAviso(r.motivo);
      await carregar();
      return;
    }
    router.push('/carrinho');
  }

  if (passeio === 'nao-encontrado') {
    return (
      <Screen withBottomNav={false} testID="screen-passeio">
        <AppHeader kicker="Passeios" title="Não encontrei" onBack={() => router.back()} />
        <EmptyState
          title="Este passeio não está disponível"
          description="Ele pode ter saído do catálogo, ou o link estar desatualizado."
        />
      </Screen>
    );
  }

  if (!passeio) {
    return (
      <Screen withBottomNav={false} testID="screen-passeio">
        <LoadingSkeleton label="Carregando passeio" />
      </Screen>
    );
  }

  const variante = passeio.variantes.find((v) => v.id === varianteEscolhida) ?? null;
  const slot = slots.find((s) => s.id === slotEscolhido) ?? null;

  const total = variante
    ? {
        centavos:
          variante.cobrePessoas > 1 ? variante.preco.centavos : variante.preco.centavos * pessoas,
        moeda: variante.preco.moeda,
      }
    : null;

  const regras: [string, string | null][] = [
    ['Ponto de encontro', passeio.pontoEncontro],
    ['Roupa', passeio.roupa],
    ['Idade mínima', passeio.idadeMin ? `${passeio.idadeMin} anos` : null],
    ['Saúde', passeio.saude],
    ['Segurança', passeio.seguranca],
    ['Acessibilidade', passeio.acessibilidade],
  ];

  return (
    <Screen withBottomNav={false} testID="screen-passeio">
      <AppHeader
        kicker={passeio.cidade ?? 'Passeio'}
        title={passeio.titulo}
        onBack={() => router.back()}
      />

      {aviso ? <AlertBanner severity="warning" title={aviso} /> : null}

      {passeio.resumo ? (
        <Text variant="body" tone="muted">
          {passeio.resumo}
        </Text>
      ) : null}

      {/* "Por que a Fly recomenda" (§6.4). Curadoria, não marketing. */}
      {passeio.notaFly ? (
        <Card>
          <View style={styles.bloco}>
            <Kicker>Por que a Fly recomenda</Kicker>
            <Text variant="body" tone="muted">
              {passeio.notaFly}
            </Text>
          </View>
        </Card>
      ) : null}

      {passeio.descricao ? (
        <Text variant="body" tone="muted" style={styles.paragrafo}>
          {passeio.descricao}
        </Text>
      ) : null}

      {passeio.incluso || passeio.naoIncluso ? (
        <View style={styles.secao}>
          <Kicker>O que está incluso</Kicker>
          {passeio.incluso ? (
            <Card>
              <Text variant="body" tone="muted">
                {passeio.incluso}
              </Text>
            </Card>
          ) : null}
          {passeio.naoIncluso ? (
            <Card>
              <View style={styles.bloco}>
                <Text variant="body" tone="faint">
                  Não incluso
                </Text>
                <Text variant="body" tone="muted">
                  {passeio.naoIncluso}
                </Text>
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}

      {/* Fly Exclusives sem preço fechado (§6.6). */}
      {passeio.soProposta ? (
        <View style={styles.secao}>
          <Kicker>Sob proposta</Kicker>
          <Card>
            <View style={styles.bloco}>
              <Text variant="body" tone="muted">
                Esta experiência é montada sob medida. A Fly monta a proposta com você.
              </Text>
              <Botao
                rotulo="Solicitar proposta"
                onPress={() => router.push(`/passeios/proposta?tour=${passeio.id}` as never)}
                testID="solicitar-proposta"
              />
            </View>
          </Card>
        </View>
      ) : (
        <>
          {/* Opções (§6.4) */}
          {passeio.variantes.length > 0 ? (
            <View style={styles.secao}>
              <Kicker>Opções</Kicker>
              {passeio.variantes.map((v) => {
                const ativo = v.id === varianteEscolhida;
                return (
                  <Pressable
                    key={v.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativo }}
                    aria-checked={ativo}
                    onPress={() => {
                      setVarianteEscolhida(v.id);
                      setPessoas(v.minPessoas);
                    }}
                    style={[styles.opcao, ativo && styles.opcaoAtiva]}
                    testID={`variante-${v.id}`}
                  >
                    <View style={styles.opcaoCorpo}>
                      <Text variant="body" style={styles.opcaoTitulo}>
                        {v.rotulo}
                      </Text>
                      {v.descricao ? (
                        <Text variant="body" tone="faint" numberOfLines={2}>
                          {v.descricao}
                        </Text>
                      ) : null}
                      <Text variant="body" tone="muted">
                        {formatar(v.preco)}
                        {v.cobrePessoas > 1 ? ` · até ${v.cobrePessoas} pessoas` : ' por pessoa'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Quantas pessoas */}
          {variante ? (
            <View style={styles.secao}>
              <Kicker>Quantas pessoas</Kicker>
              <View style={styles.contador}>
                <Botao
                  rotulo="−"
                  variante="fantasma"
                  rotuloAcessivel="Menos uma pessoa"
                  desabilitado={pessoas <= variante.minPessoas}
                  onPress={() => setPessoas((n) => Math.max(variante.minPessoas, n - 1))}
                  testID="menos-pessoa"
                />
                <Text variant="section">{pessoas}</Text>
                <Botao
                  rotulo="+"
                  variante="fantasma"
                  rotuloAcessivel="Mais uma pessoa"
                  desabilitado={variante.maxPessoas !== null && pessoas >= variante.maxPessoas}
                  onPress={() =>
                    setPessoas((n) =>
                      variante.maxPessoas === null ? n + 1 : Math.min(variante.maxPessoas, n + 1),
                    )
                  }
                  testID="mais-pessoa"
                />
              </View>
            </View>
          ) : null}

          {/* Horários, com as vagas contadas no servidor */}
          <View style={styles.secao}>
            <Kicker>Quando</Kicker>
            {slots.length === 0 ? (
              <Card>
                <Text variant="body" tone="muted">
                  Sem horários abertos no momento.
                </Text>
              </Card>
            ) : (
              slots.map((s) => {
                const esgotado = s.vagas < pessoas;
                const ativo = s.id === slotEscolhido;
                return (
                  <Pressable
                    key={s.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativo, disabled: esgotado }}
                    aria-checked={ativo}
                    aria-disabled={esgotado}
                    disabled={esgotado}
                    onPress={() => setSlotEscolhido(s.id)}
                    style={[styles.opcao, ativo && styles.opcaoAtiva, esgotado && styles.esgotado]}
                    testID={`slot-${s.id}`}
                  >
                    <View style={styles.opcaoCorpo}>
                      <Text variant="body">
                        {dataCurta(s.comeca, s.timezone)} · {hora(s.comeca, s.timezone)}
                      </Text>
                      <Text variant="body" tone={esgotado ? 'faint' : 'muted'}>
                        {esgotado
                          ? 'Esgotado'
                          : s.vagas <= 3
                            ? `Últimas ${s.vagas} vagas`
                            : `${s.vagas} vagas`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Política ANTES do botão. Depois do botão ninguém lê. */}
          {passeio.politicaTexto ? (
            <View style={styles.secao}>
              <Kicker>{passeio.politicaTitulo ?? 'Cancelamento'}</Kicker>
              <Card>
                <Text variant="body" tone="muted">
                  {passeio.politicaTexto}
                </Text>
              </Card>
            </View>
          ) : null}

          {total ? (
            <Card>
              <View style={styles.bloco}>
                <View style={styles.totalLinha}>
                  <Text variant="body" tone="muted">
                    Total
                  </Text>
                  <Text variant="section">{formatar(total)}</Text>
                </View>
                <Botao
                  rotulo="Adicionar ao carrinho"
                  ocupado={reservando}
                  desabilitado={!slot}
                  onPress={() => void adicionar()}
                  testID="adicionar-carrinho"
                />
                <Text variant="body" tone="faint" style={styles.centro}>
                  A vaga fica reservada por alguns minutos enquanto você decide.
                </Text>
              </View>
            </Card>
          ) : null}
        </>
      )}

      {regras.some(([, v]) => v) ? (
        <View style={styles.secao}>
          <Kicker>Antes de ir</Kicker>
          <Card>
            <View style={styles.bloco}>
              {regras
                .filter(([, v]) => v)
                .map(([rotulo, valor]) => (
                  <View key={rotulo} style={styles.regra}>
                    <Text variant="body" tone="muted">
                      {rotulo}
                    </Text>
                    <Text variant="body" style={styles.regraValor}>
                      {valor}
                    </Text>
                  </View>
                ))}
            </View>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  secao: { gap: space.md, marginTop: space.section },
  paragrafo: { marginTop: space.lg },
  opcao: {
    minHeight: touchTarget.min,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surface,
  },
  opcaoAtiva: { borderColor: palette.goldBorder },
  opcaoCorpo: { gap: space.xs },
  opcaoTitulo: { fontWeight: '600' },
  esgotado: { opacity: 0.5 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  totalLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  regra: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.stroke,
    borderRadius: radius.chip,
  },
  regraValor: { flexShrink: 1, textAlign: 'right' },
  centro: { textAlign: 'center' },
});
