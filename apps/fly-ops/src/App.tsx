import { useMemo } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { PublicEnv } from '@fly/config';
import { HealthPage } from './HealthPage';
import { SERVICE_NAME, SERVICE_TAGLINE } from './service';
import { loadEnv } from './env';
import { SessaoProvider, useSessao } from './auth/sessao';
import {
  Catalogo,
  Clientes,
  Consentimentos,
  Convites,
  Entrar,
  Eventos,
  Passaportes,
  Pedidos,
  Presenca,
  Scanner,
  Viagens,
  Vitrine,
} from './paginas';

/**
 * Fly Ops (§16 e §37.9).
 *
 * A Fase 2 entrega o que a §37.9 pede: convidados, clientes, onboarding,
 * papéis e consentimentos. O resto do §16 — viagens, roteiro, comércio,
 * carteira, SOS, álbum — entra junto das fases que criam esses domínios.
 *
 * O painel esconde o que o operador não pode usar, mas isso é conveniência,
 * não segurança: cada consulta ainda passa pela RLS, que decide de novo.
 */

const ABAS = [
  { para: '/clientes', rotulo: 'Clientes' },
  { para: '/convites', rotulo: 'Convites' },
  { para: '/viagens', rotulo: 'Viagens' },
  { para: '/presenca', rotulo: 'Presença' },
  { para: '/passaportes', rotulo: 'Passaportes' },
  { para: '/scanner', rotulo: 'Leitor' },
  { para: '/catalogo', rotulo: 'Catálogo' },
  { para: '/vitrine', rotulo: 'Vitrine' },
  { para: '/pedidos', rotulo: 'Pedidos' },
  { para: '/eventos', rotulo: 'Eventos' },
  { para: '/consentimentos', rotulo: 'Consentimentos' },
] as const;

function Casca({ children }: { children: React.ReactNode }) {
  const { estado, sair } = useSessao();
  const nome = estado.tipo === 'logado' ? estado.nome : null;

  return (
    <div className="app">
      <header className="topo">
        <div className="topo__marca">
          <p className="kicker">Fly Ops</p>
          <nav className="abas" aria-label="Seções do painel">
            {ABAS.map((a) => (
              <NavLink
                key={a.para}
                to={a.para}
                className={({ isActive }) => (isActive ? 'aba aba--ativa' : 'aba')}
              >
                {a.rotulo}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="topo__conta">
          {nome ? <span className="muted">{nome}</span> : null}
          <button type="button" className="botao botao--fantasma" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </header>

      <main className="page">{children}</main>
    </div>
  );
}

function Protegido({ children }: { children: React.ReactNode }) {
  const { estado } = useSessao();
  const local = useLocation();

  if (estado.tipo === 'carregando') return <p className="muted page">Carregando…</p>;

  if (estado.tipo === 'deslogado') {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }

  if (estado.tipo === 'semPermissao') {
    return (
      <main className="page page--narrow">
        <p className="kicker">Acesso</p>
        <h1>Este painel não é para o seu papel</h1>
        <p className="muted">
          Guias, mídia e bases usam o Fly Crew. Se você deveria estar aqui, peça para a
          administração revisar seu papel.
        </p>
      </main>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <main className="page page--narrow">
        <p className="kicker">Erro</p>
        <h1>Não consegui carregar sua sessão</h1>
        <p className="muted">{estado.mensagem}</p>
      </main>
    );
  }

  return <Casca>{children}</Casca>;
}

function Rotas() {
  const { estado } = useSessao();
  const env = useMemo<{ env: PublicEnv } | { erro: Error }>(() => {
    try {
      return { env: loadEnv() };
    } catch (e) {
      return { erro: e as Error };
    }
  }, []);

  if ('erro' in env) {
    return (
      <main className="page page--narrow">
        <p className="kicker">Configuração</p>
        <h1>{SERVICE_NAME} não subiu</h1>
        <p className="muted">{env.erro.message}</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/health" element={<HealthPage env={env.env} />} />
      <Route
        path="/entrar"
        element={estado.tipo === 'logado' ? <Navigate to="/clientes" replace /> : <Entrar />}
      />
      <Route
        path="/clientes"
        element={
          <Protegido>
            <Clientes />
          </Protegido>
        }
      />
      <Route
        path="/convites"
        element={
          <Protegido>
            <Convites />
          </Protegido>
        }
      />
      <Route
        path="/eventos"
        element={
          <Protegido>
            <Eventos />
          </Protegido>
        }
      />
      <Route
        path="/consentimentos"
        element={
          <Protegido>
            <Consentimentos />
          </Protegido>
        }
      />
      <Route
        path="/viagens"
        element={
          <Protegido>
            <Viagens />
          </Protegido>
        }
      />
      <Route
        path="/presenca"
        element={
          <Protegido>
            <Presenca />
          </Protegido>
        }
      />
      <Route
        path="/scanner"
        element={
          <Protegido>
            <Scanner />
          </Protegido>
        }
      />
      <Route
        path="/passaportes"
        element={
          <Protegido>
            <Passaportes />
          </Protegido>
        }
      />
      <Route
        path="/catalogo"
        element={
          <Protegido>
            <Catalogo />
          </Protegido>
        }
      />
      <Route
        path="/vitrine"
        element={
          <Protegido>
            <Vitrine />
          </Protegido>
        }
      />
      <Route
        path="/pedidos"
        element={
          <Protegido>
            <Pedidos />
          </Protegido>
        }
      />
      <Route path="/" element={<Navigate to="/clientes" replace />} />
      <Route
        path="*"
        element={
          <main className="page page--narrow">
            <p className="kicker">404</p>
            <h1>Página não encontrada</h1>
            <p className="muted">{SERVICE_TAGLINE}</p>
          </main>
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessaoProvider>
        <Rotas />
      </SessaoProvider>
    </BrowserRouter>
  );
}
