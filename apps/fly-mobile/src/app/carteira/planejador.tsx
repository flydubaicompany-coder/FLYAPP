import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { palette } from '@/theme';
import {
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  OfflineState,
  Screen,
  Text,
} from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { usePlanejador } from '@/carteira/usePlanejador';
import {
  estadoDoDia,
  previsaoCentavos,
  resumir,
  ROTULO_CATEGORIA,
  type CategoriaDeGasto,
  type Moeda,
  type PorMoeda,
} from '@/carteira/planejador';

/**
 * Planejador financeiro (§15.4).
 *
 * A tela é dois blocos, e é assim porque a §15.4 manda: **"não misturar gasto
 * manual com extrato financeiro oficial"**. Não existe um número somando os
 * dois nesta tela, e não é esquecimento — somar "o que a Fly cobrou" com "o
 * que eu anotei" produz um número que não é extrato nem controle de bolso.
 *
 * Também não há conversão de moeda: cada moeda tem a sua linha. Câmbio está na
 * lista da §33, e um total convertido por taxa chutada é pior do que dois
 * totais separados.
 */

const CATEGORIAS: CategoriaDeGasto[] = [
  'alimentacao',
  'transporte',
  'compras',
  'lazer',
  'saude',
  'outro',
];

function dinheiro(centavos: number, moeda: string): string {
  return `${(centavos / 100).toFixed(2).replace('.', ',')} ${moeda}`;
}

function Totais({ por }: { por: PorMoeda }) {
  const moedas = Object.keys(por) as Moeda[];
  if (moedas.length === 0) {
    return (
      <Text variant="body" style={styles.vazio}>
        nada ainda
      </Text>
    );
  }
  return (
    <>
      {moedas.map((m) => (
        <Text key={m} variant="section" style={styles.total}>
          {dinheiro(por[m] ?? 0, m)}
        </Text>
      ))}
    </>
  );
}

