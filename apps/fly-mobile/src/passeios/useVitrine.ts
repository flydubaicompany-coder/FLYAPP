import { useCallback, useEffect, useState } from 'react';
import { isMoeda } from '@fly/domain-types';
import { supabase } from '@/auth/client';
import type { Passeio } from './usePasseios';

/**
 * As seções da tela Passeios (§6.1).
 *
 * O servidor devolve linhas planas — seção repetida por passeio — e o
 * agrupamento acontece aqui. Duas viagens ao todo: uma para saber **quais**
 * passeios entram em cada prateleira, outra para os dados do card.
 *
 * A segunda existe porque a vitrine e a lista mostram o mesmo card, e o card
 * precisa de preço, mídia e favorito. Repetir esse `select` dentro da função
 * do banco duplicaria a regra de "qual é o menor preço ativo" em dois lugares.
 *
 * **Seção sem passeio não entra na lista.** A função já corta as vazias; este
 * arquivo não reintroduz uma prateleira vazia por engano ao juntar as duas
 * consultas — um passeio que suma entre uma e outra some da seção também.
 */

export interface SecaoDaVitrine {
  chave: string;
  titulo: string;
  subtitulo: string | null;
  passeios: Passeio[];
}

export type EstadoVitrine =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; secoes: SecaoDaVitrine[] };

export function useVitrine() {
  const [estado, setEstado] = useState<EstadoVitrine>({ kind: 'loading' });

  const carregar = useCallback(async () => {
    const db = supabase();

    const { data: linhas, error } = await db.rpc('vitrine_de_passeios');
    if (error) return setEstado({ kind: 'error', message: error.message });

    const planas = linhas ?? [];
    if (planas.length === 0) return setEstado({ kind: 'ready', secoes: [] });

    const ids = [...new Set(planas.map((l) => l.tour_id))];

    const [catalogo, favoritos] = await Promise.all([
      db
        .from('tours')
        .select(
          'id, slug, title, summary, city, category_key, badge, duration_minutes, points_awarded, is_quote_only, tour_media(storage_path, sort_order), tour_variants(price_cents, currency, is_active)',
        )
        .in('id', ids),
      db.from('tour_favorites').select('tour_id'),
    ]);

    if (catalogo.error) return setEstado({ kind: 'error', message: catalogo.error.message });

    const marcados = new Set((favoritos.data ?? []).map((f) => f.tour_id));

    const porId = new Map<string, Passeio>(
      (catalogo.data ?? []).map((t) => {
        const ativas = (t.tour_variants ?? []).filter((v) => v.is_active);
        // O menor preço ativo é o que o card mostra como "a partir de".
        const menor = ativas.reduce<(typeof ativas)[number] | null>(
          (m, v) => (m === null || v.price_cents < m.price_cents ? v : m),
          null,
        );
        const capa = [...(t.tour_media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];

        // `currency` chega como `string`: o gerador de tipos nao le o `check`
        // do dominio `currency_code`. Moeda que o app nao conhece derruba o
        // preco do card, e nao o card inteiro.
        const preco =
          menor && isMoeda(menor.currency)
            ? { centavos: menor.price_cents, moeda: menor.currency }
            : null;

        const passeio: Passeio = {
          id: t.id,
          slug: t.slug,
          titulo: t.title,
          resumo: t.summary,
          cidade: t.city,
          categoria: t.category_key,
          selo: t.badge,
          duracaoMin: t.duration_minutes,
          pontos: t.points_awarded,
          soProposta: t.is_quote_only,
          imagem: capa?.storage_path ?? null,
          precoMenor: preco,
          favorito: marcados.has(t.id),
        };
        return [t.id, passeio];
      }),
    );

    const agrupadas = new Map<string, SecaoDaVitrine>();
    for (const linha of planas) {
      const passeio = porId.get(linha.tour_id);
      if (!passeio) continue;

      const secao = agrupadas.get(linha.section_key) ?? {
        chave: linha.section_key,
        titulo: linha.section_label,
        subtitulo: linha.section_subtitle,
        passeios: [],
      };
      secao.passeios.push(passeio);
      agrupadas.set(linha.section_key, secao);
    }

    setEstado({
      kind: 'ready',
      // A ordem das seções é a do servidor; `Map` preserva a de inserção, e as
      // linhas já vêm ordenadas por `section_sort`.
      secoes: [...agrupadas.values()].filter((s) => s.passeios.length > 0),
    });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { estado, recarregar: carregar };
}
