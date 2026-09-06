import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { supabase } from '@/auth/client';
import { EmptyState, ErrorState, LoadingSkeleton, Text } from '@/ui';
import { useViagem } from '@/viagem/useViagem';
import { casca, cor, raio, tipo } from './design';
import { TripTela } from './TripTela';
import {
  useRoteiroCompleto,
  type AtividadeDoRoteiro,
  type DiaDoRoteiro,
} from './useRoteiroCompleto';

/**
 * Meu roteiro — a timeline por dia do `Fly Trip Mode.dc.html`.
 *
 * Duas coisas que o desenho resolve bem e que eu mantive:
 *
 * - **O seletor de dias é uma fita horizontal**, com o dia de hoje marcado. É
 *   o que deixa a tela útil no meio da viagem sem rolagem: quem está no dia 4
 *   quer o dia 4, e quer poder espiar o 5.
 * - **A trilha vertical liga as atividades.** O ponto de cada uma é vazado; o
 *   da atividade em curso é dourado e tem brilho. É o único uso de dourado
 *   nesta tela, e é o correto: marcar onde a pessoa está.
 *
 * A foto de 104px só aparece quando a atividade tem uma. O design mostra
 * quatro; aqui a maioria não terá, e a linha fica sem — melhor do que uma
 * imagem genérica de banco.
 */

const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function hora(iso: string | null): string {
  return iso ? HORA.format(new Date(iso)) : '—';
}

/** `day_date` é `YYYY-MM-DD`; `new Date` dela sozinha desloca o fuso. */
function dataLocal(dia: string): Date {
  const [ano, mes, d] = dia.split('-').map(Number);
  return new Date(ano ?? 2026, (mes ?? 1) - 1, d ?? 1);
}

function ehHoje(dia: string): boolean {
  const hoje = new Date();
  const d = dataLocal(dia);
  return (
    d.getFullYear() === hoje.getFullYear() &&
    d.getMonth() === hoje.getMonth() &&
    d.getDate() === hoje.getDate()
  );
}

function ChipDeDia({
  dia,
  ativo,
  hoje,
  onPress,
}: {
  dia: DiaDoRoteiro;
  ativo: boolean;
  hoje: boolean;
  onPress: () => void;
}) {
  const d = dataLocal(dia.data);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={`Dia ${dia.numero}, ${d.getDate()}`}
      onPress={onPress}
      style={[e.chip, ativo && e.chipAtivo, !ativo && hoje && e.chipHoje]}
      testID={`trip-dia-${dia.numero}`}
    >
      <Text style={[tipo('diaDaSemana'), { color: ativo ? cor.fundo : hoje ? cor.ouro : cor.m40 }]}>
        {SEMANA[d.getDay()]}
      </Text>
      <Text style={[tipo('numeroDia'), { color: ativo ? cor.fundo : hoje ? cor.ouro : cor.texto }]}>
        {d.getDate()}
      </Text>
    </Pressable>
  );
}

