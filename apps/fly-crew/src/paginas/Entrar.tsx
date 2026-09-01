import { useState } from 'react';
import { useSessao } from '../auth/sessao';

/** Login do painel. Mesma mensagem para conta inexistente e senha errada. */
export function Entrar() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(await entrar(email.trim().toLowerCase(), senha));
    setEnviando(false);
  }

  return (
    <main className="page page--narrow">
      <p className="kicker">Fly Crew</p>
      <h1>Entrar</h1>
      <p className="muted">Painel operacional. Acesso restrito à equipe.</p>

      <form onSubmit={(e) => void enviar(e)} className="form">
        <label className="field">
          <span className="muted">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span className="muted">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
            minLength={8}
          />
        </label>

        {erro ? (
          <p role="alert" className="erro">
            {erro}
          </p>
        ) : null}

        <button type="submit" disabled={enviando} className="botao">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
