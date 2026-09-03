import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
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
import { useViagem } from '@/viagem/useViagem';
import { useMapa, type Lugar, type TipoDeLugar } from '@/mapa/useMapa';
import { distanciaKm, rotuloDeDistancia, urlDeRota, type Ponto } from '@/mapa/rota';

/**
 * Mapa (§12.1).
 *
 * **Não há mapa embutido, e é decisão.** A §12.1 põe "mapa embutido
 * avançado", "navegação contextual" e "3D" no futuro, e fecha com a regra de
 * não depender de Google Earth nem Citymapper para o núcleo funcionar. O
 * núcleo é o que está aqui: os pontos com endereço, a distância quando a
 * pessoa quiser, e a **rota abrindo no app de mapas do próprio celular**.
 * Provedor de mapa continua sendo a P16.
 *
 * A localização é pedida **no momento em que serve** e não sai do aparelho:
 * ela só ordena a lista. A localização que a Fly guarda é outra — a que a
 * pessoa envia dentro de um atendimento, e só quando toca no botão.
 */

const TITULO_TIPO: Record<TipoDeLugar, string> = {
  attraction: 'Para ver',
  partner: 'Parceiros da Fly',
  clinic: 'Saúde',
  hospital: 'Saúde',
  pharmacy: 'Saúde',
};

/** Saúde vem antes de passeio. Quem procura farmácia tem pressa. */
const ORDEM: TipoDeLugar[] = ['clinic', 'hospital', 'pharmacy', 'attraction', 'partner'];

const ROTULO_TIPO: Record<TipoDeLugar, string> = {
  attraction: 'atração',
  partner: 'parceiro',
  clinic: 'clínica',
  hospital: 'hospital',
  pharmacy: 'farmácia',
};

function abrirRota(destino: Ponto, rotulo: string) {
  void Linking.openURL(urlDeRota(Platform.OS, destino, rotulo));
}

