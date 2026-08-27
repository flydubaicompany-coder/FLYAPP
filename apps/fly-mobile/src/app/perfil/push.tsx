import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import { AlertBanner, AppHeader, Botao, Card, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { usePush } from '@/push/usePush';
import { CENARIOS, dispararLocal, registrarNaCentral } from '@/push/teste';
import { permissaoAtual, pedirPermissao } from '@/push/adapter';
import { devePedir, textoDoPedido, type EstadoPermissao } from '@/push/permissao';

/**
 * Ambiente de teste de push (§38.10).
 *
 * Esta tela existe porque push é a funcionalidade mais difícil de verificar
 * do app: depende de permissão do sistema, de credencial de fornecedor, do
 * estado em que o app estava quando o aviso chegou e do estado da sessão
 * quando alguém tocou. Nada disso aparece num teste automatizado, e quase
 * nada aparece numa verificação distraída.
 *
 * Aqui cada cenário é disparado como notificação **local** — sem servidor,
 * sem APNs, sem FCM — e percorre exatamente o mesmo caminho que um push real
 * percorreria depois de entregue. Os dois últimos cenários são os que
 * costumam passar despercebidos: aviso sem destino e destino inválido.
 */
export default function PushScreen() {
  const { state } = useSession();
  const push = usePush();
  const [permissao, setPermissao] = useState<EstadoPermissao>('indeterminado');
  const [vezesPerguntado, setVezesPerguntado] = useState(0);
  const [ultimo, setUltimo] = useState<string | null>(null);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  useEffect(() => {
    void permissaoAtual().then(setPermissao);
  }, []);

  const pedido = devePedir({
    permissao,
    // Nesta tela o motivo é explícito: a pessoa veio testar.
    temViagem: false,
    viuCentral: true,
    vezesPerguntado,
  });

  async function pedir() {
    setVezesPerguntado((n) => n + 1);
    setPermissao(await pedirPermissao());
  }

  async function disparar(indice: number) {
    const cenario = CENARIOS[indice];
    if (!cenario) return;

    const disparou = await dispararLocal(cenario);

    // Um push real também grava na central. Testar só o banner esconderia a
    // diferença entre "apareceu" e "ficou registrado".
    if (!userId) {
      setUltimo(`${cenario.titulo}: sem sessão, não gravou na central.`);
      return;
    }

    const r = await registrarNaCentral(supabase(), userId, cenario);
    const banner = disparou ? 'Notificação disparada' : 'Sem notificação local nesta plataforma';
    setUltimo(
      r.ok
        ? `${banner}, e gravada na central: ${cenario.titulo}`
        : `${banner}, mas não gravou na central: ${r.motivo}`,
    );
  }

  const MOTIVOS: Record<string, string> = {
    web: 'Push remoto não existe na web. Os cenários abaixo continuam funcionando.',
    sem_permissao: 'Sem permissão do sistema. Conceda acima para registrar o token.',
    sem_credencial:
      'Sem credencial de APNs/FCM configurada. Este é o passo que falta do lado da Fly — o resto do caminho já funciona.',
    simulador: 'O simulador de iOS não emite token de push. Use um aparelho real.',
  };

  return (
    <Screen withBottomNav={false} testID="screen-push">
      <AppHeader kicker="Notificações" title="Teste de push" />

      <Card>
        <View style={styles.bloco}>
          <Text variant="section">Estado neste aparelho</Text>
          <Linha rotulo="Permissão do sistema" valor={ROTULO_PERMISSAO[permissao]} />
          <Linha rotulo="Token registrado" valor={push.registrado ? 'Sim' : 'Não'} />
          {push.motivo ? (
            <Text variant="body" tone="faint">
              {MOTIVOS[push.motivo] ?? push.motivo}
            </Text>
          ) : null}
        </View>
      </Card>

      {pedido.pedir ? (
        <Card>
          <View style={styles.bloco}>
            <Text variant="body" tone="muted">
              {textoDoPedido(pedido.motivo)}
            </Text>
            <Botao rotulo="Permitir notificações" onPress={() => void pedir()} />
          </View>
        </Card>
      ) : null}

      {permissao === 'negada' ? (
        <AlertBanner
          severity="warning"
          title="Notificações bloqueadas nos Ajustes"
          description="O sistema não pergunta de novo. A mudança precisa ser feita nos Ajustes do aparelho."
        />
      ) : null}

      <View style={styles.secao}>
        <Text variant="section">Cenários</Text>
        <Text variant="body" tone="muted">
          Cada botão dispara uma notificação local e grava o mesmo registro que um push real
          gravaria. Feche o app antes de tocar para exercitar o caminho de abertura a frio.
        </Text>

        {CENARIOS.map((c, i) => (
          <Card key={c.titulo}>
            <View style={styles.bloco}>
              <Text variant="body">{c.descricao}</Text>
              <Text variant="body" tone="faint">
                {c.deepLink ? `→ ${c.deepLink}` : 'sem destino'}
              </Text>
              <Botao
                rotulo="Disparar"
                variante="fantasma"
                rotuloAcessivel={`Disparar cenario: ${c.descricao}`}
                onPress={() => void disparar(i)}
                testID={`push-cenario-${i}`}
              />
            </View>
          </Card>
        ))}
      </View>

      {ultimo ? <AlertBanner title={ultimo} /> : null}
    </Screen>
  );
}

const ROTULO_PERMISSAO: Record<EstadoPermissao, string> = {
  indeterminado: 'Ainda não perguntada',
  concedida: 'Concedida',
  negada: 'Negada',
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.linha}>
      <Text variant="body" tone="muted">
        {rotulo}
      </Text>
      <Text variant="body">{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  secao: { gap: space.md, marginTop: space.section },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.stroke,
    borderRadius: radius.chip,
  },
});
