import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { AlertBanner, AppHeader, Botao, Field, Screen, Text } from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { paraIso } from '@/viagem/passaporte';

/**
 * Solicitar proposta (§6.6).
 *
 * Fly Exclusives sem preço fechado — iate, helicóptero, jantar privativo. O
 * pedido vira tarefa no Fly Ops; não há preço aqui, e inventar um seria
 * exatamente o que a §33 proíbe.
 */
export default function PropostaScreen() {
  const { tour } = useLocalSearchParams<{ tour?: string }>();
  const router = useRouter();
  const { state: sessao } = useSession();

  const [mensagem, setMensagem] = useState('');
  const [data, setData] = useState('');
  const [pessoas, setPessoas] = useState('2');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (sessao.kind !== 'signedIn') return;
    setEnviando(true);
    setAviso(null);

    const n = Number(pessoas);
    const { error } = await supabase()
      .from('proposal_requests')
      .insert({
        user_id: sessao.profile.id,
        ...(tour ? { tour_id: tour } : {}),
        message: mensagem.trim() || null,
        desired_date: data.trim() ? paraIso(data) : null,
        people: Number.isFinite(n) && n > 0 ? n : null,
      });

    setEnviando(false);
    if (error) return setAviso('Não consegui enviar agora. Tente de novo.');
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Screen withBottomNav={false} testID="screen-proposta">
        <AppHeader kicker="Fly Exclusives" title="Pedido enviado" />
        <Text variant="body" tone="muted">
          A Fly monta a proposta e responde por aqui. Você recebe um aviso quando ela estiver
          pronta.
        </Text>
        <View style={styles.secao}>
          <Botao rotulo="Voltar aos passeios" onPress={() => router.replace('/passeios')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-proposta">
      <AppHeader kicker="Fly Exclusives" title="Solicitar proposta" />

      <Text variant="body" tone="muted">
        Esta experiência é montada sob medida. Conte o que você quer, e a Fly volta com a proposta —
        sem compromisso.
      </Text>

      {aviso ? <AlertBanner severity="warning" title={aviso} /> : null}

      <View style={styles.campos}>
        <Field
          label="O que você tem em mente"
          hint="Quanto mais detalhe, melhor a proposta."
          value={mensagem}
          onChangeText={setMensagem}
          multiline
          numberOfLines={4}
          testID="proposta-mensagem"
        />
        <Field
          label="Data desejada"
          hint="Opcional. dd/mm/aaaa"
          value={data}
          onChangeText={setData}
          keyboardType="numbers-and-punctuation"
          testID="proposta-data"
        />
        <Field
          label="Quantas pessoas"
          value={pessoas}
          onChangeText={setPessoas}
          keyboardType="number-pad"
          testID="proposta-pessoas"
        />
      </View>

      <View style={styles.secao}>
        <Botao
          rotulo="Enviar pedido"
          ocupado={enviando}
          desabilitado={mensagem.trim().length < 10}
          onPress={() => void enviar()}
          testID="proposta-enviar"
        />
        <Text variant="body" tone="faint">
          Nenhum valor é cobrado agora. A proposta chega para você aceitar ou recusar.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  campos: { gap: space.xl, marginTop: space.lg },
  secao: { gap: space.md, marginTop: space.section },
});
