import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  Card,
  EmptyState,
  FlyQR,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { faltam, hora, ROTULO_STATUS } from '@/viagem/tempo';

/**
 * Detalhe de atividade (§7.3 e §7.9).
 *
 * Aqui moram os três botões da §7.3 — "Estou pronto", "Estou atrasado" e "Não
 * encontrei o grupo" — e o QR de check-in.
 *
 * O QR é emitido pelo servidor, sob demanda, e vale por tempo limitado. Não é
 * guardado no aparelho: um código permanente na tela é um código que circula
 * em print.
 *
 * A confirmação de leitura de alteração fica no topo, antes de qualquer outra
 * informação, e some assim que confirmada.
 */

interface Atividade {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  comeca: string | null;
  termina: string | null;
  saida: string | null;
  ponto: string | null;
  mapa: string | null;
  responsavel: string | null;
  oQueLevar: string | null;
  roupa: string | null;
  instrucoes: string | null;
  exigeConfirmacao: boolean;
  alteradoEm: string | null;
  notaDaMudanca: string | null;
}

type EstadoPronto = 'ready' | 'late' | 'lost' | 'needs_help';

const ROTULO_PRONTO: Record<EstadoPronto, string> = {
  ready: 'Estou pronto',
  late: 'Estou atrasado',
  lost: 'Não encontrei o grupo',
  needs_help: 'Preciso de ajuda',
};

