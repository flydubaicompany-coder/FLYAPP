/**
 * Rota e distância, sem provedor de mapa (§12.1).
 *
 * A §12.1 pede "rotas e abertura no app de mapas instalado" no núcleo, e
 * deixa "mapa embutido avançado" e "3D" como futuro — fechando com a regra de
 * não depender de Google Earth nem Citymapper para o núcleo funcionar. Este
 * arquivo é esse núcleo: um endereço de rota por plataforma, e a conta da
 * distância. Nenhuma chave de API, nenhuma requisição.
 *
 * Puro de propósito: a plataforma entra por parâmetro em vez de vir de
 * `react-native`. Um `import { Platform }` aqui faria o vitest engasgar — a
 * armadilha que já mordeu duas vezes neste projeto.
 */

export interface Ponto {
  latitude: number;
  longitude: number;
}

/**
 * O endereço que abre o app de mapas instalado.
 *
 * - **iOS**: `maps.apple.com` — o sistema entrega ao Apple Maps quando ele
 *   está instalado, e ao navegador quando não está. Um esquema `maps://` cru
 *   falha em silêncio no simulador e na web.
 * - **Android**: `geo:` é o intent padrão e deixa o sistema perguntar qual
 *   app usar, em vez de a Fly escolher pelo cliente.
 * - **Web e o resto**: Google Maps por HTTPS.
 */
export function urlDeRota(os: string, destino: Ponto, rotulo?: string): string {
  const { latitude, longitude } = destino;
  const par = `${latitude},${longitude}`;

  if (os === 'ios') {
    const nome = rotulo ? `&q=${encodeURIComponent(rotulo)}` : '';
    return `https://maps.apple.com/?daddr=${par}${nome}`;
  }

  if (os === 'android') {
    const nome = rotulo ? `(${rotulo})` : '';
    return `geo:0,0?q=${par}${encodeURIComponent(nome)}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${par}`;
}

const RAIO_DA_TERRA_KM = 6371;

function radianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

/**
 * Distância em linha reta, em quilômetros.
 *
 * Linha reta, e não distância de percurso: percurso depende de rota, de
 * trânsito e de um provedor contratado. Dizer "2,1 km" quando o carro anda 6
 * é pior do que dizer "2,1 km em linha reta" — e é isso que a tela escreve.
 */
export function distanciaKm(de: Ponto, ate: Ponto): number {
  const dLat = radianos(ate.latitude - de.latitude);
  const dLng = radianos(ate.longitude - de.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianos(de.latitude)) * Math.cos(radianos(ate.latitude)) * Math.sin(dLng / 2) ** 2;
  return RAIO_DA_TERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "350 m", "1,2 km", "14 km". Vírgula decimal, que é como se lê em pt-BR. */
export function rotuloDeDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
