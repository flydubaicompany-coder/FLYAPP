import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/auth/client';
import { ehFalhaDeRede } from '@/rede/falha';

/**
 * Modo Influenciador (§13.6).
 *
 * "Ativado por perfil e viagem" — as duas coisas. Não é papel do Fly ID: um
 * criador convidado para a viagem de setembro não vira criador da Fly para
 * sempre.
 *
 * O critério da §44 — "modo Influenciador aparece só para habilitados" — não
 * é um `if` aqui: é a RLS devolvendo **zero linhas** para quem não tem perfil
 * ativo. Quando não há perfil, não há tela.
 */

export type SituacaoEntregavel = 'pendente' | 'enviado' | 'aprovado' | 'recusado' | 'publicado';

export interface Entregavel {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  situacao: SituacaoEntregavel;
  url: string | null;
  observacao: string | null;
  alcanceDeclarado: number | null;
  engajamentoDeclarado: number | null;
}

export interface PerfilDeCriador {
  id: string;
  briefing: string | null;
  direitosDeUso: string | null;
  collab: string | null;
  arroba: string | null;
  entregaveis: Entregavel[];
}

export type InfluenciadorData =
  | { kind: 'loading' }
  /** Sem perfil ativo. Não é erro: é a maioria das pessoas. */
  | { kind: 'naoHabilitado' }
  | { kind: 'ready'; perfil: PerfilDeCriador }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export function useInfluenciador(userId: string | null) {
  const [data, setData] = useState<InfluenciadorData>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'naoHabilitado' });
    const db = supabase();

    let perfilRes;
    try {
      perfilRes = await db
        .from('influencer_profiles')
        .select(
          'id, briefing, usage_rights, collab_note, handle, influencer_deliverables(id, title, description, due_at, status, submitted_url, review_note, reach_declared, engagement_declared, created_at)',
        )
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
    } catch (e) {
      if (ehFalhaDeRede(e)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    if (perfilRes.error) {
      if (ehFalhaDeRede(perfilRes.error)) return setData({ kind: 'offline' });
      return setData({ kind: 'error', message: perfilRes.error.message });
    }

    const p = perfilRes.data;
    if (!p) return setData({ kind: 'naoHabilitado' });

    setData({
      kind: 'ready',
      perfil: {
        id: p.id,
        briefing: p.briefing,
        direitosDeUso: p.usage_rights,
        collab: p.collab_note,
        arroba: p.handle,
        entregaveis: [...(p.influencer_deliverables ?? [])]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((d) => ({
            id: d.id,
            titulo: d.title,
            descricao: d.description,
            prazo: d.due_at,
            situacao: d.status as SituacaoEntregavel,
            url: d.submitted_url,
            observacao: d.review_note,
            alcanceDeclarado: d.reach_declared === null ? null : Number(d.reach_declared),
            engajamentoDeclarado:
              d.engagement_declared === null ? null : Number(d.engagement_declared),
          })),
      },
    });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Enviar passa por função, e não por `update`.
   *
   * A RLS decide qual **linha**, e não qual **coluna**: com update direto na
   * tabela, o criador mudaria o próprio status para `aprovado`.
   */
  const enviar = useCallback(
    async (entregavelId: string, url: string, alcance: string, engajamento: string) => {
      const numero = (t: string): number | null => {
        const n = Number(t.trim().replace(/\D/g, ''));
        return t.trim() === '' || !Number.isFinite(n) ? null : n;
      };

      const { data: r, error } = await supabase().rpc('enviar_entregavel', {
        p_deliverable: entregavelId,
        p_url: url.trim(),
        ...(numero(alcance) === null ? {} : { p_reach: numero(alcance) as number }),
        ...(numero(engajamento) === null ? {} : { p_engagement: numero(engajamento) as number }),
      });

      if (error) {
        return {
          ok: false,
          motivo: ehFalhaDeRede(error) ? 'Sem conexão. O link não foi enviado.' : error.message,
        };
      }
      const linha = Array.isArray(r) ? r[0] : r;
      await carregar();
      return { ok: linha?.ok ?? false, motivo: linha?.motivo ?? null };
    },
    [carregar],
  );

  return { data, enviar, recarregar: carregar };
}