export default function AtividadeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state: sessao } = useSession();
  const { data: viagemData } = useViagem();

  const [atividade, setAtividade] = useState<Atividade | null | 'nao-encontrada'>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [readyCheckId, setReadyCheckId] = useState<string | null>(null);
  const [meuEstado, setMeuEstado] = useState<EstadoPronto | null>(null);
  const [qr, setQr] = useState<{ token: string; expira: string | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const timezone = viagemData.kind === 'ready' ? viagemData.viagem.timezone : 'UTC';
  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;

  const carregar = useCallback(async () => {
    if (!id) return;
    const db = supabase();

    const { data } = await db
      .from('activities')
      .select(
        'id, title, description, status, starts_at, ends_at, departure_at, meeting_point, meeting_map_url, responsible_name, what_to_bring, dress_code, instructions, requires_ack, changed_at, change_note',
      )
      .eq('id', id)
      .maybeSingle();

    if (!data) return setAtividade('nao-encontrada');

    setAtividade({
      id: data.id,
      titulo: data.title,
      descricao: data.description,
      status: data.status,
      comeca: data.starts_at,
      termina: data.ends_at,
      saida: data.departure_at,
      ponto: data.meeting_point,
      mapa: data.meeting_map_url,
      responsavel: data.responsible_name,
      oQueLevar: data.what_to_bring,
      roupa: data.dress_code,
      instrucoes: data.instructions,
      exigeConfirmacao: data.requires_ack,
      alteradoEm: data.changed_at,
      notaDaMudanca: data.change_note,
    });

    if (data.changed_at && userId) {
      const { data: ack } = await db
        .from('activity_acks')
        .select('id')
        .eq('activity_id', data.id)
        .eq('user_id', userId)
        .eq('changed_at', data.changed_at)
        .maybeSingle();
      setConfirmado(Boolean(ack));
    }

    // O Ready Check aberto mais recente. Se não houver, os botões não
    // aparecem — não faz sentido dizer "estou pronto" sem alguém esperando.
    const { data: rc } = await db
      .from('ready_checks')
      .select('id, closed_at')
      .eq('activity_id', data.id)
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rc && userId) {
      setReadyCheckId(rc.id);
      const { data: resposta } = await db
        .from('ready_check_responses')
        .select('state')
        .eq('ready_check_id', rc.id)
        .eq('user_id', userId)
        .maybeSingle();
      setMeuEstado((resposta?.state as EstadoPronto) ?? null);
    }
  }, [id, userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function confirmarLeitura() {
    if (!atividade || atividade === 'nao-encontrada' || !atividade.alteradoEm || !userId) return;
    const { error } = await supabase().from('activity_acks').insert({
      activity_id: atividade.id,
      user_id: userId,
      changed_at: atividade.alteradoEm,
    });
    if (error) setAviso('Não consegui registrar. Tente de novo.');
    else setConfirmado(true);
  }

  async function responder(estado: EstadoPronto) {
    if (!readyCheckId || !userId) return;
    setMeuEstado(estado);
    const { error } = await supabase()
      .from('ready_check_responses')
      .upsert(
        { ready_check_id: readyCheckId, user_id: userId, state: estado },
        { onConflict: 'ready_check_id,user_id' },
      );
    if (error) {
      setAviso('Não consegui avisar a equipe. Tente de novo.');
      await carregar();
    }
  }

  async function gerarQr() {
    if (!atividade || atividade === 'nao-encontrada') return;
    setAviso(null);

    // 15 minutos e um uso. Curto de propósito: o código existe para o momento
    // do embarque, não para o dia inteiro.
    const { data, error } = await supabase().rpc('emitir_qr', {
      p_kind: 'activity_checkin',
      p_activity: atividade.id,
      p_valid_minutes: 15,
      p_max_uses: 1,
    });

    if (error) return setAviso('Não consegui gerar seu código agora.');
    const linha = Array.isArray(data) ? data[0] : data;
    if (linha) setQr({ token: linha.token, expira: linha.expires_at });
  }

  if (atividade === 'nao-encontrada') {
    return (
      <Screen withBottomNav={false} testID="screen-atividade">
        <AppHeader kicker="Minha Viagem" title="Não encontrei" onBack={() => router.back()} />
        <EmptyState
          title="Esta atividade não está disponível"
          description="Ela pode ter sido removida do roteiro, ou o link estar desatualizado."
        />
      </Screen>
    );
  }

  if (!atividade) {
    return (
      <Screen withBottomNav={false} testID="screen-atividade">
        <LoadingSkeleton label="Carregando atividade" />
      </Screen>
    );
  }

  const detalhes: [string, string | null][] = [
    ['Começa', hora(atividade.comeca, timezone)],
    ['Termina', hora(atividade.termina, timezone)],
    ['Sair às', hora(atividade.saida, timezone)],
    ['Ponto de encontro', atividade.ponto],
    ['Responsável Fly', atividade.responsavel],
    ['O que levar', atividade.oQueLevar],
    ['Roupa', atividade.roupa],
  ];

  return (
    <Screen withBottomNav={false} testID="screen-atividade">
      <AppHeader
        kicker={ROTULO_STATUS[atividade.status] ?? atividade.status}
        title={atividade.titulo}
        onBack={() => router.back()}
      />

      {/* Alteração pendente vem antes de tudo. */}
      {atividade.status === 'changed' && atividade.exigeConfirmacao && !confirmado ? (
        <AlertBanner
          severity="critical"
          title="Esta atividade mudou"
          description={
            atividade.notaDaMudanca ?? 'Confira os horários e o ponto de encontro abaixo.'
          }
          actionLabel="Confirmo que li"
          onAction={() => void confirmarLeitura()}
        />
      ) : null}

      {aviso ? <AlertBanner severity="warning" title={aviso} /> : null}

      {atividade.descricao ? (
        <Card>
          <Text variant="body" tone="muted">
            {atividade.descricao}
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.bloco}>
          {detalhes
            .filter(([, valor]) => valor)
            .map(([rotulo, valor]) => (
              <View key={rotulo} style={styles.linha}>
                <Text variant="body" tone="muted">
                  {rotulo}
                </Text>
                <Text variant="body" style={styles.valor}>
                  {valor}
                </Text>
              </View>
            ))}
          {atividade.comeca ? (
            <Text variant="body" tone="faint">
              {faltam(atividade.comeca)} · horário de{' '}
              {viagemData.kind === 'ready' ? viagemData.viagem.destino : 'destino'}
            </Text>
          ) : null}
        </View>
      </Card>

      {atividade.instrucoes ? (
        <View style={styles.secao}>
          <Kicker>Instruções</Kicker>
          <Card>
            <Text variant="body" tone="muted">
              {atividade.instrucoes}
            </Text>
          </Card>
        </View>
      ) : null}

      {/* Ready Check (§7.9). Só aparece quando há um aberto. */}
      {readyCheckId ? (
        <View style={styles.secao}>
          <Kicker>A equipe está esperando</Kicker>
          <Text variant="body" tone="muted">
            {meuEstado
              ? `Você respondeu: ${ROTULO_PRONTO[meuEstado]}. Pode mudar a qualquer momento.`
              : 'Avise a equipe como você está. Só a equipe vê sua resposta.'}
          </Text>
          <View style={styles.botoes}>
            {(Object.keys(ROTULO_PRONTO) as EstadoPronto[]).map((e) => (
              <Botao
                key={e}
                rotulo={ROTULO_PRONTO[e]}
                variante={meuEstado === e ? 'primario' : 'fantasma'}
                onPress={() => void responder(e)}
                testID={`ready-${e}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* QR de check-in (§7.8). */}
      <View style={styles.secao}>
        <Kicker>Check-in</Kicker>
        {qr ? (
          <Card>
            <View style={styles.qr}>
              {/* `showValue={false}`: o Fly ID pode ser lido em voz alta na base, mas
                  um token de check-in e segredo — imprimi-lo embaixo do codigo
                  daria a qualquer camera o que o QR ja daria, so que legivel. */}
              <FlyQR value={qr.token} size={200} showValue={false} />
              <Text variant="body" tone="muted">
                {qr.expira ? `Vale até ${hora(qr.expira, timezone)} · uso único` : 'Uso único'}
              </Text>
              <Text variant="body" tone="faint" style={styles.centro}>
                Não compartilhe: o código vale uma vez só, e quem usar primeiro fica com o check-in.
              </Text>
            </View>
          </Card>
        ) : (
          <Card>
            <View style={styles.bloco}>
              <Text variant="body" tone="muted">
                Gere seu código na hora do embarque. Ele vale por 15 minutos.
              </Text>
              <Botao rotulo="Gerar código" onPress={() => void gerarQr()} testID="gerar-qr" />
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  secao: { gap: space.md, marginTop: space.section },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.stroke,
    borderRadius: radius.chip,
  },
  valor: { flexShrink: 1, textAlign: 'right' },
  botoes: { gap: space.sm },
  qr: { alignItems: 'center', gap: space.md },
  centro: { textAlign: 'center' },
});
