import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { configDeViagem } from './modo';
import {
  linkDeWhatsapp,
  mensagemDeExperiencia,
  mensagemDeSuporte,
  type AssuntoDeSuporte,
} from './whatsapp';

/**
 * O suporte da viagem, com o contexto que o app já sabe.
 *
 * O botão flutuante do Fly Assist continua onde estava — é ele que a §4.2
 * exige presente nas telas críticas, e não faria sentido criar um segundo
 * botão de ajuda. O que muda no Trip Mode é **o que acontece ao tocar**: em
 * vez de abrir um chat que nunca foi provado em produção, abre o WhatsApp da
 * operação com nome, viagem e atividade já escritos.
 *
 * ## De onde vem o número
 *
 * Primeiro de `app_config['support.whatsapp']`, para a operação poder trocar
 * sem redeploy. Se a linha não existir — e hoje ela não existe, porque a
 * migration da Fase 11 ainda não foi aplicada — cai no valor do build. Sem
 * nenhum dos dois, `pronto` é falso e a tela diz que o canal não está
 * configurado, em vez de abrir um link para ninguém.
 */
export interface SuporteFly {
  /** Há número utilizável? Enquanto for falso, a tela avisa em vez de agir. */
  pronto: boolean;
  carregando: boolean;
  /** Abre o WhatsApp com a mensagem de suporte pronta. */
  abrirSuporte: (assunto: AssuntoDeSuporte) => Promise<boolean>;
  /** Abre o WhatsApp pedindo uma experiência. */
  pedirExperiencia: (nome: string) => Promise<boolean>;
}

export function useSuporteFly(): SuporteFly {
  const { state: sessao } = useSession();
  const { data: viagem } = useViagem();
  const [numero, setNumero] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const reserva = configDeViagem().whatsappDeReserva;
      const { data } = await supabase()
        .from('app_config')
        .select('value')
        .eq('key', 'support.whatsapp')
        .maybeSingle();

      if (!ativo) return;
      // `app_config` guarda jsonb; uma string vem como string mesmo. Qualquer
      // outra forma (objeto, nulo, "PENDENTE") não é telefone, e o
      // `normalizarTelefone` recusa depois.
      const doBanco = typeof data?.value === 'string' ? data.value : null;
      setNumero(doBanco ?? reserva);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const contexto = useCallback(() => {
    const perfil = sessao.kind === 'signedIn' ? sessao.profile : null;
    const v = viagem.kind === 'ready' ? viagem.viagem : null;
    return {
      nome: perfil?.preferredName ?? perfil?.displayName ?? null,
      viagem: v ? `viagem ${v.nome}` : null,
      // O "agora" do banco já resolve o fuso do destino. Um celular ainda no
      // horário de Brasília mandaria a atividade errada no primeiro dia.
      atividade: v?.agora?.titulo ?? v?.proximo?.titulo ?? null,
      local: v?.proximo?.ponto ?? null,
    };
  }, [sessao, viagem]);

  const abrir = useCallback(
    async (texto: string) => {
      const url = linkDeWhatsapp(numero, texto);
      if (!url) return false;
      // `canOpenURL` mente em alguns aparelhos sem o esquema declarado; abrir e
      // tratar a falha é mais confiável do que perguntar antes.
      try {
        await Linking.openURL(url);
        return true;
      } catch {
        return false;
      }
    },
    [numero],
  );

  return {
    pronto: linkDeWhatsapp(numero, 'x') !== null,
    carregando,
    abrirSuporte: (assunto) => abrir(mensagemDeSuporte(assunto, contexto())),
    pedirExperiencia: (nome) => abrir(mensagemDeExperiencia(nome, contexto())),
  };
}
