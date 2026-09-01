import { useMemo } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { PublicEnv } from '@fly/config';
import { HealthPage } from './HealthPage';
import { SERVICE_NAME, SERVICE_TAGLINE } from './service';
import { loadEnv } from './env';
import { SessaoProvider, useSessao } from './auth/sessao';
import { Entrar } from './paginas/Entrar';
import { Entregas } from './paginas/Entregas';

/**
 * Fly Crew — o app de campo (§42, entrega 12).
 *
 * Deixou de ser casca na Fase 7, que e a fase em que o conteudo dele entra.
 * O ESTADO ja registrava isso: "Fly Crew e so a casca com /health — e e o
 * correto: o conteudo dele e da Fase 7".
 *
 * A navegacao e curta de proposito. Este app e usado **em pe, com uma mao**,
 * do lado de uma cozinha ou de um ponto de encontro. Cada aba a mais e uma
 * chance de tocar na errada.
 */

const ABAS = [{ para: '/entregas', rotulo: 'Entregas' }] as const;

function Casca({ children }: { children: React.ReactNode }) {
  const { estado, sair } = useSessao();
  const nome = estado.tipo === 'logado' ? estado.nome : null;

  return (
    <div className="app">
      <header className="topo">
        <div className="topo__marca">
          <span className="kicker">FLY CREW</span>
        </div>
        <nav className="abas">
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

/** Sem sessao de campo, nao ha tela. Esconder botao nao e controle de acesso. */
function Protegido({ children }: { children: React.ReactNode }) {
  const { estado } = useSessao();
  if (estado.tipo === 'carregando') return <p className="muted">Carregando…</p>;
  if (estado.tipo !== 'logado') return <Entrar />;
  return <Casca>{children}</Casca>;
}

function Rotas({ env }: { env: PublicEnv }) {
  return (
    <Routes>
      <Route path="/health" element={<HealthPage env={env} />} />
      <Route
        path="/entregas"
        element={
          <Protegido>
            <Entregas />
          </Protegido>
        }
      />
      <Route path="/" element={<Navigate to="/entregas" replace />} />
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
  const result = useMemo<{ env: PublicEnv } | { error: Error }>(() => {
    try {
      return { env: loadEnv() };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  if ('error' in result) {
    return (
      <main className="page">
        <p className="kicker">Configuração</p>
        <h1>{SERVICE_NAME} não subiu</h1>
        <p className="muted">{result.error.message}</p>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <SessaoProvider>
        <Rotas env={result.env} />
      </SessaoProvider>
    </BrowserRouter>
  );
}
