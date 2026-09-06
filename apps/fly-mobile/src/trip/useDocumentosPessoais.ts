import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/auth/client';

/**
 * Passaporte e documento para dirigir — enviar, trocar e abrir.
 *
 * O app **lia** o cofre desde a Fase 4 e nunca soube escrever nele: só as
 * notas fiscais tinham envio. Para a viagem isso não serve — o influenciador
 * chega no aeroporto e precisa ter subido o passaporte antes, do próprio
 * celular.
 *
 * O que já existia foi reaproveitado inteiro: a policy do bucket `documentos`
 * já aceita o dono gravar na própria pasta (`{owner_id}/…`), a `documents_insert`
 * já aceita `auth.uid() = owner_id`, e `abrir_documento` já confere permissão e
 * **registra o acesso**. Não houve política nova, e nem podia haver: afrouxar
 * RLS para caber um prazo é como este projeto perde a única coisa que o
 * protege.
 *
 * Trocar não apaga: o documento anterior continua no cofre, e o mais recente é
 * o que a tela mostra. Um passaporte substituído por engano na véspera da
 * viagem não deve ser irrecuperável.
 */

export type TipoDeDocumento = 'passport' | 'driver_license';

export const ROTULO_DOCUMENTO: Record<TipoDeDocumento, string> = {
  passport: 'Passaporte',
  driver_license: 'CNH / Documento para dirigir',
};

export interface DocumentoPessoal {
  id: string;
  tipo: TipoDeDocumento;
  titulo: string;
  enviadoEm: string;
  conferidoEm: string | null;
}

export type DocumentosData =
  | { kind: 'loading' }
  | { kind: 'ready'; porTipo: Partial<Record<TipoDeDocumento, DocumentoPessoal>> }
  | { kind: 'error'; message: string };

export interface Resultado {
  ok: boolean;
  motivo?: string;
}

/** base64 → bytes. Mesmo utilitário das notas; o Storage não aceita string. */
function paraBytes(base64: string): Uint8Array {
  const bin = globalThis.atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function useDocumentosPessoais(userId: string | null, tripId: string | null) {
  const [data, setData] = useState<DocumentosData>({ kind: 'loading' });
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!userId) return setData({ kind: 'loading' });

    const { data: linhas, error } = await supabase()
      .from('documents')
      .select('id, kind, title, created_at, reviewed_at')
      .eq('owner_id', userId)
      .in('kind', ['passport', 'driver_license'])
      .order('created_at', { ascending: false });

    if (error) return setData({ kind: 'error', message: error.message });

    // O primeiro de cada tipo é o mais recente — a lista já veio ordenada.
    const porTipo: Partial<Record<TipoDeDocumento, DocumentoPessoal>> = {};
    for (const d of linhas ?? []) {
      const tipo = d.kind as TipoDeDocumento;
      if (porTipo[tipo]) continue;
      porTipo[tipo] = {
        id: d.id,
        tipo,
        titulo: d.title,
        enviadoEm: d.created_at,
        conferidoEm: d.reviewed_at,
      };
    }

    setData({ kind: 'ready', porTipo });
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const enviar = useCallback(
    async (tipo: TipoDeDocumento): Promise<Resultado> => {
      if (!userId) return { ok: false, motivo: 'Entre na sua conta.' };

      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        return {
          ok: false,
          motivo: 'Precisamos do acesso às suas fotos para enviar o documento.',
        };
      }

      const escolha = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        // O documento precisa ser legível, não precisa ser um arquivo de 12 MB.
        // O bucket recusa acima de 20 MB de qualquer forma.
        quality: 0.8,
      });
      if (escolha.canceled) return { ok: false };

      const asset = escolha.assets[0];
      if (!asset?.base64) return { ok: false, motivo: 'Não consegui ler a imagem escolhida.' };

      setOcupado(true);
      const db = supabase();
      const mime = asset.mimeType ?? 'image/jpeg';
      const extensao = mime.includes('png') ? 'png' : 'jpg';
      // `{owner_id}/{uuid}` — a primeira pasta é o que a policy do bucket
      // confere, e é ela que garante que ninguém grava na pasta de outro.
      const caminho = `${userId}/${globalThis.crypto.randomUUID()}.${extensao}`;

      const envio = await db.storage
        .from('documentos')
        .upload(caminho, paraBytes(asset.base64), { contentType: mime, upsert: false });

      if (envio.error) {
        setOcupado(false);
        return { ok: false, motivo: envio.error.message };
      }

      const { error } = await db.from('documents').insert({
        owner_id: userId,
        trip_id: tripId,
        kind: tipo,
        title: ROTULO_DOCUMENTO[tipo],
        storage_path: caminho,
        mime_type: mime,
        size_bytes: asset.fileSize ?? null,
      });

      if (error) {
        // O registro falhou depois do envio: sem isto o arquivo fica órfão no
        // bucket, contando espaço e sem nada que o alcance.
        await db.storage.from('documentos').remove([caminho]);
        setOcupado(false);
        return {
          ok: false,
          motivo: error.message.includes('driver_license')
            ? 'O tipo CNH ainda não existe neste banco. Aplique a migration do Trip Mode.'
            : error.message,
        };
      }

      setOcupado(false);
      await carregar();
      return { ok: true };
    },
    [userId, tripId, carregar],
  );

  /**
   * Abre o documento.
   *
   * Sempre por `abrir_documento`: é ela que confere a permissão e **registra
   * quem abriu**. Pedir a URL assinada direto ao Storage funcionaria e apagaria
   * o rastro — e o rastro é metade do controle.
   */
  const abrir = useCallback(async (id: string): Promise<string | null> => {
    const { data: url, error } = await supabase().rpc('abrir_documento', { p_id: id });
    if (error || typeof url !== 'string') return null;
    return url;
  }, []);

  return { data, ocupado, enviar, abrir, recarregar: carregar };
}
