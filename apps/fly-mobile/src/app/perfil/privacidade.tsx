import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { AppHeader, Card, ErrorState, LoadingSkeleton, Screen, Text, Toggle } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';

/**
 * Privacidade e consentimentos (§23.2 e §37.7).
 *
 * Consentimento e **por finalidade**, nunca um aceite guarda-chuva. Cada
 * finalidade diz o que a Fly faz com o dado, em linguagem de gente — quem lê
 * "tratamento de dados para fins operacionais" não consentiu com nada, só
 * desistiu de entender.
 *
 * Revogar não apaga o passado: grava um evento novo. É o que permite responder
 * "o cliente tinha consentido em tal data?" — e é o que a §23.2 exige quando
 * fala em trilha de auditoria.
 */

interface Finalidade {
  key: string;
  label: string;
  description: string;
  isRequired: boolean;
  isSensitive: boolean;
  version: number;
  granted: boolean;
}

export default function PrivacidadeScreen() {
  const { state } = useSession();
  const [finalidades, setFinalidades] = useState<Finalidade[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const userId = state.kind === 'signedIn' ? state.profile.id : null;

  const carregar = useCallback(async () => {
    if (!userId) return;
    const db = supabase();

    const [catalogo, atuais] = await Promise.all([
      db
        .from('consent_purposes')
        .select('key, label, description, is_required, is_sensitive, current_version'),
      db.from('current_consents').select('purpose_key, granted').eq('user_id', userId),
    ]);

    if (catalogo.error) return setErro(catalogo.error.message);
    if (atuais.error) return setErro(atuais.error.message);

    const concedido = new Map((atuais.data ?? []).map((c) => [c.purpose_key, c.granted]));

    setFinalidades(
      (catalogo.data ?? []).map((p) => ({
        key: p.key,
        label: p.label,
        description: p.description,
        isRequired: p.is_required,
        isSensitive: p.is_sensitive,
        version: p.current_version,
        granted: concedido.get(p.key) ?? false,
      })),
    );
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alternar(finalidade: Finalidade, valor: boolean) {
    if (!userId) return;
    setSalvando(finalidade.key);

    // Atualiza a tela antes da resposta: o interruptor precisa acompanhar o
    // dedo. Se a gravação falhar, recarregamos e o estado volta ao que o
    // servidor diz — nunca ao que a tela achava.
    setFinalidades(
      (atual) =>
        atual?.map((f) => (f.key === finalidade.key ? { ...f, granted: valor } : f)) ?? null,
    );

    const { error } = await supabase().from('consents').insert({
      user_id: userId,
      purpose_key: finalidade.key,
      granted: valor,
      version: finalidade.version,
      source: 'app',
    });

    if (error) {
      setErro('Não consegui registrar sua escolha. Tente de novo.');
      await carregar();
    }
    setSalvando(null);
  }

  if (state.kind !== 'signedIn') {
    return (
      <Screen withBottomNav={false} testID="screen-privacidade">
        <AppHeader kicker="Perfil" title="Entre para ver" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (erro && !finalidades) {
    return (
      <Screen withBottomNav={false} testID="screen-privacidade">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!finalidades) {
    return (
      <Screen withBottomNav={false} testID="screen-privacidade">
        <LoadingSkeleton label="Carregando suas escolhas" />
      </Screen>
    );
  }

  const comuns = finalidades.filter((f) => !f.isSensitive);
  const sensiveis = finalidades.filter((f) => f.isSensitive);

  return (
    <Screen withBottomNav={false} testID="screen-privacidade">
      <AppHeader
        kicker="Perfil"
        title="Suas escolhas"
        subtitle="Você decide o que a Fly pode usar, e muda quando quiser."
        onBack={() => router.back()}
      />

      {comuns.length > 0 ? (
        <Card padding={space.xs}>
          {comuns.map((f) => (
            <Toggle
              key={f.key}
              label={f.label}
              hint={f.description}
              value={f.granted}
              disabled={f.isRequired || salvando === f.key}
              onChange={(v) => void alternar(f, v)}
              testID={`consent-${f.key}`}
            />
          ))}
        </Card>
      ) : null}

      {sensiveis.length > 0 ? (
        <View style={styles.secao}>
          <Text variant="body" tone="warning">
            Dados sensíveis
          </Text>
          <Text variant="body" tone="muted">
            Só a equipe atribuída à sua viagem enxerga, e só enquanto você autorizar. Ao desligar, o
            acesso fecha na hora.
          </Text>
          <Card padding={space.xs}>
            {sensiveis.map((f) => (
              <Toggle
                key={f.key}
                label={f.label}
                hint={f.description}
                value={f.granted}
                disabled={salvando === f.key}
                onChange={(v) => void alternar(f, v)}
                testID={`consent-${f.key}`}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {erro ? (
        <Text variant="body" tone="danger" accessibilityRole="alert" style={styles.erro}>
          {erro}
        </Text>
      ) : null}

      <Text variant="body" tone="faint" style={styles.nota}>
        Guardamos o histórico das suas escolhas — inclusive quando você revoga. É assim que
        conseguimos provar o que estava valendo em cada data.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  secao: {
    gap: space.md,
    marginTop: space.section,
  },
  erro: {
    marginTop: space.lg,
  },
  nota: {
    marginTop: space.section,
  },
});
