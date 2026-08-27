/**
 * Push (§38.10).
 *
 * A decisão fica nos módulos puros — `destino` e `permissao` —, a tradução
 * para o sistema operacional fica em `adapter`, e o estado do aparelho em
 * `aparelho` e `registro`. `teste` é o ambiente que permite exercitar o
 * caminho inteiro sem credencial de APNs ou FCM.
 */
export * from './destino';
export * from './permissao';
export * from './aparelho';
export * from './registro';
export * from './teste';
export { usePush, type EstadoPush } from './usePush';
