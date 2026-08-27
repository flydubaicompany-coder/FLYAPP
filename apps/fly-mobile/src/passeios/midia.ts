import { supabase } from '@/auth/client';

/**
 * URL pública da imagem de um passeio (§40.13).
 *
 * O bucket `passeios` é público, ao contrário de `documentos`. Foto de passeio
 * é material de vitrine, feita para ser vista por quem ainda nem comprou;
 * passaporte é o oposto, e por isso aquele bucket exige URL assinada de
 * sessenta segundos a cada abertura.
 *
 * Assinar URL de imagem de catálogo custaria uma ida ao servidor por card,
 * numa tela que mostra dez — para esconder uma foto que a Fly quer que circule.
 *
 * `getPublicUrl` não faz requisição: monta a URL a partir do caminho.
 */
export function urlDaImagem(caminho: string | null): string | null {
  if (!caminho) return null;
  return supabase().storage.from('passeios').getPublicUrl(caminho).data.publicUrl;
}
