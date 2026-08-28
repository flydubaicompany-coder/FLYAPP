import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  Card,
  EmptyState,
  ErrorState,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { requestBiometric } from '@/auth/biometrics';
import { dataCurta } from '@/viagem/tempo';

/**
 * Cofre da viagem (§7.7).
 *
 * As regras que a tela precisa cumprir, e por quê:
 *
 * - **URL temporária, nunca guardada.** A cada abertura pede-se uma nova, de
 *   60 segundos. Uma URL assinada de longa duração é um link público com
 *   prazo — e prazo longo, na prática, é para sempre.
 * - **Biometria antes de conteúdo sensível.** Passaporte exige confirmar
 *   quem está segurando o celular agora, e não quem entrou na conta ontem.
 * - **O acesso deixa rastro.** Quem abre passa por `abrir_documento`, que
 *   registra. A tela não decide isso; se decidisse, bastaria um caminho
 *   alternativo para o registro sumir.
 */

const ROTULO_TIPO: Record<string, string> = {
  passport: 'Passaporte',
  ticket: 'Passagem',
  hotel_reservation: 'Reserva do hotel',
  insurance: 'Seguro',
  voucher: 'Voucher',
  authorization: 'Autorização',
  other: 'Documento',
};

interface Documento {
  id: string;
  tipo: string;
  titulo: string;
  exigeBiometria: boolean;
  revisadoEm: string | null;
  extraido: unknown;
  expiraEm: string | null;
}

export default function CofreScreen() {
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase()
      .from('documents')
      .select('id, kind, title, requires_biometric, reviewed_at, extracted, expires_at')
      .order('created_at', { ascending: false });

    if (error) return setErro(error.message);
    setDocs(
      (data ?? []).map((d) => ({
        id: d.id,
        tipo: d.kind,
        titulo: d.title,
        exigeBiometria: d.requires_biometric,
        revisadoEm: d.reviewed_at,
        extraido: d.extracted,
        expiraEm: d.expires_at,
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(doc: Documento) {
    setAviso(null);
    setAbrindo(doc.id);

    // Biometria antes de qualquer coisa: se falhar, nem o caminho no Storage
    // é pedido ao servidor.
    if (doc.exigeBiometria) {
      const r = await requestBiometric(`Confirme para abrir ${doc.titulo}`);
      if (!r.ok) {
        setAviso(
          r.reason === 'cancelled'
            ? 'Cancelado. O documento não foi aberto.'
            : 'Não consegui confirmar a biometria neste aparelho.',
        );
        setAbrindo(null);
        return;
      }
    }

    const db = supabase();

    // `abrir_documento` confere a permissão e registra o acesso. O caminho no
    // Storage só sai por aqui.
    //
    // A negativa vem em `permitido`, e não como erro: a função precisa
    // registrar a tentativa antes de recusar, e `raise` desfaria esse
    // registro junto com o resto da transação.
    const { data, error } = await db.rpc('abrir_documento', { p_id: doc.id });
    const linha = Array.isArray(data) ? data[0] : data;

    if (error || !linha) {
      setAviso('Documento indisponível.');
      setAbrindo(null);
      return;
    }

    if (!linha.permitido || !linha.storage_path) {
      setAviso('Você não tem acesso a este documento.');
      setAbrindo(null);
      return;
    }

    // 60 segundos. O suficiente para abrir, curto para não virar link.
    const { data: url, error: erroUrl } = await db.storage
      .from('documentos')
      .createSignedUrl(linha.storage_path, 60);

    setAbrindo(null);
    if (erroUrl || !url) return setAviso('Não consegui abrir o arquivo agora.');
    void Linking.openURL(url.signedUrl);
  }

  if (erro) {
    return (
      <Screen withBottomNav={false} testID="screen-cofre">
        <ErrorState description={erro} onRetry={() => void carregar()} />
      </Screen>
    );
  }

  if (!docs) {
    return (
      <Screen withBottomNav={false} testID="screen-cofre">
        <LoadingSkeleton label="Abrindo o cofre" />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-cofre">
      <AppHeader kicker="Minha Viagem" title="Documentos" onBack={() => router.back()} />

      <Text variant="body" tone="muted">
        Seus documentos ficam em armazenamento privado. Cada abertura gera um link temporário e fica
        registrada — você pode ver quem abriu o quê.
      </Text>

      {aviso ? <AlertBanner severity="warning" title={aviso} /> : null}

      {docs.length === 0 ? (
        <EmptyState
          title="Nenhum documento ainda"
          description="Passaporte, vouchers e autorizações enviados pela Fly aparecem aqui."
        />
      ) : (
        <View style={styles.lista}>
          {docs.map((d) => (
            <Card key={d.id}>
              <View style={styles.bloco}>
                <View style={styles.linhaTopo}>
                  <View style={styles.corpo}>
                    <Kicker>{ROTULO_TIPO[d.tipo] ?? d.tipo}</Kicker>
                    <Text variant="body" style={styles.titulo}>
                      {d.titulo}
                    </Text>
                  </View>
                  {d.exigeBiometria ? (
                    <Text variant="body" tone="faint">
                      Protegido
                    </Text>
                  ) : null}
                </View>

                {/* `extracted` continua no schema para o caso de a Fly enviar
                    um documento com campos já preenchidos. O que sumiu foi a
                    leitura automática de passaporte: a pessoa digita os dados
                    em Perfil › Passaporte, e não há imagem para ler. */}
                {d.extraido && !d.revisadoEm ? (
                  <Text variant="body" tone="gold">
                    Campos preenchidos pela Fly, ainda não conferidos por você.
                  </Text>
                ) : null}

                {d.expiraEm ? (
                  <Text variant="body" tone="faint">
                    Válido até {dataCurta(d.expiraEm, 'UTC')}
                  </Text>
                ) : null}

                <Botao
                  rotulo={d.exigeBiometria ? 'Confirmar e abrir' : 'Abrir'}
                  variante="fantasma"
                  ocupado={abrindo === d.id}
                  rotuloAcessivel={`Abrir ${d.titulo}`}
                  onPress={() => void abrir(d)}
                  testID={`doc-${d.id}`}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.rodape}>
        <Text variant="body" tone="faint">
          Aqui ficam os documentos que a Fly envia: vouchers, autorizações e reservas. Os dados do
          seu passaporte você digita em Perfil › Passaporte — a Fly não guarda foto do seu
          documento.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  lista: { gap: space.md },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  corpo: { flex: 1, gap: space.xs },
  titulo: { fontWeight: '600' },
  rodape: {
    marginTop: space.section,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
});
