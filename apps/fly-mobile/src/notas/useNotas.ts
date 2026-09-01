import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/auth/client';
import { paraCentavos } from './valor';

/**
 * Notas fiscais (§41, entrega 11).
 *
 * **Sem scanner e sem OCR**, por decisao do dono: a pessoa fotografa e digita
 * o que leu; a Fly revisa. Um numero extraido errado e pior que numero nenhum,
 * porque parece conferido.
 *
 * Os campos sao **declarados**, e a tela diz isso. Ate a revisao confirmar,
 * valem como "o que a pessoa disse que era".
 */

export type SituacaoDaNota = 'received' | 'in_review' | 'approved' | 'rejected' | 'duplicate';

export interface Nota {
  id: string;
  estabelecimento: string | null;
  centavos: number | null;
  moeda: string | null;
  emitidaEm: string | null;
  situacao: SituacaoDaNota;
  observacao: string | null;
  enviadaEm: string;
}

export type NotasData =
  | { kind: 'loading' }
  | { kind: 'ready'; notas: Nota[]; regraTaxFree: unknown | null }
  | { kind: 'error'; message: string };

export const ROTULO_SITUACAO: Record<SituacaoDaNota, string> = {
  received: 'Recebida',
  in_review: 'Em conferência',
  approved: 'Aprovada',
  rejected: 'Não aceita',
  duplicate: 'Repetida',
};

export interface DadosDaNota {
  estabelecimento: string;
  /** O que a pessoa digitou, em texto. "450,00" ou "450.00". */
  valor: string;
  moeda: string;
  emitidaEm: string;
}

/** base64 para bytes, sem dependencia nova. */
function paraBytes(base64: string): Uint8Array {
  const bin = globalThis.atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function useNotas(userId: string | null) {
  const [data, setData] = useState<NotasData>({ kind: 'loading' });
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });
    const db = supabase();

    const [notas, config] = await Promise.all([
      db
        .from('receipts')
        .select('id, merchant, amount_cents, currency, issued_on, status, review_note, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      db.from('app_config').select('value').eq('key', 'taxfree.rule').maybeSingle(),
    ]);

    if (notas.error) return setData({ kind: 'error', message: notas.error.message });

    setData({
      kind: 'ready',
      regraTaxFree: config.data?.value ?? null,
      notas: (notas.data ?? []).map((n) => ({
        id: n.id,
        estabelecimento: n.merchant,
        centavos: n.amount_cents === null ? null : Number(n.amount_cents),
        moeda: n.currency,
        emitidaEm: n.issued_on,
        situacao: n.status as SituacaoDaNota,
        observacao: n.review_note,
        enviadaEm: n.created_at,
      })),
    });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Escolhe a foto e envia.
   *
   * A imagem sobe para `notas/{id do dono}/…`, e a primeira pasta ser o id e o
   * que torna a policy do Storage simples: sem consultar `receipts`, o bucket
   * ja sabe de quem e o arquivo.
   */
  const enviar = useCallback(
    async (dados: DadosDaNota): Promise<{ ok: boolean; motivo?: string }> => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };

      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        return {
          ok: false,
          motivo: 'A Fly precisa da sua permissão para acessar as fotos e enviar a nota.',
        };
      }

      const escolha = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        // Comprime: a nota precisa ser legivel, nao precisa ser um arquivo de
        // 12 MB. O bucket recusa acima de 15 MB de qualquer forma.
        quality: 0.7,
      });

      if (escolha.canceled) return { ok: false };

      const asset = escolha.assets[0];
      if (!asset?.base64) return { ok: false, motivo: 'Não consegui ler a imagem escolhida.' };

      const centavos = paraCentavos(dados.valor);
      if (dados.valor.trim() && centavos === null) {
        return { ok: false, motivo: 'O valor precisa ser um número maior que zero.' };
      }

      setEnviando(true);
      const db = supabase();
      const extensao = (asset.mimeType ?? 'image/jpeg').includes('png') ? 'png' : 'jpg';
      const caminho = `${userId}/${globalThis.crypto.randomUUID()}.${extensao}`;

      const envio = await db.storage.from('notas').upload(caminho, paraBytes(asset.base64), {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: false,
      });

      if (envio.error) {
        setEnviando(false);
        return { ok: false, motivo: envio.error.message };
      }

      const { error } = await db.from('receipts').insert({
        user_id: userId,
        storage_path: caminho,
        mime_type: asset.mimeType ?? 'image/jpeg',
        size_bytes: asset.fileSize ?? null,
        merchant: dados.estabelecimento.trim() || null,
        amount_cents: centavos,
        currency: centavos === null ? null : (dados.moeda as 'AED'),
        issued_on: dados.emitidaEm.trim() || null,
      });

      if (error) {
        // O arquivo subiu e a linha nao: remove para nao deixar orfao no bucket.
        await db.storage.from('notas').remove([caminho]);
        setEnviando(false);
        return { ok: false, motivo: error.message };
      }

      await carregar();
      setEnviando(false);
      return { ok: true };
    },
    [userId, carregar],
  );

  return { data, enviar, enviando, recarregar: carregar };
}
