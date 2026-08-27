import { useMemo } from 'react';
import type { PublicEnv } from '@fly/config';
import { HealthPage } from './HealthPage';
import { SERVICE_NAME, SERVICE_TAGLINE } from './service';
import { loadEnv } from './env';

/**
 * Fase 0: a aplicacao sobe, se identifica e expoe /health. As telas reais
 * chegam nas fases seguintes — nao adicione nada aqui sem uma fase autorizada.
 */
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

  if (window.location.pathname === '/health') {
    return <HealthPage env={result.env} />;
  }

  return (
    <main className="page">
      <p className="kicker">Fase 0</p>
      <h1>{SERVICE_NAME}</h1>
      <p className="muted">{SERVICE_TAGLINE}</p>
      <p className="muted">
        Fundação no ar. <a href="/health">Ver health</a>.
      </p>
    </main>
  );
}
