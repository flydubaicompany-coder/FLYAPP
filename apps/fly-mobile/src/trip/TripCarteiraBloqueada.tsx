import { useEffect, useState } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { Text } from '@/ui';
import { cor, raio, tipo } from './design';
import { TripTela } from './TripTela';

/**
 * Carteira, bloqueada — a tela que o cadeado da barra abre.
 *
 * O desenho mantém a Carteira visível e trancada em vez de removê-la, e está
 * certo: aba que some faz a pessoa achar que perdeu o benefício.
 *
 * ## Duas coisas do arquivo que eu não reproduzi
 *
 * O desenho desenha um cartão com **"•••• •••• •••• 4821"** e **"FASE 2 · OUT
 * 2026"**. As duas são conteúdo, e nenhuma é minha para inventar:
 *
 * - o número, mesmo borrado, é um artefato financeiro fabricado. Aqui os
 *   quatro grupos ficam mascarados até o fim — o cartão continua se lendo como
 *   cartão, e ninguém pode fotografar a tela e dizer que a Fly emitiu um;
 * - a data é promessa de cronograma. Ela só aparece se alguém a escrever em
 *   `app_config['wallet.release_note']`. Sem isso, a tela diz "em breve" e
 *   para aí — que é a verdade.
 */
export default function TripCarteiraBloqueada() {
  const { state: sessao } = useSession();
  const [aviso, setAviso] = useState<string | null>(null);

  const perfil = sessao.kind === 'signedIn' ? sessao.profile : null;
  const nome = (perfil?.preferredName ?? perfil?.displayName ?? '').toUpperCase();

  useEffect(() => {
    void supabase()
      .from('app_config')
      .select('value')
      .eq('key', 'wallet.release_note')
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value;
        setAviso(typeof v === 'string' && v !== 'PENDENTE' ? v : null);
      });
  }, []);

  return (
    <TripTela kicker="FLY WALLET" titulo="Carteira">
      <View style={e.moldura}>
        {/* O cartão é decoração borrada. `pointerEvents none` porque nada aqui
            é tocável — e um alvo de toque invisível sob o cadeado seria o tipo
            de detalhe que ninguém encontra depois. */}
        <View style={e.borrado} pointerEvents="none">
          <LinearGradient
            colors={['#2A2418', '#151310', '#0C0B09']}
            locations={[0, 0.52, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={e.cartao}
          >
            <Text style={[tipo('kicker'), { color: 'rgba(223,201,138,.8)' }]}>FLY BLACK</Text>
            <Text style={[e.numero]}>•••• •••• •••• ••••</Text>
            <View style={e.rodapeCartao}>
              <Text style={[tipo('miudo'), e.nomeNoCartao]}>{nome || 'MEMBRO FLY'}</Text>
              <Text style={[tipo('miudo'), { color: cor.m50, letterSpacing: 0.8 }]}>••/••</Text>
            </View>
          </LinearGradient>
        </View>

        <BlurView intensity={18} tint="dark" style={e.velo} />

        <View style={e.centro} pointerEvents="none">
          <View style={e.cadeado}>
            <Svg
              width={21}
              height={21}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.texto}
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Rect x={4.4} y={10.4} width={15.2} height={10.4} rx={2.4} />
              <Path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" />
            </Svg>
          </View>
        </View>
      </View>

      <View style={e.texto}>
        <Text style={[tipo('secao'), { color: cor.texto, textAlign: 'center' }]}>
          Disponível em breve
        </Text>
        <Text style={[tipo('apoio'), e.explicacao]}>
          A carteira Fly — pontos, cartão e pagamentos no app — ainda não está aberta. Nesta viagem,
          tudo o que você já comprou está em Minha Viagem.
        </Text>

        {aviso ? (
          <View style={e.selo}>
            <View style={e.pontoOuro} />
            <Text style={[tipo('kicker'), { color: cor.ouro }]}>{aviso.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
    </TripTela>
  );
}

const e = StyleSheet.create({
  moldura: {
    marginTop: 22,
    marginHorizontal: 18,
    borderRadius: raio.cartao,
    overflow: 'hidden',
  },
  borrado: { opacity: 0.42 },
  cartao: { padding: 20, borderRadius: raio.cartao },
  numero: {
    marginTop: 34,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 3.4,
    color: cor.ouroClaro,
  },
  rodapeCartao: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nomeNoCartao: { color: 'rgba(245,245,247,.75)', fontWeight: '600', letterSpacing: 0.5 },
  velo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  centro: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadeado: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,.09)',
    borderWidth: 1,
    borderColor: cor.vidro16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { paddingTop: 24, paddingHorizontal: 26 },
  explicacao: { marginTop: 8, color: cor.m45, textAlign: 'center' },
  selo: {
    marginTop: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: raio.chip,
    backgroundColor: cor.ouroTinta12,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
  },
  pontoOuro: { width: 5, height: 5, borderRadius: 3, backgroundColor: cor.ouro },
});
