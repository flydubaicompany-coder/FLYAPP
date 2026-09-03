import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { sessionStorage } from '@/auth/storage';
import { ehFalhaDeRede } from '@/rede/falha';
import { CHAVE_CONTATOS, lerContatos, serializarContatos, type ContatosSalvos } from './cache';

/**
 * Atendimento, ajuda urgente e SOS (§12.3 e §12.4).
 *
 * Os tres niveis sao **um caso so** com nivel diferente. Quem comeca uma
 * conversa e precisa escalar para SOS nao pode perder o historico — e o
 * historico e a thread.
 */

export type Nivel = 'chat' | 'urgent' | 'sos';
export type SituacaoDoCaso =
  'open' | 'accepted' | 'in_progress' | 'escalated' | 'resolved' | 'closed';

export const ROTULO_NIVEL: Record<Nivel, string> = {
  chat: 'Conversa',
  urgent: 'Ajuda urgente',
  sos: 'SOS',
};

export const ROTULO_SITUACAO: Record<SituacaoDoCaso, string> = {
  open: 'A Fly recebeu',
  accepted: 'Alguém assumiu',
  in_progress: 'Em atendimento',
  escalated: 'Escalado',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};

export interface Mensagem {
  id: string;
  autorId: string | null;
  corpo: string;
  doSistema: boolean;
  quando: string;
}

export interface Caso {
  id: string;
  nivel: Nivel;
  assunto: string | null;
  situacao: SituacaoDoCaso;
  abertoEm: string;
  aceitoEm: string | null;
  primeiraRespostaEm: string | null;
  mensagens: Mensagem[];
}

export interface BaseFly {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  horario: string | null;
  servicos: string[];
  /** O recado do dia — a "fila ou disponibilidade" da §12.2, em texto. */
  observacao: string | null;
  aberta: boolean;
  latitude: number | null;
  longitude: number | null;
}

export type AtendimentoData =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      casos: Caso[];
      bases: BaseFly[];
      /** Numero de emergencia publica do pais. `null` = nao configurado. */
      emergencia: string | null;
      aviso: string | null;
    }
  /**
   * Sem conexao (§43, entrega 12).
   *
   * A thread nao existe offline — mensagem nao entra em cache. O que sobra e
   * o que se disca: o numero de emergencia e os telefones das Bases Fly,
   * salvos na ultima vez que a tela abriu. "Ligacao funciona sem chat" e
   * criterio da §43, e uma ligacao sem numero nao funciona.
   */
  | { kind: 'offline'; contatos: ContatosSalvos | null }
  | { kind: 'error'; message: string };

