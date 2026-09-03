/**
 * Falha de rede não é erro de servidor (§43, entrega 12).
 *
 * A diferença muda o que a tela diz. "Não consegui carregar" com um botão de
 * tentar de novo serve para os dois; mas só a falha de rede justifica mostrar
 * o número de emergência salvo e avisar que a mensagem **não** foi enviada.
 * Tratar tudo como erro genérico foi o que a auditoria de 27/08 encontrou em
 * três telas.
 *
 * Puro de propósito: nada de `react-native` aqui.
 */

const SINAIS = [
  'failed to fetch', // Chrome, Safari e o fetch da web
  'network request failed', // React Native
  'networkerror', // Firefox
  'load failed', // Safari iOS
  'fetch failed', // undici / Node
  'network error',
  'connection refused',
  'timeout',
];

function mensagemDe(erro: unknown): string {
  if (typeof erro === 'string') return erro;
  if (erro !== null && typeof erro === 'object') {
    const m = (erro as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

export function ehFalhaDeRede(erro: unknown): boolean {
  const texto = mensagemDe(erro).toLowerCase();
  if (texto === '') return false;
  return SINAIS.some((s) => texto.includes(s));
}
