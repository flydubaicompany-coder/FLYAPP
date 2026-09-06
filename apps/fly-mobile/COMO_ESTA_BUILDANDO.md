# ⚠️ Esta branch constrói em Trip Mode

`release/trip-mode-dubai-2026-09` — release da viagem Dubai, set/2026.

O script `build` desta branch fixa a variável:

```json
"build": "EXPO_PUBLIC_FLY_TRIP_MODE=true expo export --platform web"
```

## Por que aqui, e não no painel da Vercel

O painel é o lugar certo, e continua sendo: variável de ambiente por
_Environment: Preview_ é o controle próprio da Vercel, e não exige tocar em
código. Esta linha existe porque o release é hoje e o painel é acesso que eu
não tenho.

**Ela não pode chegar na `main`.** Se esta branch for mesclada com esta linha,
a produção do Fly App inteiro passa a construir em Trip Mode — quatro abas,
sem Passeios e sem Carteira. O `build:completo` ao lado é a saída: ele é o
script original, intacto.

## Ao mesclar, ou ao promover para produção

1. Configure `EXPO_PUBLIC_FLY_TRIP_MODE` no painel da Vercel, escopo
   **Preview**, no projeto `flyapp-cliente`.
2. Devolva o `build` ao original:
   `"build": "expo export --platform web"`.
3. Apague este arquivo.
