import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/client';

/**
 * Busca global (§46, entrega 3).
 *
 * Ela existe porque a operação não trabalha por seção — trabalha por pessoa e
 * por número. Alguém liga dizendo "sou a Marina, pedido FLY-0042", e o
 * caminho até hoje era escolher a aba certa e filtrar dentro dela.
 *
 * Busca por: nome, Fly ID, número de pedido, assunto de caso, nome de viagem
 * e título de passeio. Documento e telefone **não** entram: a §23 pede o
 * mínimo, e um campo de busca que aceita número de passaporte é um campo que
 * registra número de passaporte no histórico do navegador de quem digitou.
 *
 * A RLS decide de novo em cada consulta — quem não pode ver pedido não acha
 * pedido aqui, mesmo com o número na mão.
 */

interface Achado {
  tipo: 'Cliente' | 'Pedido' | 'Caso' | 'Viagem' | 'Passeio';
  titulo: string;
  detalhe: string;
  para: string;
}

const MINIMO = 2;

export function Busca() {
  const [termo, setTermo] = useState('');
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const navegar = useNavigate();
  const caixa = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async (texto: string) => {
    const t = texto.trim();
    if (t.length < MINIMO) return setAchados(null);

    setBuscando(true);
    const db = supabase();
    // `%` e `_` são curingas do `ilike`. Sem escapar, um cliente chamado
    // "100%" busca tudo.
    const alvo = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

    const [pessoas, pedidos, casos, viagens, passeios] = await Promise.all([
      db
        .from('profiles')
        .select('id, public_id, preferred_name, display_name')
        .or(`preferred_name.ilike.${alvo},display_name.ilike.${alvo},public_id.ilike.${alvo}`)
        .limit(6),
      db.from('orders').select('id, reference, status').ilike('reference', alvo).limit(6),
      db.from('support_cases').select('id, subject, level, status').ilike('subject', alvo).limit(6),
      db.from('trips').select('id, name, status').ilike('name', alvo).limit(6),
      db.from('tours').select('id, slug, title, status').ilike('title', alvo).limit(6),
    ]);

    setBuscando(false);
    setAchados([
      ...(pessoas.data ?? []).map((p) => ({
        tipo: 'Cliente' as const,
        titulo: p.preferred_name ?? p.display_name ?? 'Sem nome',
        detalhe: p.public_id ?? '',
        para: `/clientes/${p.id}`,
      })),
      ...(pedidos.data ?? []).map((o) => ({
        tipo: 'Pedido' as const,
        titulo: o.reference,
        detalhe: o.status,
        para: '/pedidos',
      })),
      ...(casos.data ?? []).map((c) => ({
        tipo: 'Caso' as const,
        titulo: c.subject ?? 'Sem assunto',
        detalhe: `${c.level} · ${c.status}`,
        para: '/atendimento',
      })),
      ...(viagens.data ?? []).map((t) => ({
        tipo: 'Viagem' as const,
        titulo: t.name,
        detalhe: t.status,
        para: '/viagens',
      })),
      ...(passeios.data ?? []).map((t) => ({
        tipo: 'Passeio' as const,
        titulo: t.title,
        detalhe: t.status,
        para: '/catalogo',
      })),
    ]);
  }, []);

  // Espera a pessoa parar de digitar. Sem isso, "Marina" dispara seis rodadas
  // de cinco consultas.
  useEffect(() => {
    if (termo.trim().length < MINIMO) {
      setAchados(null);
      return;
    }
    const t = setTimeout(() => void buscar(termo), 250);
    return () => clearTimeout(t);
  }, [termo, buscar]);

  // Clicar fora fecha. A lista sobrepõe a tela; deixá-la aberta esconde
  // conteúdo de quem já esqueceu que buscou.
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAchados(null);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  return (
    <div className="busca" ref={caixa}>
      <input
        type="search"
        className="busca__campo"
        placeholder="Nome, Fly ID, pedido, caso…"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        aria-label="Busca global"
      />
      {achados !== null ? (
        <div className="busca__resultados" role="listbox" aria-label="Resultados">
          {buscando ? <p className="muted">Buscando…</p> : null}
          {!buscando && achados.length === 0 ? (
            <p className="muted">Nada com esse termo — ou nada que o seu papel possa ver.</p>
          ) : null}
          {achados.map((a) => (
            <button
              key={`${a.tipo}-${a.para}-${a.titulo}`}
              type="button"
              className="busca__item"
              onClick={() => {
                setTermo('');
                setAchados(null);
                navegar(a.para);
              }}
            >
              <span className="busca__tipo">{a.tipo}</span>
              <span>{a.titulo}</span>
              <span className="muted mono">{a.detalhe}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
