import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { EmptyState, ErrorState, LoadingSkeleton, Text } from '@/ui';
import { CartaoPassaporte } from '@/trip/CartaoPassaporte';
import { casca, cor, raio, tipo } from '@/trip/design';
import { TripTela } from '@/trip/TripTela';
import type { DadosDoPassaporte } from '@/trip/mrz';
import {
  ROTULO_DOCUMENTO,
  useDocumentosPessoais,
  type TipoDeDocumento,
} from '@/trip/useDocumentosPessoais';

/**
 * Documentos — passaporte e CNH, no desenho do `Fly Trip Mode.dc.html`.
 *
 * O passaporte tem cartão próprio: é o documento que a viagem inteira depende,
 * e o desenho o trata como documento — capa, retrato, campos e a faixa legível
 * por máquina, com o brilho passando. Os dados são os que a pessoa cadastrou
 * em Perfil → Passaporte; a MRZ é calculada, não desenhada (ver `mrz.ts`).
 *
 * A CNH não tem cartão porque não há dado dela: é só o arquivo. Aparece como o
 * bloco tracejado de "adicionar", que é exatamente o que o desenho mostra.
 *
 * Duas coisas que a tela **não** faz, e as duas são deliberadas: não mostra o
 * arquivo embutido — abrir gera URL assinada de curta duração e entrega ao
 * sistema, porque imagem em cache de componente sobrevive ao logout — e não
 * apaga o anterior ao substituir.
 */

interface PassaporteCadastrado extends DadosDoPassaporte {
  verificado: boolean;
}

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
  const [passaporte, setPassaporte] = useState<PassaporteCadastrado | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void supabase()
      .from('passports')
      .select(
        'full_name, number, issuing_country, nationality, birth_date, expires_on, verified_at',
      )
      .order('expires_on', { ascending: false })
      .limit(1)
      .then(({ data: linhas }) => {
        const p = linhas?.[0];
        if (!p) return setPassaporte(null);
        setPassaporte({
          nomeCompleto: p.full_name,
          numero: p.number,
          paisEmissor: p.issuing_country,
          nacionalidade: p.nationality,
          nascimento: p.birth_date,
          validade: p.expires_on,
          verificado: p.verified_at !== null,
        });
      });
  }, [userId]);

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

  const arquivoPassaporte = data.kind === 'ready' ? data.porTipo.passport : undefined;
  const arquivoCnh = data.kind === 'ready' ? data.porTipo.driver_license : undefined;

  return (
    <TripTela kicker="MINHA VIAGEM" titulo="Documentos">
      {erro ? (
        <View style={e.margem}>
          <ErrorState description={erro} />
        </View>
      ) : null}
      {recado ? <Text style={[tipo('apoio'), e.recado]}>{recado}</Text> : null}

      {sessao.kind !== 'signedIn' ? (
        <View style={e.margem}>
          <EmptyState
            title="Entre para ver seus documentos"
            description="Seu passaporte e sua CNH ficam no cofre da sua conta Fly."
          />
        </View>
      ) : null}

      {sessao.kind === 'signedIn' && data.kind === 'loading' ? (
        <View style={e.margem}>
          <LoadingSkeleton />
        </View>
      ) : null}

      {/* Sem este ramo a tela some inteira quando a consulta falha — foi
          exatamente o que aconteceu: um estado de erro que nao desenha nada e
          pior do que o erro. */}
      {sessao.kind === 'signedIn' && data.kind === 'error' ? (
        <View style={e.margem}>
          <ErrorState description={data.message} />
        </View>
      ) : null}

      {sessao.kind === 'signedIn' && data.kind === 'ready' ? (
        <>
          <View style={e.margem}>
            {passaporte ? (
              <CartaoPassaporte dados={passaporte} verificado={passaporte.verificado} />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cadastrar passaporte"
                onPress={() => router.push('/perfil/passaporte')}
                style={({ pressed }) => [e.vazio, pressed && e.apertado]}
              >
                <View style={e.maisIcone}>
                  <Svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={cor.ouro}
                    strokeWidth={2}
                    strokeLinecap="round"
                  >
                    <Path d="M12 5v14M5 12h14" />
                  </Svg>
                </View>
                <Text style={[tipo('corpoForte'), { color: cor.texto }]}>Cadastrar passaporte</Text>
                <Text style={[tipo('miudo'), e.vazioApoio]}>
                  Número, validade e nome como está no documento
                </Text>
              </Pressable>
            )}
          </View>

          <View style={[e.margem, e.faixaEstado]}>
            <View style={e.pontoOk} />
            <Text style={[tipo('legenda'), e.estadoTexto]}>
              {arquivoPassaporte
                ? `Passaporte enviado em ${quando(arquivoPassaporte.enviadoEm)}`
                : 'Falta enviar a foto do passaporte'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={arquivoPassaporte ? 'Substituir passaporte' : 'Enviar passaporte'}
              disabled={ocupado}
              onPress={() => void acionarEnvio('passport')}
            >
              <Text style={[tipo('legenda'), { color: cor.m62 }]}>
                {arquivoPassaporte ? 'Substituir' : 'Enviar'}
              </Text>
            </Pressable>
          </View>

          {arquivoPassaporte ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver o arquivo do passaporte"
              onPress={() => void acionarAbertura(arquivoPassaporte.id)}
              style={({ pressed }) => [e.margem, e.verArquivo, pressed && e.apertado]}
            >
              <Text style={[tipo('legenda'), { color: cor.ouroClaro }]}>Ver arquivo enviado</Text>
            </Pressable>
          ) : null}

          <Text style={[tipo('secao'), e.tituloCnh]}>CNH / documento para dirigir</Text>

          <View style={e.margem}>
            {arquivoCnh ? (
              <View style={e.cnhPronta}>
                <View style={e.pontoOk} />
                <Text style={[tipo('corpoForte'), { flex: 1, color: cor.texto }]}>
                  Documento adicionado
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver documento para dirigir"
                  onPress={() => void acionarAbertura(arquivoCnh.id)}
                >
                  <Text style={[tipo('legenda'), { color: cor.ouroClaro }]}>Ver</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Substituir documento para dirigir"
                  disabled={ocupado}
                  onPress={() => void acionarEnvio('driver_license')}
                >
                  <Text style={[tipo('legenda'), { color: cor.m62 }]}>Substituir</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Adicionar CNH ou permissão internacional"
                disabled={ocupado}
                onPress={() => void acionarEnvio('driver_license')}
                style={({ pressed }) => [e.vazio, pressed && e.apertado]}
                testID="trip-adicionar-cnh"
              >
                <View style={e.maisIcone}>
                  <Svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={cor.ouro}
                    strokeWidth={2}
                    strokeLinecap="round"
                  >
                    <Path d="M12 5v14M5 12h14" />
                  </Svg>
                </View>
                <Text style={[tipo('corpoForte'), { color: cor.texto }]}>Adicionar documento</Text>
                <Text style={[tipo('miudo'), e.vazioApoio]}>
                  CNH ou permissão internacional para dirigir
                </Text>
              </Pressable>
            )}
          </View>

          <View style={[e.margem, e.privacidade]}>
            <Svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke={cor.m35}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M5 11h14v9H5zM8 11V7.5a4 4 0 0 1 8 0V11" />
            </Svg>
            <Text style={[tipo('miudo'), e.privacidadeTexto]}>
              Ficam no cofre da Fly, em armazenamento privado. Só você e a equipe autorizada abrem —
              e toda abertura fica registrada.
            </Text>
          </View>
        </>
      ) : null}
    </TripTela>
  );
}

