import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
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
  formatarFlyId,
} from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { hora } from '@/viagem/tempo';

/**
 * Ingressos e QR (§7.8).
 *
 * O Fly ID pessoal é permanente e pode ser lido em voz alta numa base — por
 * isso aparece com o número embaixo. Todo o resto é token opaco, de uso e
 * prazo limitados, e **não** mostra o valor: imprimir o segredo embaixo do
 * código daria de graça o que o QR já dá, só que legível a olho nu.
 */

const ROTULO_TIPO: Record<string, string> = {
  fly_id: 'Fly ID',
  activity_checkin: 'Check-in',
  ticket: 'Ingresso',
  benefit: 'Benefício',
  wristband: 'Pulseira',
  album: 'Álbum',
  city_point: 'Ponto da cidade',
  press_kit: 'Press kit',
  manual_fallback: 'Contingência',
};

interface Codigo {
  id: string;
  token: string;
  tipo: string;
  escopo: string | null;
  expiraEm: string | null;
  usos: number;
  limite: number | null;
  atividade: string | null;
}

export default function QrScreen() {
  const { state: sessao } = useSession();
  const { data: viagemData } = useViagem();
  const [codigos, setCodigos] = useState<Codigo[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const tz = viagemData.kind === 'ready' ? viagemData.viagem.timezone : 'UTC';
  const flyId = sessao.kind === 'signedIn' ? sessao.profile.publicId : null;

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('qr_tokens')
      .select('id, token, kind, scope, expires_at, uses, max_uses, activities(title)')
      .is('revoked_at', null)
      .order('issued_at', { ascending: false });

    if (error) return setAviso(error.message);

    const agora = Date.now();
    setCodigos(
      (data ?? [])
        // Um código vencido ou gasto na tela é uma promessa que não se
        // cumpre no balcão. Melhor não estar lá.
        .filter((q) => !q.expires_at || new Date(q.expires_at).getTime() > agora)
        .filter((q) => q.max_uses === null || q.uses < q.max_uses)
        .map((q) => ({
          id: q.id,
          token: q.token,
          tipo: q.kind,
          escopo: q.scope,
          expiraEm: q.expires_at,
          usos: q.uses,
          limite: q.max_uses,
          atividade: q.activities?.title ?? null,
        })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function revogar(id: string) {
    const { error } = await supabase().rpc('revogar_qr', { p_id: id });
    if (error) setAviso('Não consegui revogar agora.');
    await carregar();
  }

  if (!codigos) {
    return (
      <Screen withBottomNav={false} testID="screen-qr">
        <LoadingSkeleton label="Carregando seus códigos" />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-qr">
      <AppHeader kicker="Sua viagem" title="Ingressos e QR" />

      {aviso ? <AlertBanner severity="warning" title={aviso} /> : null}

      {/* O Fly ID é permanente e legível: é o que se apresenta numa base. */}
      {flyId ? (
        <Card>
          <View style={styles.centro}>
            <Kicker>Seu Fly ID</Kicker>
            <FlyQR value={flyId} size={180} />
            <Text variant="body" tone="faint" style={styles.nota}>
              {formatarFlyId(flyId)} — pode ser lido em voz alta numa Base Fly.
            </Text>
          </View>
        </Card>
      ) : null}

      <View style={styles.secao}>
        <Kicker>Códigos ativos</Kicker>

        {codigos.length === 0 ? (
          <Card>
            <Text variant="body" tone="muted">
              Nenhum código ativo. O check-in de cada atividade é gerado na hora, na tela da
              atividade.
            </Text>
          </Card>
        ) : (
          codigos.map((c) => (
            <Card key={c.id}>
              <View style={styles.centro}>
                <Kicker>{ROTULO_TIPO[c.tipo] ?? c.tipo}</Kicker>
                {c.atividade ? <Text variant="body">{c.atividade}</Text> : null}
                {c.escopo ? (
                  <Text variant="body" tone="muted">
                    {c.escopo}
                  </Text>
                ) : null}

                {/* Token opaco: nunca em texto. */}
                <FlyQR value={c.token} size={180} showValue={false} />

                <Text variant="body" tone="faint" style={styles.nota}>
                  {c.expiraEm ? `Vale até ${hora(c.expiraEm, tz)}` : 'Sem prazo'}
                  {c.limite ? ` · ${c.limite - c.usos} uso restante` : ''}
                </Text>

                <Botao
                  rotulo="Revogar este código"
                  variante="fantasma"
                  rotuloAcessivel={`Revogar código de ${ROTULO_TIPO[c.tipo] ?? c.tipo}`}
                  onPress={() => void revogar(c.id)}
                  testID={`revogar-${c.id}`}
                />
              </View>
            </Card>
          ))
        )}
      </View>

      <EmptyState
        title="Perdeu o celular?"
        description="Revogue seus códigos por aqui, de outro aparelho. Um código revogado deixa de valer imediatamente."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center', gap: space.md },
  secao: { gap: space.md, marginTop: space.section },
  nota: { textAlign: 'center' },
});
