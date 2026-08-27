import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@fly/domain-types';
import { supabase } from '@/auth/client';
import type { Moeda } from './dinheiro';

/** Os quatro selos da §6.3. Tipo fechado: um quinto exige decisão. */
export type Selo = Database['public']['Enums']['tour_badge'];

/**
 * Catálogo de passeios (§6.1 e §6.2).
 *
 * A busca e os filtros são resolvidos **no servidor**, com paginação por
 * cursor (§40.2). Trazer o catálogo inteiro e filtrar no aparelho funciona com
 * doze passeios e para de funcionar com duzentos — e para de funcionar
 * exatamente quando o catálogo passa a valer a pena.
 */

export interface Passeio {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  cidade: string | null;
  categoria: string;
  selo: Selo | null;
  duracaoMin: number | null;
  pontos: number | null;
  soProposta: boolean;
  imagem: string | null;
  precoMenor: { centavos: number; moeda: Moeda } | null;
  favorito: boolean;
}

export interface Filtros {
  busca?: string;
  cidade?: string;
  categoria?: string;
  selo?: Selo;
}

export interface Pagina {
  itens: Passeio[];
  /** `created_at` do último item. Nulo quando acabou. */
  cursor: string | null;
}

const POR_PAGINA = 12;

export function usePasseios(filtros: Filtros) {
  const [pagina, setPagina] = useState<Pagina>({ itens: [], cursor: null });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [acabou, setAcabou] = useState(false);

  const buscar = useCallback(
    async (cursor: string | null) => {
      setErro(null);
      const db = supabase();

      let q = db
        .from('tours')
        .select(
          'id, slug, title, summary, city, category_key, badge, duration_minutes, points_awarded, is_quote_only, created_at, tour_media(storage_path, sort_order), tour_variants(price_cents, currency, is_active)',
        )
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(POR_PAGINA);

      // Cursor por `created_at`: estável mesmo se alguém publicar um passeio
      // novo no meio da rolagem. `offset` mostraria um item duas vezes.
      if (cursor) q = q.lt('created_at', cursor);

      if (filtros.busca?.trim()) {
        const termo = filtros.busca.trim();
        q = q.or(`title.ilike.%${termo}%,summary.ilike.%${termo}%`);
      }
      if (filtros.cidade) q = q.eq('city', filtros.cidade);
      if (filtros.categoria) q = q.eq('category_key', filtros.categoria);
      if (filtros.selo) q = q.eq('badge', filtros.selo);

      const [lista, favoritos] = await Promise.all([
        q,
        db.from('tour_favorites').select('tour_id'),
      ]);

      if (lista.error) {
        setErro(lista.error.message);
        return null;
      }

      const favoritados = new Set((favoritos.data ?? []).map((f) => f.tour_id));

      const itens: Passeio[] = (lista.data ?? []).map((t) => {
        const ativas = (t.tour_variants ?? []).filter((v) => v.is_active);
        // "A partir de": o menor preço entre as variantes ativas. Mostrar o
        // maior seria honesto e afastaria; mostrar sem dizer "a partir de"
        // seria promessa.
        const menor = ativas.reduce<{ centavos: number; moeda: Moeda } | null>((min, v) => {
          const atual = { centavos: v.price_cents, moeda: v.currency as Moeda };
          return min === null || atual.centavos < min.centavos ? atual : min;
        }, null);

        const capa = (t.tour_media ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)[0];

        return {
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
          precoMenor: menor,
          favorito: favoritados.has(t.id),
        };
      });

      const ultimo = lista.data?.[lista.data.length - 1];
      return { itens, cursor: ultimo?.created_at ?? null, fim: itens.length < POR_PAGINA };
    },
    [filtros.busca, filtros.cidade, filtros.categoria, filtros.selo],
  );

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setAcabou(false);
    const r = await buscar(null);
    if (r) {
      setPagina({ itens: r.itens, cursor: r.cursor });
      setAcabou(r.fim);
    }
    setCarregando(false);
  }, [buscar]);

  const carregarMais = useCallback(async () => {
    if (acabou || carregando || !pagina.cursor) return;
    const r = await buscar(pagina.cursor);
    if (r) {
      setPagina((p) => ({ itens: [...p.itens, ...r.itens], cursor: r.cursor }));
      setAcabou(r.fim);
    }
  }, [acabou, carregando, pagina.cursor, buscar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { pagina, carregando, erro, acabou, recarregar, carregarMais };
}

/** Liga e desliga o favorito, atualizando a tela antes da resposta. */
export async function alternarFavorito(tourId: string, favoritoAgora: boolean): Promise<boolean> {
  const db = supabase();
  const { error } = favoritoAgora
    ? await db.from('tour_favorites').delete().eq('tour_id', tourId)
    : await db.from('tour_favorites').insert({
        tour_id: tourId,
        user_id: (await db.auth.getUser()).data.user?.id as string,
      });
  return !error;
}

export interface Categoria {
  key: string;
  label: string;
}

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase()
        .from('tour_categories')
        .select('key, label')
        .order('sort_order');
      setCategorias(data ?? []);
    })();
  }, []);

  return categorias;
}
