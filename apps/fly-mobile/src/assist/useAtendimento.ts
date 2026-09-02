import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';

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
  | { kind: 'error'; message: string };

export function useAtendimento(userId: string | null, pais = 'AE') {
  const [data, setData] = useState<AtendimentoData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    const [casos, bases, cfg] = await Promise.all([
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
        .select('id, name, address, phone, hours_note, services, is_open, latitude, longitude')
        .eq('is_active', true)
        .order('sort_order'),
      db
        .from('app_config')
        .select('key, value')
        .in('key', ['support.emergency_numbers', 'support.sos_disclaimer']),
    ]);

    if (casos.error) return setData({ kind: 'error', message: casos.error.message });

    const conf = new Map((cfg.data ?? []).map((c) => [c.key, c.value]));
    const numeros = conf.get('support.emergency_numbers') as Record<string, string> | null;
    const aviso = conf.get('support.sos_disclaimer');

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
      bases: (bases.data ?? []).map((b) => ({
        id: b.id,
        nome: b.name,
        endereco: b.address,
        telefone: b.phone,
        horario: b.hours_note,
        servicos: b.services ?? [],
        aberta: b.is_open,
        latitude: b.latitude,
        longitude: b.longitude,
      })),
    });
  }, [userId, pais]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Abre um caso. O SOS ja nasce com a confirmacao gravada, pela RPC. */
  const abrir = useCallback(
    async (nivel: Nivel, assunto: string, tripId: string | null) => {
      // Os parametros opcionais da RPC sao `string | undefined` no tipo
      // gerado, e nao `| null`: omitir e diferente de mandar nulo.
      const { data: r, error } = await supabase().rpc('abrir_atendimento', {
        p_level: nivel,
        ...(assunto.trim() ? { p_subject: assunto.trim() } : {}),
        ...(tripId ? { p_trip: tripId } : {}),
      });
      if (error) return { ok: false, motivo: error.message };
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
      if (error) return { ok: false, motivo: error.message };
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
