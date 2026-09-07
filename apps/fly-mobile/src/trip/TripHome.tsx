import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { EmptyState, ErrorState, LoadingSkeleton, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { faltaTexto } from './alertas';
import { casca, cor, tipo } from './design';
import { usePasseios } from '@/passeios/usePasseios';
import { urlDaImagem } from '@/passeios/midia';
import {
  AvisoImportante,
  BannerDaViagem,
  CartaoProximo,
  GradeDeAtalhos,
  ListaDoDia,
  TituloDeSecao,
  TopoDaHome,
  FitaDeExperiencias,
  type LinhaDoDia,
} from './TripHomeBlocos';
import { useRoteiroProximo } from './useRoteiroProximo';

/**
 * Home do Trip Mode — Dubai, setembro de 2026.
 *
 * Montada sobre `Fly Trip Mode.dc.html`. A ordem dos blocos é a do arquivo, e
 * é a mesma ordem que a §5.4 já pedia: operacional antes de promoção.
 *
 *   topo · banner · próximo compromisso · aviso · seu dia · atalhos
 *
 * O conteúdo vem do banco. O design mostra "Jet Ski · Kite Beach" e "dia 4 de
 * 8" porque é um mock; aqui esses valores saem de `viagem_atual()` e do
 * roteiro. Onde o banco não tiver o dado, o bloco **não aparece** — é
 * preferível uma Home mais curta do que uma Home com texto de exemplo.
 */

function IconeRoteiro() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor.ouro}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={3.2} y={4.6} width={17.6} height={16.2} rx={3} />
      <Path d="M3.2 9.4h17.6M8.2 2.6v3.4M15.8 2.6v3.4" />
    </Svg>
  );
}

function IconePasseios() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor.ouro}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M2.8 17.2c1.7 0 2.5-1.3 4.2-1.3s2.5 1.3 4.2 1.3 2.5-1.3 4.2-1.3 2.5 1.3 4.2 1.3" />
      <Path d="M6.4 12.2V6.6a1.8 1.8 0 0 1 1.8-1.8h7.6a1.8 1.8 0 0 1 1.8 1.8v5.6" />
      <Path d="M12 4.8V2.4" />
    </Svg>
  );
}

function IconeDocumento() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor.ouro}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6.4 2.8h7l4.2 4.2v14.2H6.4z" />
      <Path d="M13.4 2.8V7h4.2" />
    </Svg>
  );
}

function IconeVoo() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor.ouro}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M10.2 20.4l1.8-5.4 7.4-2.2a1.8 1.8 0 0 0 .4-3.3l-2-1.2-3 .9-4.4-4.6-1.9.6 2.5 5.3-3.4 1-2.2-1.7-1.4.4 1.9 3.4-.6 2.2 2.1-1.5z" />
    </Svg>
  );
}

function IconeHotel() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor.ouro}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3.4 20.6V5.4a1.8 1.8 0 0 1 1.8-1.8h9.6a1.8 1.8 0 0 1 1.8 1.8v15.2" />
      <Path d="M16.6 10.2h2.2a1.8 1.8 0 0 1 1.8 1.8v8.6M2 20.6h20" />
      <Path d="M7 7.6h1.4M11.6 7.6H13M7 11.6h1.4M11.6 11.6H13M7 15.6h1.4M11.6 15.6H13" />
    </Svg>
  );
}

function IconeGaleria() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor.ouro}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={3.4} y={3.4} width={17.2} height={17.2} rx={3} />
      <Path d="M3.4 16l4.2-4a1.8 1.8 0 0 1 2.5 0l4.7 4.6" />
      <Circle cx={15} cy={8.6} r={1.4} />
    </Svg>
  );
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function hora(iso: string | null): string {
  return iso ? HORA.format(new Date(iso)) : '--:--';
}

/** "10 – 17 SETEMBRO 2026", como o design. */
function periodoLongo(inicio: string, fim: string): string {
  const a = new Date(inicio);
  const b = new Date(fim);
  const mes = b.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  return `${a.getDate()} – ${b.getDate()} ${mes} ${b.getFullYear()}`;
}

