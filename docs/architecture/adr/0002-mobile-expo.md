# ADR 0002 — Aplicativo cliente em Expo, do zero

**Status:** aceito · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

A §21.1 recomenda Expo + React Native + TypeScript + Expo Router para o app
cliente. Já existia `appflycompany/`, um app Expo funcional e publicado.

Só que ele diverge da spec no que é estrutural: as abas são Início, Transporte,
Alimentação, Passeios e Perfil — não as cinco da §4 — e o tema é branco com
azul, não preto/grafite/dourado da §25.

## Decisão

`apps/fly-mobile` nasce **do zero** com o scaffold oficial:

```
npx create-expo-app@latest --template default@sdk-57
```

SDK 57 confirmado como atual na documentação oficial antes de instalar
(regra §34.4). `appflycompany` é tratado como **outro produto**: não migrado,
não copiado, não alterado.

## Alternativas consideradas

- **Copiar `appflycompany` para `apps/fly-mobile`** — preservaria ~20
  componentes prontos e faria o app iniciar no dia 1. Descartado pelo dono: é
  outro app, não um estágio anterior deste.
- **Deixar o mobile fora do monorepo por ora** — adiaria a decisão, mas
  nenhuma aplicação cliente iniciaria no monorepo.

## Consequências

- Nenhum risco de regressão em um app que está no ar.
- O scaffold veio com um app de demonstração; ele foi removido. Sobraram
  `_layout.tsx`, uma tela de fundação e a tela de health.
- Dependências de demonstração (`@expo/ui`, `expo-symbols`, `expo-glass-effect`,
  `expo-web-browser`, `expo-device`, `reanimated`, `worklets`) foram retiradas.
  Voltam quando uma fase precisar delas.
- `scheme: "fly"` colide com o do `appflycompany`. Em um mesmo aparelho, só um
  resolve `fly://`. Pendência registrada no decision log.
- Testes de componente do RN pedem `jest-expo`, o runner oficial do Expo. Na
  Fase 0 só há teste de módulo puro, no vitest. Ver [TEST_MATRIX](../../quality/TEST_MATRIX.md).
