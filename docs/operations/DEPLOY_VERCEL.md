# Publicar Fly Ops e Fly App na Vercel

Dois projetos, um repositório. O monorepo é `flydubaicompany-coder/FLYAPP`, e
cada aplicação vira um projeto Vercel apontando para uma pasta diferente.

> **Estado em 27/08/2026: nada disto existe ainda.** A conta Vercel do Fly App
> não foi definida, e a conta antiga (`adrianmatheusampc-codes-projects`) está
> ligada a **outra** conta GitHub — ela não enxerga o `FLYAPP`. Este documento
> descreve o que fazer, não o que está no ar. Ver [ADR 0010](../architecture/adr/0010-infraestrutura-dedicada.md).

O Claude não tem permissão para criar projeto nesta conta — o passo a passo
abaixo é para você fazer uma vez. Depois disso, **todo push na `main` publica
sozinho**, e ele consegue acompanhar e diagnosticar os deploys.

---

## Antes de começar

Você vai precisar de dois valores, os mesmos para os dois projetos:

| Valor            | Onde achar                                             |
| ---------------- | ------------------------------------------------------ |
| URL do Supabase  | `https://ptmifjnfskwipjjxauns.supabase.co`             |
| Chave publicável | Supabase → Project Settings → API Keys → `publishable` |

A chave publicável **pode** ir para o cliente: é ela que a RLS espera. A
`service_role` **nunca** entra em nenhum dos dois — se ela vazar, a RLS deixa
de existir para quem tiver a chave.

---

## Projeto 1 — Fly Ops (o painel)

1. Abra <https://vercel.com/new> e escolha **Import Git Repository**.
2. Selecione `flydubaicompany-coder/FLYAPP`.
   Se ele não aparecer: **Adjust GitHub App Permissions** → marque o repositório.
3. Em **Configure Project**:

   | Campo            | Valor                                |
   | ---------------- | ------------------------------------ |
   | Project Name     | `fly-ops`                            |
   | Framework Preset | **Vite**                             |
   | Root Directory   | `apps/fly-ops`                       |
   | Build Command    | `npm run build --workspace @fly/ops` |
   | Install Command  | `npm install`                        |
   | Output Directory | `dist`                               |

   **Importante:** ao definir Root Directory, marque
   **“Include files outside of the Root Directory”**. É um monorepo npm
   workspaces: sem isso a instalação não enxerga `packages/`, e o build quebra
   com "Cannot find module @fly/design-tokens".

4. Em **Environment Variables**, acrescente:

   ```
   VITE_FLY_ENVIRONMENT=production
   VITE_FLY_SUPABASE_URL=https://ptmifjnfskwipjjxauns.supabase.co
   VITE_FLY_SUPABASE_PUBLISHABLE_KEY=<a chave publicável>
   VITE_FLY_APP_VERSION=0.1.0
   ```

5. **Deploy**.

---

## Projeto 2 — Fly App (o app do cliente, versão web)

Mesmo caminho, com outros valores:

| Campo            | Valor                                   |
| ---------------- | --------------------------------------- |
| Project Name     | `fly-app`                               |
| Framework Preset | **Other**                               |
| Root Directory   | `apps/fly-mobile`                       |
| Build Command    | `npm run build --workspace @fly/mobile` |
| Install Command  | `npm install`                           |
| Output Directory | `dist`                                  |

Marque **“Include files outside of the Root Directory”** aqui também.

Variáveis (note o prefixo diferente — Expo usa `EXPO_PUBLIC_`):

```
EXPO_PUBLIC_FLY_ENVIRONMENT=production
EXPO_PUBLIC_FLY_SUPABASE_URL=https://ptmifjnfskwipjjxauns.supabase.co
EXPO_PUBLIC_FLY_SUPABASE_PUBLISHABLE_KEY=<a chave publicável>
EXPO_PUBLIC_FLY_APP_VERSION=0.1.0
```

> A web do Fly App é **superfície de contingência** (§21.1), não o produto.
> Push nativo não existe ali, biometria não existe, e a sessão fica em
> `localStorage` em vez de Keychain. Serve para você ver as telas e para
> alguém acessar de um computador — o produto é o app nativo.

---

## Depois do primeiro deploy

**Volte ao Supabase** e libere as URLs novas, senão o login falha com
"redirect not allowed":

Authentication → URL Configuration → **Redirect URLs**, acrescente:

```
https://fly-ops.vercel.app/**
https://fly-app.vercel.app/**
```

(Troque pelos domínios que a Vercel devolver, se forem outros.)

---

## Quem entra, e com o quê

**O banco novo nasceu sem usuário nenhum.** As contas `demo@teste.fly` e
`ops@teste.fly` existiam só no projeto antigo e não foram migradas — a §37.1
diz que a Fly é por convite, e convite exige um operador já existente para
emiti-lo. O primeiro operador é criado à mão, uma vez. Ver a seção "Primeiro
operador" no [ESTADO](../ESTADO.md).

Para criar um cliente novo de verdade, o caminho é o do produto: Fly Ops →
Convites → **Convidar**, que gera o link de ativação. A Fly é por convite
(§37.1), e não há cadastro aberto — nem em produção, nem aqui.

---

## O que este deploy **não** é

- **Não é produção.** O banco é o de desenvolvimento, com dados de seed
  dentro. Ele já é dedicado ao Fly App (ADR 0010), mas continua sendo um só:
  não há ambiente separado de staging e produção. Antes de cliente real entrar,
  falta esse segundo ambiente e a decisão de retenção (P34).
- **Não tem pagamento.** A Fase 5 entrega o motor comercial com adapter em
  sandbox. Sem PSP contratado, nada é cobrado de verdade.
- **Não tem push.** Falta credencial de APNs e FCM (P32).