/** "RO" — as iniciais do avatar. Uma letra quando só há um nome. */
function iniciaisDe(nome: string | null): string {
  if (!nome) return 'FL';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? 'F';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function TripHome() {
  const { state: sessao } = useSession();
  const { data: viagem } = useViagem();
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const roteiro = useRoteiroProximo(tripId);
  // As mesmas experiências da tela própria — mesma consulta, mesmo cadastro.
  const { pagina: experiencias } = usePasseios({});

  const perfil = sessao.kind === 'signedIn' ? sessao.profile : null;
  const nome = perfil?.preferredName ?? perfil?.displayName ?? null;
  const primeiroNome = nome?.trim().split(/\s+/)[0] ?? null;

  if (viagem.kind === 'loading') {
    return (
      <View style={e.tela}>
        <LoadingSkeleton />
      </View>
    );
  }

  if (viagem.kind === 'error') {
    return (
      <View style={e.tela}>
        <ErrorState description={viagem.message} />
      </View>
    );
  }

  if (viagem.kind === 'semViagem') {
    return (
      <View style={e.tela}>
        <EmptyState
          title="Sua viagem ainda não começou"
          description="Quando a Fly montar sua viagem, tudo o que você precisa aparece aqui."
        />
      </View>
    );
  }

  const v = viagem.viagem;
  const emAndamento = v.diaAtual !== null;
  const progresso =
    v.diaAtual !== null && v.totalDias > 0 ? Math.min(1, v.diaAtual / v.totalDias) : undefined;

  const frase = emAndamento
    ? `Sua experiência Fly começou · dia ${v.diaAtual} de ${v.totalDias}`
    : 'Sua experiência Fly está chegando.';

  const proximo = roteiro.kind === 'ready' ? roteiro.proximo : null;
  const referencia = proximo?.saidaEm ?? proximo?.comecaEm ?? null;
  const faltam = referencia
    ? Math.round((new Date(referencia).getTime() - Date.now()) / 60000)
    : null;

  // O aviso da Home é o primeiro "IMPORTANTE" do roteiro. Um só: a Home
  // destaca, o roteiro lista.
  const aviso =
    roteiro.kind === 'ready' ? roteiro.alertas.find((a) => a.nivel === 'importante') : undefined;

  const agora = Date.now();
  const doDia: LinhaDoDia[] =
    roteiro.kind === 'ready'
      ? roteiro.doDia.map((a) => {
          const ref = a.comecaEm ?? a.saidaEm;
          const t = ref ? new Date(ref).getTime() : agora;
          const ehProximo = proximo?.id === a.id;
          return {
            id: a.id,
            hora: hora(ref),
            titulo: a.local ? `${a.titulo} · ${a.local}` : a.titulo,
            estado: ehProximo ? 'agora' : t < agora ? 'passou' : 'depois',
          };
        })
      : [];

  return (
    <ScrollView
      style={e.tela}
      contentContainerStyle={e.conteudo}
      showsVerticalScrollIndicator={false}
    >
      <TopoDaHome
        primeiroNome={primeiroNome}
        iniciais={iniciaisDe(nome)}
        onPerfil={() => router.push('/perfil')}
      />

      <BannerDaViagem
        destino={v.destino}
        bandeira="🇦🇪"
        periodo={periodoLongo(v.comecaEm, v.terminaEm)}
        frase={frase}
        progresso={progresso}
        emAndamento={emAndamento}
      />

      {proximo ? (
        <CartaoProximo
          titulo={proximo.local ? `${proximo.titulo} · ${proximo.local}` : proximo.titulo}
          quando={
            referencia
              ? `${emAndamento ? 'Hoje' : 'Em breve'} · ${hora(referencia)}${
                  faltam !== null && faltam >= 0 && faltam <= 720 ? ` · ${faltaTexto(faltam)}` : ''
                }`
              : 'Horário a confirmar'
          }
          onPress={() => router.push(`/viagem/atividade/${proximo.id}`)}
        />
      ) : null}

      {aviso ? <AvisoImportante texto={aviso.corpo} /> : null}

      {doDia.length > 0 ? (
        <>
          <TituloDeSecao
            titulo="Seu dia"
            acao="Ver roteiro"
            onAcao={() => router.push('/viagem/roteiro')}
          />
          <ListaDoDia itens={doDia} onItem={(id) => router.push(`/viagem/atividade/${id}`)} />
        </>
      ) : null}

      <View style={e.tituloAtalhos}>
        <Text style={[tipo('secao'), { color: cor.texto }]}>Atalhos</Text>
      </View>

      <FitaDeExperiencias
        itens={experiencias.itens.slice(0, 6).map((p) => ({
          id: p.id,
          titulo: p.titulo,
          categoria: p.categoria,
          apoio: p.duracaoMin
            ? `${p.duracaoMin >= 60 ? `${Math.round(p.duracaoMin / 60)}h` : `${p.duracaoMin} min`}${p.cidade ? ` · ${p.cidade}` : ''}`
            : (p.cidade ?? 'Sob consulta'),
          foto: p.imagem ? urlDaImagem(p.imagem) : null,
        }))}
        onVerTodas={() => router.push('/experiencias')}
        onAbrir={() => router.push('/experiencias')}
      />

      <GradeDeAtalhos
        atalhos={[
          {
            chave: 'roteiro',
            rotulo: 'Roteiro',
            desenho: <IconeRoteiro />,
            onPress: () => router.push('/viagem/roteiro'),
          },
          {
            chave: 'passeios',
            rotulo: 'Passeios',
            desenho: <IconePasseios />,
            onPress: () => router.push('/passeios/meus'),
          },
          {
            chave: 'documentos',
            rotulo: 'Documentos',
            desenho: <IconeDocumento />,
            onPress: () => router.push('/viagem/documentos'),
          },
          {
            chave: 'voo',
            rotulo: 'Voo',
            desenho: <IconeVoo />,
            onPress: () => router.push('/viagem/voos'),
          },
          {
            chave: 'hotel',
            rotulo: 'Hotel',
            desenho: <IconeHotel />,
            onPress: () => router.push('/viagem/hotel'),
          },
          {
            chave: 'galeria',
            rotulo: 'Galeria',
            desenho: <IconeGaleria />,
            onPress: () => router.push('/galeria'),
          },
        ]}
      />
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { paddingBottom: casca.respiroInferior },
  tituloAtalhos: { paddingHorizontal: casca.margemTexto, paddingTop: 26 },
});