export default function PlanejadorScreen() {
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const diasRestantes =
    viagem.kind === 'ready' && viagem.viagem.diaAtual !== null
      ? Math.max(0, viagem.viagem.totalDias - viagem.viagem.diaAtual)
      : 0;

  const { data, anotar, apagar, definirOrcamento, recarregar } = usePlanejador(userId, tripId);

  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDeGasto>('alimentacao');
  const [nota, setNota] = useState('');
  const [limite, setLimite] = useState('');
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const pronto = data.kind === 'ready' ? data : null;

  const resumo = useMemo(
    () => (pronto ? resumir(pronto.oficiais, pronto.manuais) : null),
    [pronto],
  );

  function centavosDe(texto: string): number {
    return Math.round(Number(texto.trim().replace(',', '.')) * 100);
  }

  async function guardar() {
    if (!pronto) return;
    setOcupado(true);
    const moeda: Moeda = pronto.orcamento?.moeda ?? 'AED';
    const r = await anotar(centavosDe(valor), moeda, categoria, nota);
    setOcupado(false);
    if (!r.ok) return setRecado(r.motivo ?? 'Não consegui anotar.');
    setValor('');
    setNota('');
    setRecado(null);
  }

  if (state.kind === 'signedOut') {
    return (
      <Screen withBottomNav={false} testID="screen-planejador">
        <AppHeader kicker="Carteira" title="Planejador" onBack={() => router.back()} />
        <EmptyState title="Entre para usar" description="O planejador é do seu dinheiro." />
      </Screen>
    );
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-planejador">
        <LoadingSkeleton label="Carregando" />
      </Screen>
    );
  }

  if (data.kind === 'offline') {
    return (
      <Screen withBottomNav={false} testID="screen-planejador">
        <AppHeader kicker="Carteira" title="Planejador" onBack={() => router.back()} />
        <OfflineState onRetry={() => void recarregar()} />
      </Screen>
    );
  }

  if (data.kind === 'error' || resumo === null || pronto === null) {
    return (
      <Screen withBottomNav={false} testID="screen-planejador">
        <AppHeader kicker="Carteira" title="Planejador" onBack={() => router.back()} />
        <ErrorState
          title="Não consegui carregar"
          description={data.kind === 'error' ? data.message : 'Tente de novo.'}
        />
      </Screen>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const doDia = pronto.orcamento ? estadoDoDia(pronto.manuais, hoje, pronto.orcamento) : null;
  const previsao = pronto.orcamento
    ? previsaoCentavos(pronto.manuais, pronto.orcamento.moeda, diasRestantes)
    : null;

  return (
    <Screen withBottomNav={false} testID="screen-planejador">
      <AppHeader
        kicker="Carteira"
        title="Planejador"
        subtitle="O que a Fly cobrou, e o que você anotou — separados."
        onBack={() => router.back()}
      />

      {/* Dois blocos, e nenhum número somando os dois (§15.4). */}
      <View style={styles.colunas}>
        <View style={styles.coluna}>
          <Text variant="body" style={styles.colunaTitulo}>
            Cobrado pela Fly
          </Text>
          <Totais por={resumo.oficial} />
          <Text variant="body" style={styles.colunaNota}>
            Pedidos e carteira. É o extrato oficial.
          </Text>
        </View>
        <View style={styles.coluna}>
          <Text variant="body" style={styles.colunaTitulo}>
            Você anotou
          </Text>
          <Totais por={resumo.manual} />
          <Text variant="body" style={styles.colunaNota}>
            Seu controle de bolso. A Fly não vê.
          </Text>
        </View>
      </View>

      {doDia ? (
        <View style={[styles.dia, doDia.estourou && styles.diaEstourou]}>
          <Text variant="body" style={styles.diaTexto}>
            Hoje: {dinheiro(doDia.gastoNoDia, pronto.orcamento?.moeda ?? '')} de{' '}
            {dinheiro(doDia.limite, pronto.orcamento?.moeda ?? '')}
            {doDia.estourou
              ? ` · passou ${dinheiro(-doDia.sobra, pronto.orcamento?.moeda ?? '')}`
              : ` · sobram ${dinheiro(doDia.sobra, pronto.orcamento?.moeda ?? '')}`}
          </Text>
          {previsao !== null ? (
            <Text variant="body" style={styles.diaPrevisao}>
              No seu ritmo, mais {dinheiro(previsao, pronto.orcamento?.moeda ?? '')} até o fim da
              viagem.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.form}>
          <Text variant="body" style={styles.formTitulo}>
            Quanto você quer gastar por dia?
          </Text>
          <View style={styles.linha}>
            <TextInput
              accessibilityLabel="Limite diário"
              placeholder="300,00"
              placeholderTextColor={palette.textDisabled}
              value={limite}
              onChangeText={setLimite}
              keyboardType="decimal-pad"
              style={[styles.campo, styles.campoFlex]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Definir limite diário"
              disabled={ocupado || !tripId}
              onPress={() => void definirOrcamento(centavosDe(limite), 'AED')}
            >
              {({ pressed }) => (
                <View style={[styles.botao, pressed && styles.pressionado]}>
                  <Text variant="body" style={styles.botaoTexto}>
                    Definir
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          <Text variant="body" style={styles.colunaNota}>
            É o seu dinheiro e a sua escolha. A compra que você faz na Fly não conta contra este
            limite.
          </Text>
        </View>
      )}

      {/* Tax-free continua esperando a regra (P47, D159). */}
      {pronto.notas > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver as notas fiscais registradas"
          onPress={() => router.push('/carteira/notas')}
        >
          {({ pressed }) => (
            <View style={[styles.notas, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.notasTexto}>
                {pronto.notas === 1
                  ? '1 nota fiscal registrada'
                  : `${pronto.notas} notas fiscais registradas`}
                . O valor de tax-free a receber depende da regra, que a Fly ainda vai publicar.
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}

      <Text variant="section" style={styles.secao}>
        Anotar um gasto
      </Text>

      <View style={styles.linha}>
        <TextInput
          accessibilityLabel="Quanto"
          placeholder="45,00"
          placeholderTextColor={palette.textDisabled}
          value={valor}
          onChangeText={setValor}
          keyboardType="decimal-pad"
          style={[styles.campo, styles.campoFlex]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Anotar gasto"
          disabled={ocupado}
          onPress={() => void guardar()}
          testID="planejador-anotar"
        >
          {({ pressed }) => (
            <View style={[styles.botao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.botaoTexto}>
                Anotar
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.chips}>
        {CATEGORIAS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={ROTULO_CATEGORIA[c]}
            onPress={() => setCategoria(c)}
          >
            {() => (
              <View style={[styles.chip, categoria === c && styles.chipAtivo]}>
                <Text variant="body" style={styles.chipTexto}>
                  {ROTULO_CATEGORIA[c]}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <TextInput
        accessibilityLabel="O que foi"
        placeholder="Café na Marina"
        placeholderTextColor={palette.textDisabled}
        value={nota}
        onChangeText={setNota}
        style={styles.campo}
        maxLength={200}
      />

      {recado ? (
        <Text variant="body" style={styles.recado}>
          {recado}
        </Text>
      ) : null}

      {pronto.manuais.length > 0 ? (
        <>
          <Text variant="section" style={styles.secao}>
            Seus gastos
          </Text>
          {pronto.manuais.map((m) => (
            <View key={m.id} style={styles.gasto}>
              <View style={styles.gastoTexto}>
                <Text variant="body" style={styles.gastoValor}>
                  {dinheiro(m.centavos, m.moeda)}
                </Text>
                <Text variant="body" style={styles.gastoMeta}>
                  {ROTULO_CATEGORIA[m.categoria]}
                  {m.nota ? ` · ${m.nota}` : ''} · {m.dia}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Apagar gasto de ${dinheiro(m.centavos, m.moeda)}`}
                onPress={() => void apagar(m.id)}
              >
                {() => (
                  <View style={styles.apagar}>
                    <Text variant="body" style={styles.apagarTexto}>
                      Apagar
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          ))}

          {/* "Exportação" (§15.4). Texto pelo Share do sistema: gerar arquivo
              exigiria dependência nativa que este projeto ainda não compila. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartilhar o resumo dos seus gastos"
            onPress={() =>
              void Share.share({
                message: pronto.manuais
                  .map(
                    (m) =>
                      `${m.dia}\t${dinheiro(m.centavos, m.moeda)}\t${ROTULO_CATEGORIA[m.categoria]}\t${m.nota ?? ''}`,
                  )
                  .join('\n'),
              })
            }
          >
            {({ pressed }) => (
              <View style={[styles.exportar, pressed && styles.pressionado]}>
                <Text variant="body" style={styles.botaoTexto}>
                  Exportar seus gastos
                </Text>
              </View>
            )}
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  colunas: { marginTop: 18, flexDirection: 'row', gap: 10 },
  coluna: {
    flex: 1,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
    gap: 4,
  },
  colunaTitulo: { fontSize: 12, letterSpacing: 0.4, color: palette.textFaint },
  colunaNota: { fontSize: 11.5, lineHeight: 17, color: palette.textFaint },
  total: { fontSize: 20, letterSpacing: -0.4 },
  vazio: { fontSize: 15, color: palette.textDisabled },

  dia: {
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.fill,
    gap: 4,
  },
  diaEstourou: { borderColor: 'rgba(233,162,59,.35)', backgroundColor: 'rgba(233,162,59,.1)' },
  diaTexto: { fontSize: 13.5, lineHeight: 20, color: palette.text },
  diaPrevisao: { fontSize: 12, lineHeight: 18, color: palette.textMuted },

  form: { marginTop: 14, gap: 8 },
  formTitulo: { fontSize: 13.5, color: palette.text },

  notas: {
    marginTop: 14,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.fill,
  },
  notasTexto: { fontSize: 12.5, lineHeight: 18, color: palette.textMuted },

  secao: { marginTop: 26, marginBottom: 12 },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  campo: {
    height: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
    color: palette.text,
    fontSize: 14,
  },
  campoFlex: { flex: 1 },
  botao: {
    height: 46,
    marginTop: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fillStrong,
  },
  botaoTexto: { fontSize: 14, fontWeight: '600', color: palette.text },

  chips: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  chipAtivo: { borderColor: palette.strokeStrong, backgroundColor: palette.fillStrong },
  chipTexto: { fontSize: 12.5, color: palette.text },

  recado: { marginTop: 10, fontSize: 12.5, color: palette.warning },

  gasto: {
    marginBottom: 8,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gastoTexto: { flex: 1, gap: 2 },
  gastoValor: { fontSize: 14.5, fontWeight: '600', color: palette.text },
  gastoMeta: { fontSize: 12, color: palette.textMuted },
  apagar: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  apagarTexto: { fontSize: 12, color: palette.textMuted },

  exportar: {
    marginTop: 10,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  pressionado: { opacity: 0.75 },
});
