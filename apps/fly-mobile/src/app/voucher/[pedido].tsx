import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Image } from 'react-native';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { EmptyState, FlyQR, LoadingSkeleton, Text } from '@/ui';
import { casca, cor, marca, tipo } from '@/trip/design';
import { TripTelaInterna } from '@/trip/TripTela';

/**
 * Voucher — o bilhete do `Fly Trip Mode.dc.html`.
 *
 * O recorte de bilhete é o que faz a tela: dois entalhes de 24px nas laterais
 * e a linha pontilhada entre o cabeçalho e o código. Em CSS são dois círculos
 * com a cor do fundo; aqui são duas `View` redondas posicionadas para fora do
 * cartão, que é a mesma técnica com outro nome.
 *
 * ## O código é o do pedido, e não um número bonito
 *
 * O desenho mostra `FLY-JS-13092026-4821`. Aqui o QR carrega a **referência do
 * pedido**, que é o que a operação confere no ponto de encontro e o que o
 * leitor do Fly Ops já sabe ler. Um código com formato próprio seria um
 * segundo identificador para a mesma coisa — e no dia do passeio alguém
 * apresentaria o que o app mostra e a operação procuraria o outro.
 */

interface Voucher {
  referencia: string;
  situacao: string;
  titulo: string;
  variante: string | null;
  pessoas: number;
  quando: string | null;
}

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={e.campo}>
      <Text style={e.rotulo}>{rotulo}</Text>
      <Text style={e.valor}>{valor}</Text>
    </View>
  );
}

export default function VoucherDoPedido() {
  const { pedido } = useLocalSearchParams<{ pedido: string }>();
  const { state: sessao } = useSession();
  const [dados, setDados] = useState<Voucher | null | 'vazio'>(null);

  const nome =
    sessao.kind === 'signedIn'
      ? (sessao.profile.preferredName ?? sessao.profile.displayName ?? '—')
      : '—';

  useEffect(() => {
    if (!pedido) return;
    void supabase()
      .from('orders')
      .select('reference, status, order_items(tour_title, variant_label, people, starts_at)')
      .eq('id', pedido)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setDados('vazio');
        const item = data.order_items?.[0];
        setDados({
          referencia: data.reference,
          situacao: data.status,
          titulo: item?.tour_title ?? 'Reserva Fly',
          variante: item?.variant_label ?? null,
          pessoas: data.order_items?.reduce((s, i) => s + (i.people ?? 0), 0) ?? 0,
          quando: item?.starts_at ?? null,
        });
      });
  }, [pedido]);

  if (dados === null) {
    return (
      <TripTelaInterna titulo="Voucher">
        <View style={e.margem}>
          <LoadingSkeleton />
        </View>
      </TripTelaInterna>
    );
  }

  if (dados === 'vazio') {
    return (
      <TripTelaInterna titulo="Voucher">
        <View style={e.margem}>
          <EmptyState
            title="Voucher não encontrado"
            description="Se você recebeu este link da Fly, avise a equipe — pode ser um pedido de outra conta."
          />
        </View>
      </TripTelaInterna>
    );
  }

  const confirmado = dados.situacao === 'paid' || dados.situacao === 'confirmed';

  return (
    <TripTelaInterna titulo="Voucher">
      <View style={e.margem}>
        <View style={e.bilhete}>
          <LinearGradient
            colors={['#17171C', '#0E0E11']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={e.cabecalho}>
            <View style={e.marca}>
              <Image source={marca.asaDourada} style={e.asa} resizeMode="contain" />
              <Text style={e.concierge}>FLY CONCIERGE</Text>
            </View>

            <Text style={[e.estado, !confirmado && { color: cor.aviso }]}>
              {confirmado ? 'CONFIRMADO' : dados.situacao.toUpperCase()}
            </Text>

            <Text style={e.titulo}>{dados.titulo}</Text>
            {dados.variante ? <Text style={e.variante}>{dados.variante}</Text> : null}

            <View style={e.grade}>
              <Campo
                rotulo="DATA"
                valor={
                  dados.quando
                    ? DATA.format(new Date(dados.quando)).replace('.', '').toUpperCase()
                    : 'A confirmar'
                }
              />
              <Campo
                rotulo="HORÁRIO"
                valor={dados.quando ? HORA.format(new Date(dados.quando)) : '—'}
              />
              <Campo rotulo="PASSAGEIRO" valor={nome} />
              <Campo rotulo="PESSOAS" valor={String(dados.pessoas || 1)} />
            </View>
          </View>

          {/* O recorte de bilhete. Os dois círculos ficam metade para fora, e
              é o que faz a silhueta — sem eles o cartão é só um cartão. */}
          <View style={e.recorte}>
            <View style={[e.entalhe, e.entalheEsquerdo]} />
            <View style={e.pontilhado}>
              {Array.from({ length: 22 }).map((_, i) => (
                <View key={i} style={e.ponto} />
              ))}
            </View>
            <View style={[e.entalhe, e.entalheDireito]} />
          </View>

          <View style={e.rodape}>
            <View style={e.qr}>
              <FlyQR value={dados.referencia} size={168} showValue={false} />
            </View>
            <Text style={e.codigo}>{dados.referencia}</Text>
            <Text style={e.instrucao}>Apresente este código no ponto de encontro</Text>
          </View>
        </View>
      </View>

      <View style={[e.margem, e.acoes]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartilhar voucher"
          onPress={() =>
            void Share.share({
              message: `Voucher Fly · ${dados.titulo}\nCódigo: ${dados.referencia}`,
            })
          }
          style={({ pressed }) => [e.botao, pressed && e.apertado]}
        >
          <Text style={[tipo('legenda'), { color: cor.texto }]}>Compartilhar</Text>
        </Pressable>
      </View>
    </TripTelaInterna>
  );
}

const e = StyleSheet.create({
  margem: { marginHorizontal: 18, marginTop: 20 },
  bilhete: { borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: cor.vidro075 },
  cabecalho: { paddingTop: 22, paddingHorizontal: 22, paddingBottom: 18 },
  marca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  asa: { height: 9, width: 28 },
  concierge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.35,
    color: 'rgba(223,201,138,.75)',
  },
  estado: { marginTop: 20, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.43, color: cor.ouro },
  titulo: {
    marginTop: 8,
    fontSize: 27,
    lineHeight: 28.6,
    fontWeight: '600',
    letterSpacing: -0.75,
    color: cor.texto,
  },
  variante: { marginTop: 4, fontSize: 13, color: cor.m45 },
  grade: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap' },
  campo: { width: '50%', marginBottom: 16, paddingRight: 12 },
  rotulo: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.14, color: cor.m35 },
  valor: {
    marginTop: 5,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: cor.texto,
  },
  recorte: { height: 24, justifyContent: 'center' },
  entalhe: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: cor.fundo,
  },
  entalheEsquerdo: { left: -12 },
  entalheDireito: { right: -12 },
  pontilhado: { flexDirection: 'row', marginHorizontal: 16, gap: 5, alignItems: 'center' },
  ponto: { flex: 1, height: 1, backgroundColor: cor.vidro16 },
  rodape: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 24 },
  qr: { padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  codigo: {
    marginTop: 16,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: cor.texto,
  },
  instrucao: { marginTop: 6, fontSize: 12, color: cor.m45, textAlign: 'center' },
  acoes: { marginBottom: casca.margemTela },
  botao: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cor.vidro16,
    backgroundColor: cor.vidro07,
  },
  apertado: { transform: [{ scale: 0.97 }] },
});