export function useAtendimento(userId: string | null, pais = 'AE') {
  const [data, setData] = useState<AtendimentoData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    /** O que a tela mostra quando a rede cai: so o que se disca. */
    const cair = async () => {
      const salvo = await sessionStorage.getItem(CHAVE_CONTATOS).catch(() => null);
      setData({ kind: 'offline', contatos: lerContatos(salvo) });
    };

    const consultas = [
      db
        .from('support_cases')
        .select(
          'id, level, subject, status, opened_at, accepted_at, first_response_at, support_messages(id, author_id, body, is_system, created_at)',
        )
        .eq('user_id', userId)
        .order('opened_at', { ascending: false })
        .limit(20),
      db
        .from('fly_bases')
        .select(
          'id, name, address, phone, hours_note, services, notes, is_open, latitude, longitude',
        )
        .eq('is_active', true)
        .order('sort_order'),
      db
        .from('app_config')
        .select('key, value')
        .in('key', ['support.emergency_numbers', 'support.sos_disclaimer']),
    ] as const;

    // O `fetch` lanca quando nao ha rede; o PostgREST devolve `error` quando
    // ha rede e o servidor recusou. Sao dois caminhos, e so o primeiro e
    // "offline".
    let casos, bases, cfg;
    try {
      [casos, bases, cfg] = await Promise.all(consultas);
    } catch (e) {
      if (ehFalhaDeRede(e)) return cair();
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    if (casos.error) {
      if (ehFalhaDeRede(casos.error)) return cair();
      return setData({ kind: 'error', message: casos.error.message });
    }

    const conf = new Map((cfg.data ?? []).map((c) => [c.key, c.value]));
    const numeros = conf.get('support.emergency_numbers') as Record<string, string> | null;
    const aviso = conf.get('support.sos_disclaimer');

    const listaDeBases = (bases.data ?? []).map((b) => ({
      id: b.id,
      nome: b.name,
      endereco: b.address,
      telefone: b.phone,
      horario: b.hours_note,
      servicos: b.services ?? [],
      observacao: b.notes,
      aberta: b.is_open,
      latitude: b.latitude,
      longitude: b.longitude,
    }));

    // Salva o que se disca, para a proxima vez que nao houver rede. Nada de
    // conversa e nada de localizacao entram aqui.
    const paraSalvar: ContatosSalvos = {
      emergencia: numeros?.[pais] ?? null,
      aviso: typeof aviso === 'string' ? aviso : null,
      bases: listaDeBases.map((b) => ({
        nome: b.nome,
        telefone: b.telefone,
        endereco: b.endereco,
      })),
      salvoEm: new Date().toISOString(),
    };
    // Falhar ao gravar cache nao pode derrubar a tela de emergencia.
    void sessionStorage
      .setItem(CHAVE_CONTATOS, serializarContatos(paraSalvar))
      .catch(() => undefined);

    setData({
      kind: 'ready',
      emergencia: numeros?.[pais] ?? null,
      aviso: typeof aviso === 'string' ? aviso : null,
      casos: (casos.data ?? []).map(
        (c: {
          id: string;
          level: string;
          subject: string | null;
          status: string;
          opened_at: string;
          accepted_at: string | null;
          first_response_at: string | null;
          support_messages?: Array<{
            id: string;
            author_id: string | null;
            body: string;
            is_system: boolean;
            created_at: string;
          }> | null;
        }) => ({
          id: c.id,
          nivel: c.level as Nivel,
          assunto: c.subject,
          situacao: c.status as SituacaoDoCaso,
          abertoEm: c.opened_at,
          aceitoEm: c.accepted_at,
          primeiraRespostaEm: c.first_response_at,
          mensagens: [...(c.support_messages ?? [])]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((m) => ({
              id: m.id,
              autorId: m.author_id,
              corpo: m.body,
              doSistema: m.is_system,
              quando: m.created_at,
            })),
        }),
      ),
      bases: listaDeBases,
    });
  }, [userId, pais]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * A resposta da Fly chega sem recarregar (§43, entrega 11).
   *
   * O canal e privado porque o Postgres Changes aplica a RLS de
   * `support_messages` para cada assinante: nao ha filtro por caso aqui, e
   * nao precisa haver — a policy so entrega a thread de quem participa dela.
   *
   * Recarregar a tela inteira em vez de anexar a mensagem recebida e
   * deliberado: o mesmo evento tambem muda a situacao do caso (a primeira
   * resposta da equipe carimba `first_response_at` por gatilho), e montar
   * isso a mao no cliente seria uma segunda verdade.
   */
  useEffect(() => {
    if (!userId) return;
    const db = supabase();
    const canal = db
      .channel('assist:thread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        () => {
          void carregar();
        },
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_cases' }, () => {
        void carregar();
      })
      .subscribe();

    return () => {
      void db.removeChannel(canal);
    };
  }, [userId, carregar]);

  /**
   * Abre um caso. O SOS ja nasce com a confirmacao gravada, pela RPC.
   *
   * O contexto (§43, entrega 4) e **conferido no servidor**: atividade de
   * viagem que a pessoa nao enxerga e pedido que nao e dela sao ignorados, e
   * o caso nasce sem etiqueta em vez de ser recusado. Recusar um SOS porque o
   * id envelheceu seria trocar uma etiqueta por um atendimento.
   */
  const abrir = useCallback(
    async (
      nivel: Nivel,
      assunto: string,
      tripId: string | null,
      contexto?: { atividade?: string | null; pedido?: string | null },
    ) => {
      // Os parametros opcionais da RPC sao `string | undefined` no tipo
      // gerado, e nao `| null`: omitir e diferente de mandar nulo.
      const { data: r, error } = await supabase().rpc('abrir_atendimento', {
        p_level: nivel,
        ...(assunto.trim() ? { p_subject: assunto.trim() } : {}),
        ...(tripId ? { p_trip: tripId } : {}),
        ...(contexto?.atividade ? { p_activity: contexto.atividade } : {}),
        ...(contexto?.pedido ? { p_order: contexto.pedido } : {}),
      });
      if (error) {
        return {
          ok: false,
          motivo: ehFalhaDeRede(error)
            ? 'Sem conexão: o pedido NÃO chegou à Fly. Se for urgente, ligue.'
            : error.message,
        };
      }
      await carregar();
      const linha = Array.isArray(r) ? r[0] : r;
      return { ok: true, casoId: linha?.caso ?? null };
    },
    [carregar],
  );

  const responder = useCallback(
    async (casoId: string, corpo: string) => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };
      if (!corpo.trim()) return { ok: false, motivo: 'Escreva alguma coisa.' };
      const { error } = await supabase()
        .from('support_messages')
        .insert({ case_id: casoId, author_id: userId, body: corpo.trim() });
      if (error) {
        // "Ligacao funciona sem chat" (§43): quando a mensagem nao sai, a
        // tela precisa dizer isso com todas as letras e oferecer o telefone.
        return {
          ok: false,
          motivo: ehFalhaDeRede(error)
            ? 'Sem conexão: sua mensagem NÃO foi enviada. Se for urgente, ligue.'
            : error.message,
        };
      }
      await carregar();
      return { ok: true };
    },
    [userId, carregar],
  );

  /**
   * Envia a localizacao, uma vez.
   *
   * "localizacao minima e consentida" (§43): so acontece quando a pessoa toca
   * no botao, e o ponto fica ligado ao caso. Nao ha rastreamento.
   */
  const enviarLocalizacao = useCallback(
    async (casoId: string, lat: number, lng: number, precisao: number | null) => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };
      const { error } = await supabase().from('case_locations').insert({
        case_id: casoId,
        user_id: userId,
        latitude: lat,
        longitude: lng,
        accuracy_m: precisao,
      });
      if (error) return { ok: false, motivo: error.message };
      return { ok: true };
    },
    [userId],
  );

  return { data, abrir, responder, enviarLocalizacao, recarregar: carregar };
}