function Acoes({
  telefone,
  destino,
  rotulo,
}: {
  telefone: string | null;
  destino: Ponto | null;
  rotulo: string;
}) {
  return (
    <View style={styles.acoes}>
      {telefone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ligar para ${rotulo}`}
          onPress={() => void Linking.openURL(`tel:${telefone}`)}
        >
          {({ pressed }) => (
            <View style={[styles.acao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.acaoTexto}>
                Ligar
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}
      {destino ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver rota até ${rotulo}`}
          onPress={() => abrirRota(destino, rotulo)}
        >
          {({ pressed }) => (
            <View style={[styles.acao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.acaoTexto}>
                Rota
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export default function MapaScreen() {
  const { data: viagem } = useViagem();
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const diaAtual = viagem.kind === 'ready' ? viagem.viagem.diaAtual : null;
  const { data, recarregar } = useMapa(tripId, diaAtual);

  const [eu, setEu] = useState<Ponto | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  /**
   * Uma vez, e só quando a pessoa toca. O ponto fica na memória da tela: não
   * é gravado, não é enviado, e some quando a tela fecha.
   */
  function ondeEstou() {
    if (Platform.OS !== 'web' || !('geolocation' in navigator)) {
      return setRecado('Este aparelho ainda não informa localização para o app.');
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEu({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setRecado(null);
      },
      () => setRecado('Não consegui a localização. A lista continua, só sem a distância.'),
      { timeout: 10_000 },
    );
  }

  function distancia(p: { latitude: number | null; longitude: number | null }): string | null {
    if (!eu || p.latitude === null || p.longitude === null) return null;
    return rotuloDeDistancia(distanciaKm(eu, { latitude: p.latitude, longitude: p.longitude }));
  }

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-mapa">
        <LoadingSkeleton label="Carregando o mapa" />
      </Screen>
    );
  }

  if (data.kind === 'offline') {
    return (
      <Screen withBottomNav={false} testID="screen-mapa">
        <AppHeader kicker="Minha Viagem" title="Mapa" onBack={() => router.back()} />
        <OfflineState onRetry={() => void recarregar()} />
        <Text variant="body" style={styles.nota}>
          O mapa precisa de internet para carregar. Os telefones da Fly ficam salvos em Ajuda e
          emergência, e funcionam mesmo assim.
        </Text>
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-mapa">
        <AppHeader kicker="Minha Viagem" title="Mapa" onBack={() => router.back()} />
        <ErrorState title="Não consegui carregar o mapa" description={data.message} />
      </Screen>
    );
  }

  const { bases, lugares, hoje } = data.mapa;
  const vazio = bases.length === 0 && lugares.length === 0 && hoje.length === 0;

  const porTipo = ORDEM.map((tipo) => ({
    tipo,
    itens: lugares.filter((l) => l.tipo === tipo),
  })).filter((g) => g.itens.length > 0);

  // Clínica, hospital e farmácia dividem o mesmo título. Agrupar aqui evita
  // três seções "Saúde" seguidas.
  const secoes: Array<{ titulo: string; itens: Lugar[] }> = [];
  for (const g of porTipo) {
    const titulo = TITULO_TIPO[g.tipo];
    const ultima = secoes[secoes.length - 1];
    if (ultima && ultima.titulo === titulo) ultima.itens.push(...g.itens);
    else secoes.push({ titulo, itens: [...g.itens] });
  }

  return (
    <Screen withBottomNav={false} testID="screen-mapa">
      <AppHeader
        kicker="Minha Viagem"
        title="Mapa"
        subtitle="Onde a Fly está, e o que está por perto."
        onBack={() => router.back()}
      />

      <Text variant="body" style={styles.nota}>
        A rota abre no app de mapas do seu celular. A Fly não acompanha onde você está — a distância
        abaixo só aparece se você pedir, e não sai daqui.
      </Text>

      {eu ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Calcular a distância a partir de onde estou"
          onPress={ondeEstou}
          testID="mapa-localizacao"
        >
          {({ pressed }) => (
            <View style={[styles.botao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.botaoTexto}>
                Ordenar pelo que está mais perto
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {recado ? (
        <View style={styles.recado}>
          <Text variant="body" style={styles.recadoTexto}>
            {recado}
          </Text>
        </View>
      ) : null}

      {vazio ? (
        <EmptyState
          title="O mapa ainda está vazio"
          description="A Fly ainda não publicou bases nem pontos para este destino. Assim que publicar, eles aparecem aqui."
        />
      ) : null}

      {hoje.length > 0 ? (
        <>
          <Text variant="section" style={styles.secao}>
            Hoje
          </Text>
          {hoje.map((a) => (
            <View key={a.id} style={styles.item}>
              <Text variant="body" style={styles.nome}>
                {a.titulo}
              </Text>
              {a.ponto ? (
                <Text variant="body" style={styles.meta}>
                  {a.ponto}
                </Text>
              ) : null}
              {a.mapa ? (
                <View style={styles.acoes}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ver o ponto de encontro de ${a.titulo}`}
                    onPress={() => void Linking.openURL(a.mapa as string)}
                  >
                    {({ pressed }) => (
                      <View style={[styles.acao, pressed && styles.pressionado]}>
                        <Text variant="body" style={styles.acaoTexto}>
                          Ponto de encontro
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {bases.length > 0 ? (
        <>
          <Text variant="section" style={styles.secao}>
            Bases Fly
          </Text>
          {ordenar(bases, eu).map((b) => (
            <View key={b.id} style={styles.item}>
              <View style={styles.topo}>
                <Text variant="body" style={styles.nome}>
                  {b.nome}
                </Text>
                <View style={[styles.selo, b.aberta ? styles.seloAberta : styles.seloFechada]}>
                  <Text variant="body" style={styles.seloTexto}>
                    {b.aberta ? 'aberta' : 'fechada'}
                  </Text>
                </View>
              </View>
              {b.endereco ? (
                <Text variant="body" style={styles.meta}>
                  {b.endereco}
                </Text>
              ) : null}
              {b.horario ? (
                <Text variant="body" style={styles.meta}>
                  {b.horario}
                </Text>
              ) : null}
              {b.servicos.length > 0 ? (
                <Text variant="body" style={styles.servicos}>
                  {b.servicos.join(' · ')}
                </Text>
              ) : null}
              {b.observacao ? (
                <Text variant="body" style={styles.meta}>
                  {b.observacao}
                </Text>
              ) : null}
              {distancia(b) ? (
                <Text variant="body" style={styles.meta}>
                  {distancia(b)} em linha reta
                </Text>
              ) : null}
              <Acoes
                telefone={b.telefone}
                destino={
                  b.latitude !== null && b.longitude !== null
                    ? { latitude: b.latitude, longitude: b.longitude }
                    : null
                }
                rotulo={b.nome}
              />
            </View>
          ))}
        </>
      ) : null}

      {secoes.map((s) => (
        <View key={s.titulo}>
          <Text variant="section" style={styles.secao}>
            {s.titulo}
          </Text>
          {ordenar(s.itens, eu).map((l) => (
            <View key={l.id} style={styles.item}>
              <Text variant="body" style={styles.nome}>
                {l.nome}
              </Text>
              <Text variant="body" style={styles.meta}>
                {ROTULO_TIPO[l.tipo]}
                {l.endereco ? ` · ${l.endereco}` : ''}
              </Text>
              {l.horario ? (
                <Text variant="body" style={styles.meta}>
                  {l.horario}
                </Text>
              ) : null}
              {l.observacao ? (
                <Text variant="body" style={styles.meta}>
                  {l.observacao}
                </Text>
              ) : null}
              {distancia(l) ? (
                <Text variant="body" style={styles.meta}>
                  {distancia(l)} em linha reta
                </Text>
              ) : null}
              <Acoes
                telefone={l.telefone}
                destino={{ latitude: l.latitude, longitude: l.longitude }}
                rotulo={l.nome}
              />
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

/** Perto primeiro, quando há de onde medir. Sem localização, a ordem do painel. */
function ordenar<T extends { latitude: number | null; longitude: number | null }>(
  itens: T[],
  eu: Ponto | null,
): T[] {
  if (!eu) return itens;
  return [...itens].sort((a, b) => {
    if (a.latitude === null || a.longitude === null) return 1;
    if (b.latitude === null || b.longitude === null) return -1;
    return (
      distanciaKm(eu, { latitude: a.latitude, longitude: a.longitude }) -
      distanciaKm(eu, { latitude: b.latitude, longitude: b.longitude })
    );
  });
}

const styles = StyleSheet.create({
  nota: { fontSize: 12, lineHeight: 18, color: palette.textFaint, marginTop: 14 },
  secao: { marginTop: 26, marginBottom: 12 },
  botao: {
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  botaoTexto: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: palette.text },
  recado: {
    marginTop: 14,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(233,162,59,.1)',
    borderColor: 'rgba(233,162,59,.3)',
  },
  recadoTexto: { fontSize: 13, lineHeight: 19, color: palette.text },
  item: {
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
    gap: 5,
    marginBottom: 10,
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nome: { fontSize: 15, fontWeight: '600', letterSpacing: -0.24, color: palette.text },
  meta: { fontSize: 12.5, lineHeight: 18, color: palette.textMuted },
  servicos: { fontSize: 12, lineHeight: 18, color: palette.textFaint },
  selo: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9, borderWidth: 1 },
  seloAberta: { borderColor: 'rgba(74,201,155,.35)', backgroundColor: 'rgba(74,201,155,.12)' },
  seloFechada: { borderColor: palette.stroke, backgroundColor: palette.fill },
  seloTexto: { fontSize: 10.5, letterSpacing: 0.2, color: palette.textMuted },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acao: {
    height: 36,
    paddingHorizontal: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
  },
  acaoTexto: { fontSize: 13, fontWeight: '600', color: palette.text },
  pressionado: { opacity: 0.7 },
});
