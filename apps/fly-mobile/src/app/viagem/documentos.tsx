import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, space, touchTarget } from '@/theme';
import { AppHeader, Botao, Card, ErrorState, Kicker, LoadingSkeleton, Screen, Text } from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import {
  ROTULO_DOCUMENTO,
  useDocumentosPessoais,
  type TipoDeDocumento,
} from '@/trip/useDocumentosPessoais';

/**
 * Documentos da viagem — passaporte e documento para dirigir.
 *
 * Duas coisas que esta tela **não** faz, e as duas são deliberadas:
 *
 * - **Não mostra o documento embutido.** Abrir gera uma URL assinada de curta
 *   duração e entrega ao sistema. Renderizar dentro do app faria a imagem
 *   entrar no cache do componente, e um documento em cache é um documento que
 *   sobrevive ao logout.
 * - **Não apaga o anterior ao trocar.** O documento antigo continua no cofre;
 *   a tela mostra o mais recente. Substituir por engano na véspera da viagem
 *   não pode ser irreversível.
 *
 * O número do passaporte continua onde estava, em Perfil → Passaporte: ali é o
 * dado **digitado**, que a Fly confere. Aqui é o **arquivo**. São coisas
 * diferentes e foi assim desde a Fase 4.
 */

const TIPOS: readonly TipoDeDocumento[] = ['passport', 'driver_license'];

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DocumentosDaViagem() {
  const { state: sessao } = useSession();
  const { data: viagem } = useViagem();
  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;

  const { data, ocupado, enviar, abrir } = useDocumentosPessoais(userId, tripId);
  const [recado, setRecado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function acionarEnvio(tipo: TipoDeDocumento) {
    setErro(null);
    setRecado(null);
    const r = await enviar(tipo);
    if (r.ok) setRecado(`${ROTULO_DOCUMENTO[tipo]} guardado no seu cofre.`);
    else if (r.motivo) setErro(r.motivo);
  }

  async function acionarAbertura(id: string) {
    setErro(null);
    const url = await abrir(id);
    if (!url) return setErro('Não consegui abrir agora. Tente de novo.');
    await Linking.openURL(url);
  }

  return (
    <Screen scroll>
      <AppHeader kicker="Minha Viagem" title="Documentos" />

      <Text variant="body" tone="muted" style={styles.intro}>
        Guardados no cofre da Fly. Só você e a equipe autorizada abrem — e toda abertura fica
        registrada.
      </Text>

      {erro ? <ErrorState description={erro} /> : null}
      {recado ? (
        <Text variant="body" style={styles.recado}>
          {recado}
        </Text>
      ) : null}

      {data.kind === 'loading' ? <LoadingSkeleton /> : null}
      {data.kind === 'error' ? <ErrorState description={data.message} /> : null}

      {data.kind === 'ready'
        ? TIPOS.map((tipo) => {
            const doc = data.porTipo[tipo];
            return (
              <Card key={tipo} style={styles.cartao}>
                <Kicker>{ROTULO_DOCUMENTO[tipo]}</Kicker>

                {doc ? (
                  <>
                    <View style={styles.selo}>
                      <View style={styles.pontoOk} />
                      <Text variant="body">Documento adicionado</Text>
                    </View>
                    <Text variant="body" tone="muted">
                      Enviado em {quando(doc.enviadoEm)}
                      {doc.conferidoEm ? ' · conferido pela Fly' : ''}
                    </Text>

                    <View style={styles.acoes}>
                      <Botao
                        rotulo="Ver documento"
                        onPress={() => void acionarAbertura(doc.id)}
                        desabilitado={ocupado}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Substituir ${ROTULO_DOCUMENTO[tipo]}`}
                        disabled={ocupado}
                        onPress={() => void acionarEnvio(tipo)}
                        style={styles.substituir}
                      >
                        <Text variant="body" tone="muted">
                          Substituir
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.selo}>
                      <View style={styles.pontoFalta} />
                      <Text variant="body" tone="muted">
                        Ainda não adicionado
                      </Text>
                    </View>
                    <View style={styles.acoes}>
                      <Botao
                        rotulo="Adicionar documento"
                        onPress={() => void acionarEnvio(tipo)}
                        desabilitado={ocupado}
                      />
                    </View>
                  </>
                )}
              </Card>
            );
          })
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: space.lg,
  },
  recado: {
    color: palette.ok,
    marginBottom: space.md,
  },
  cartao: {
    marginBottom: space.lg,
    gap: space.xs,
  },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  pontoOk: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.ok,
  },
  pontoFalta: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.textFaint,
  },
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  substituir: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.card,
  },
});