const e = StyleSheet.create({
  margem: { marginHorizontal: 18, marginTop: 18 },
  recado: { marginHorizontal: 18, marginTop: 14, color: cor.ativo },
  vazio: {
    alignItems: 'center',
    gap: 11,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: raio.cartao,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: cor.ouroBorda30,
    backgroundColor: 'rgba(223,201,138,.04)',
  },
  maisIcone: {
    width: 46,
    height: 46,
    borderRadius: raio.icone,
    backgroundColor: 'rgba(223,201,138,.11)',
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vazioApoio: { color: cor.m45, textAlign: 'center' },
  faixaEstado: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: raio.caixa,
    backgroundColor: 'rgba(123,228,154,.08)',
    borderWidth: 1,
    borderColor: 'rgba(123,228,154,.2)',
  },
  pontoOk: { width: 8, height: 8, borderRadius: 4, backgroundColor: cor.ativo },
  estadoTexto: { flex: 1, color: cor.ativo },
  verArquivo: {
    marginTop: 9,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: raio.caixa,
    borderWidth: 1,
    borderColor: cor.ouroBorda30,
    backgroundColor: cor.ouroTinta12,
  },
  tituloCnh: { marginTop: 22, marginHorizontal: 18, color: cor.texto },
  cnhPronta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: raio.caixa,
    backgroundColor: cor.vidro035,
    borderWidth: 1,
    borderColor: cor.vidro075,
  },
  privacidade: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: raio.caixa,
    backgroundColor: cor.vidro035,
    borderWidth: 1,
    borderColor: cor.vidro07,
    marginBottom: casca.margemTela,
  },
  privacidadeTexto: { flex: 1, color: cor.m45 },
  apertado: { transform: [{ scale: 0.98 }] },
});