function LinhaDoRoteiro({
  atividade,
  emCurso,
  ultima,
  urlDaFoto,
}: {
  atividade: AtividadeDoRoteiro;
  emCurso: boolean;
  ultima: boolean;
  urlDaFoto: string | null;
}) {
  const passou =
    !emCurso && atividade.comecaEm !== null && new Date(atividade.comecaEm) < new Date();
  const cancelada = atividade.status === 'cancelled';

  return (
    <View style={e.linha}>
      <View style={e.colunaHora}>
        <Text
          style={[
            tipo('legenda'),
            { color: emCurso ? cor.ouro : passou ? cor.m35 : cor.m55, textAlign: 'right' },
          ]}
        >
          {hora(atividade.saidaEm ?? atividade.comecaEm)}
        </Text>
      </View>

      <View style={e.colunaTrilha}>
        <View
          style={[
            e.ponto,
            {
              borderColor: emCurso ? cor.ouro : cor.vidro16,
              backgroundColor: emCurso ? cor.ouro : 'transparent',
            },
          ]}
        />
        {/* A trilha não desce depois da última: uma linha que termina no vazio
            faz parecer que falta carregar mais alguma coisa. */}
        {ultima ? null : <View style={e.trilha} />}
      </View>

      <View style={e.colunaTexto}>
        <Text
          style={[
            tipo('corpoForte'),
            { color: cancelada ? cor.m40 : cor.texto },
            cancelada && e.riscado,
          ]}
        >
          {atividade.titulo}
        </Text>
        {atividade.local || atividade.subtitulo ? (
          <Text style={[tipo('miudo'), e.sub]} numberOfLines={2}>
            {[atividade.local, atividade.subtitulo].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {urlDaFoto ? (
          <Image source={{ uri: urlDaFoto }} style={e.foto} contentFit="cover" transition={200} />
        ) : null}

        {atividade.nota ? (
          <View style={e.nota}>
            <Svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.ouro}
              strokeWidth={1.9}
              strokeLinecap="round"
            >
              <Circle cx={12} cy={12} r={9.2} />
              <Path d="M12 10.6v6M12 7.6h.01" />
            </Svg>
            <Text style={[tipo('miudo'), e.notaTexto]}>{atividade.nota}</Text>
          </View>
        ) : null}

        <View style={e.acoes}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver detalhes de ${atividade.titulo}`}
            onPress={() => router.push(`/viagem/atividade/${atividade.id}`)}
            style={({ pressed }) => [e.botaoOuro, pressed && e.apertado]}
          >
            <Text style={[tipo('miudo'), { color: cor.ouro, fontWeight: '600' }]}>Detalhes</Text>
          </Pressable>

          {atividade.mapa ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir no mapa"
              onPress={() => void Linking.openURL(atividade.mapa as string)}
              style={({ pressed }) => [e.botaoVidro, pressed && e.apertado]}
            >
              <Svg
                width={13}
                height={13}
                viewBox="0 0 24 24"
                fill="none"
                stroke={cor.m62}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M20 10.5c0 5.6-8 11.4-8 11.4s-8-5.8-8-11.4a8 8 0 0 1 16 0z" />
                <Circle cx={12} cy={10.4} r={2.6} />
              </Svg>
              <Text style={[tipo('miudo'), { color: cor.m62 }]}>Mapa</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function TripRoteiro() {
  const { data: viagem } = useViagem();
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const roteiro = useRoteiroCompleto(tripId);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});

  const dias = roteiro.kind === 'ready' ? roteiro.dias : [];

  // Abre no dia de hoje. Quem está no dia 4 quer o dia 4 — abrir no dia 1
  // obriga a rolar a fita toda vez.
  useEffect(() => {
    if (diaAberto || dias.length === 0) return;
    setDiaAberto((dias.find((d) => ehHoje(d.data)) ?? dias[0])?.id ?? null);
  }, [dias, diaAberto]);

  const dia = useMemo(() => dias.find((d) => d.id === diaAberto) ?? null, [dias, diaAberto]);

  // As fotos do roteiro moram no bucket privado `passeios`; o caminho sozinho
  // não abre. Uma URL assinada por dia é o suficiente e evita assinar a viagem
  // inteira de uma vez.
  useEffect(() => {
    const caminhos = (dia?.atividades ?? [])
      .map((a) => a.imagem)
      .filter((c): c is string => c !== null);
    if (caminhos.length === 0) return;

    void (async () => {
      const { data } = await supabase().storage.from('passeios').createSignedUrls(caminhos, 1800);
      const mapa: Record<string, string> = {};
      for (const linha of data ?? []) {
        if (linha.path && linha.signedUrl) mapa[linha.path] = linha.signedUrl;
      }
      setFotos((atual) => ({ ...atual, ...mapa }));
    })();
  }, [dia]);

  if (viagem.kind === 'loading' || roteiro.kind === 'loading') {
    return (
      <TripTela kicker="DUBAI · SET 2026" titulo="Meu roteiro">
        <View style={e.margem}>
          <LoadingSkeleton />
        </View>
      </TripTela>
    );
  }

  if (roteiro.kind === 'error') {
    return (
      <TripTela kicker="ROTEIRO" titulo="Meu roteiro">
        <View style={e.margem}>
          <ErrorState description={roteiro.message} />
        </View>
      </TripTela>
    );
  }

  if (viagem.kind !== 'ready' || dias.length === 0) {
    return (
      <TripTela kicker="ROTEIRO" titulo="Meu roteiro">
        <View style={e.margem}>
          <EmptyState
            title="O roteiro ainda não foi publicado"
            description="Assim que a Fly fechar os horários, cada dia aparece aqui."
          />
        </View>
      </TripTela>
    );
  }

  const v = viagem.viagem;
  const agora = Date.now();
  const emCurso = (a: AtividadeDoRoteiro): boolean => {
    const ref = a.saidaEm ?? a.comecaEm;
    if (!ref) return false;
    const t = new Date(ref).getTime();
    return t <= agora + 2 * 3600_000 && t >= agora - 3600_000;
  };

  return (
    <TripTela
      kicker={`${v.destino.toUpperCase()} · ${dataLocal(v.comecaEm.slice(0, 10)).getFullYear()}`}
      titulo="Meu roteiro"
      apoio={
        dia
          ? `Dia ${dia.numero} de ${dias.length}${dia.titulo ? ` · ${dia.titulo}` : ''}`
          : undefined
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fita}>
        {dias.map((d) => (
          <ChipDeDia
            key={d.id}
            dia={d}
            ativo={d.id === diaAberto}
            hoje={ehHoje(d.data)}
            onPress={() => setDiaAberto(d.id)}
          />
        ))}
      </ScrollView>

      <View style={e.lista}>
        {(dia?.atividades ?? []).length === 0 ? (
          <Text style={[tipo('apoio'), { color: cor.m45, paddingHorizontal: 4 }]}>
            Dia livre. Nada marcado — e isso também é roteiro.
          </Text>
        ) : (
          (dia?.atividades ?? []).map((a, i, todas) => (
            <LinhaDoRoteiro
              key={a.id}
              atividade={a}
              emCurso={emCurso(a)}
              ultima={i === todas.length - 1}
              urlDaFoto={a.imagem ? (fotos[a.imagem] ?? null) : null}
            />
          ))
        )}
      </View>
    </TripTela>
  );
}

const e = StyleSheet.create({
  margem: { paddingHorizontal: casca.margemTela, paddingTop: 20 },
  fita: { gap: 8, paddingHorizontal: casca.margemTela, paddingTop: 16, paddingBottom: 2 },
  chip: {
    width: 52,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 9,
    borderRadius: raio.chipDia,
    borderWidth: 1,
    borderColor: cor.vidro075,
    backgroundColor: cor.vidro035,
  },
  chipAtivo: { backgroundColor: cor.ouro, borderColor: cor.ouro },
  chipHoje: { borderColor: cor.ouroBorda30, backgroundColor: cor.ouroTinta12 },

  lista: { paddingHorizontal: casca.margemTela, paddingTop: 18 },
  linha: { flexDirection: 'row', gap: 12 },
  colunaHora: { width: 46, paddingTop: 2 },
  colunaTrilha: { width: 11, alignItems: 'center' },
  ponto: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  trilha: { flex: 1, width: 1, backgroundColor: cor.vidro10, marginVertical: 4 },
  colunaTexto: { flex: 1, paddingBottom: 22 },
  sub: { marginTop: 3, color: cor.m45 },
  riscado: { textDecorationLine: 'line-through' },
  foto: {
    marginTop: 11,
    height: 104,
    borderRadius: raio.foto,
    backgroundColor: cor.vidro05,
  },
  nota: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: raio.nota,
    backgroundColor: 'rgba(223,201,138,.07)',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.18)',
  },
  notaTexto: { flex: 1, color: cor.m62 },
  acoes: { marginTop: 11, flexDirection: 'row', gap: 9 },
  botaoOuro: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    backgroundColor: cor.ouroTinta12,
  },
  botaoVidro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cor.vidro10,
    backgroundColor: cor.vidro05,
  },
  apertado: { transform: [{ scale: 0.95 }] },
});
