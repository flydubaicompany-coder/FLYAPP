/**
 * Tipos dos modulos de asset.
 *
 * O Expo so gera `.expo/types` ao rodar `expo start`, o que deixaria o
 * typecheck dependente de ter ligado o servidor antes — ruim em CI. Esta
 * declaracao resolve os imports de imagem sem esse acoplamento.
 *
 * O `number` nao e arbitrario: o Metro transforma cada asset importado em um
 * id numerico do registro de assets, que e o que `<Image source>` espera.
 */
declare module '*.png' {
  const asset: number;
  export default asset;
}

declare module '*.jpg' {
  const asset: number;
  export default asset;
}

declare module '*.svg' {
  const asset: number;
  export default asset;
}
