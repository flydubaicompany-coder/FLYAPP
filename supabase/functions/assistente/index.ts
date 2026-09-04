/**
 * Assistente Fly (§15.1 e §45).
 *
 * **Por que esta função existe, e não um cliente de IA no app.**
 *
 * A chave do provedor de modelo é secreta. A regra do projeto não tem
 * exceção: no cliente, só a chave publicável. Um assistente que chamasse o
 * modelo do aparelho publicaria a chave no primeiro `strings` do bundle.
 *
 * **Os dois clientes de banco, e por que são dois.**
 *
 * `comoUsuario` carrega o JWT de quem perguntou. **Toda ferramenta consulta
 * por ele** — então "prompt malicioso não acessa outra viagem" (§45) não
 * depende de o modelo se comportar: ele pede a viagem que quiser, e o Postgres
 * devolve as linhas de quem perguntou. A autorização das tools é a RLS.
 *
 * `comoServico` só escreve auditoria. Ele existe porque `assistant_runs` não
 * tem GRANT de insert para `authenticated`: se o cliente pudesse escrever ali,
 * escreveria a própria medição de custo.
 *
 * **O loop é manual, e isso é escolha.** O SDK tem um tool runner que faria o
 * laço sozinho. Aqui o laço tem três voltas, é só leitura, e cada chamada de
 * ferramenta precisa virar linha de auditoria antes de rodar — inline isso
 * cabe em vinte linhas e não depende de um helper em beta.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.123.0';
import {
  apenasPermitido,
  custoEstimadoCentavos,
  decidirProvedor,
  envelopeDeDado,
  FERRAMENTAS,
  SISTEMA,
  type NomeDoProvedor,
} from '../_shared/assistente.ts';

const MAX_VOLTAS = 3;

interface Corpo {
  pergunta?: unknown;
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * As ferramentas, contra o banco, **com o token de quem perguntou**.
 *
 * Devolve as linhas cruas; quem corta os campos é `apenasPermitido`, no
 * `_shared`. A separação é de propósito: a consulta pode trazer o que a RLS
 * deixar, e a barreira decide o que sai daqui.
 */
async function rodarFerramenta(
  db: SupabaseClient,
  nome: string,
  entrada: Record<string, unknown>,
): Promise<{ linhas: Record<string, unknown>[]; erro?: string }> {
  try {
    switch (nome) {
      case 'roteiro_do_dia': {
        const { data: viagem } = await db.rpc('viagem_atual');
        const v = Array.isArray(viagem) ? viagem[0] : viagem;
        if (!v?.viagem_id) return { linhas: [] };

        const dia = typeof entrada['dia_numero'] === 'number' ? entrada['dia_numero'] : v.dia_atual;
        if (dia === null || dia === undefined) return { linhas: [] };

        const { data } = await db
          .from('trip_days')
          .select(
            'day_number, day_date, activities(title, starts_at, departure_at, meeting_point, status)',
          )
          .eq('trip_id', v.viagem_id)
          .eq('day_number', dia)
          .maybeSingle();

        const atividades = (data?.activities ?? []) as Array<Record<string, unknown>>;
        return {
          linhas: atividades.map((a) => ({
            dia_numero: data?.day_number,
            data: data?.day_date,
            titulo: a['title'],
            comeca_em: a['starts_at'],
            saida_em: a['departure_at'],
            ponto_de_encontro: a['meeting_point'],
            situacao: a['status'],
          })),
        };
      }

      case 'o_que_esta_incluso': {
        const { data } = await db
          .from('trip_inclusions')
          .select('category, title, description, status')
          .limit(60);
        return {
          linhas: (data ?? []).map((i) => ({
            categoria: i.category,
            titulo: i.title,
            descricao: i.description,
            situacao: i.status,
          })),
        };
      }

      case 'catalogo_de_passeios': {
        const busca = typeof entrada['busca'] === 'string' ? entrada['busca'].trim() : '';
        let q = db
          .from('tours')
          .select(
            'slug, title, summary, base_price_cents, currency, duration_minutes, cancellation_policies(title)',
          )
          .eq('status', 'published')
          .limit(20);
        if (busca !== '') q = q.ilike('title', `%${busca}%`);
        const { data } = await q;
        return {
          linhas: (data ?? []).map((t) => ({
            slug: t.slug,
            titulo: t.title,
            resumo: t.summary,
            preco_centavos: t.base_price_cents,
            moeda: t.currency,
            duracao_minutos: t.duration_minutes,
            politica: (t.cancellation_policies as { title?: string } | null)?.title ?? null,
          })),
        };
      }

      case 'meus_pedidos': {
        const { data } = await db
          .from('orders')
          .select('reference, status, created_at, policy_title, policy_text')
          .order('created_at', { ascending: false })
          .limit(20);
        return {
          linhas: (data ?? []).map((o) => ({
            referencia: o.reference,
            situacao: o.status,
            feito_em: o.created_at,
            politica_titulo: o.policy_title,
            politica_texto: o.policy_text,
          })),
        };
      }

      case 'saldo_de_pontos': {
        const { data } = await db.from('points_balance').select('saldo, nivel').maybeSingle();
        return { linhas: data === null ? [] : [{ saldo: data.saldo, nivel: data.nivel }] };
      }

      case 'bases_e_ajuda': {
        const { data } = await db
          .from('fly_bases')
          .select('name, address, hours_note, phone, services, is_open')
          .eq('is_active', true)
          .order('sort_order');
        return {
          linhas: (data ?? []).map((b) => ({
            nome: b.name,
            endereco: b.address,
            horario: b.hours_note,
            telefone: b.phone,
            servicos: b.services,
            aberta: b.is_open,
          })),
        };
      }

      default:
        // Nome que não está no catálogo é recusa, e a recusa fica registrada.
        return { linhas: [], erro: 'ferramenta desconhecida' };
    }
  } catch (e) {
    return { linhas: [], erro: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ erro: 'metodo nao suportado' }, 405);

  const autorizacao = req.headers.get('Authorization');
  if (!autorizacao) return json({ erro: 'sem sessao' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const publicavel = Deno.env.get('SUPABASE_ANON_KEY');
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publicavel || !servico) return json({ erro: 'ambiente incompleto' }, 500);

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return json({ erro: 'corpo invalido' }, 400);
  }

  const pergunta = typeof corpo.pergunta === 'string' ? corpo.pergunta.trim() : '';
  if (pergunta === '' || pergunta.length > 2000) {
    return json({ erro: 'pergunta invalida' }, 400);
  }

  // O token de quem perguntou. É por ele que toda ferramenta consulta.
  const comoUsuario = createClient(url, publicavel, {
    global: { headers: { Authorization: autorizacao } },
  });
  const comoServico = createClient(url, servico);

  const { data: usuario } = await comoUsuario.auth.getUser();
  const userId = usuario.user?.id;
  if (!userId) return json({ erro: 'sem sessao' }, 401);

  const [flagRes, cfgRes] = await Promise.all([
    comoServico
      .from('feature_flags')
      .select('is_enabled')
      .eq('key', 'assistant.enabled')
      .maybeSingle(),
    comoServico
      .from('app_config')
      .select('key, value')
      .in('key', [
        'assistant.provider',
        'assistant.model',
        'assistant.pricing_usd_per_million',
        'assistant.max_output_tokens',
      ]),
  ]);

  const cfg = new Map((cfgRes.data ?? []).map((c) => [c.key, c.value as unknown]));
  const chave = Deno.env.get('ANTHROPIC_API_KEY');

  const provedor: NomeDoProvedor = decidirProvedor({
    ligado: flagRes.data?.is_enabled === true,
    provedor:
      typeof cfg.get('assistant.provider') === 'string'
        ? (cfg.get('assistant.provider') as string)
        : null,
    temCredencial: typeof chave === 'string' && chave.length > 0,
  });

  const comecou = Date.now();

  /** Grava a corrida. Falhar aqui não pode derrubar a resposta ao cliente. */
  const gravar = async (campos: Record<string, unknown>): Promise<string | null> => {
    const { data } = await comoServico
      .from('assistant_runs')
      .insert({ user_id: userId, pergunta, provedor, ...campos })
      .select('id')
      .maybeSingle();
    return data?.id ?? null;
  };

  if (provedor === 'desligado') {
    /**
     * O caminho honesto, e hoje o único.
     *
     * Sem flag, sem provedor ou sem credencial, a resposta diz isso e oferece
     * a equipe — que existe desde a Fase 8, com fila e SLA. O que não
     * acontece é o app fingir que o assistente está pensando.
     */
    const runId = await gravar({
      resultado: 'sem_provedor',
      duracao_ms: Date.now() - comecou,
    });
    return json({
      disponivel: false,
      run_id: runId,
      resposta: null,
      motivo:
        'O assistente ainda não está disponível. A equipe da Fly responde por você — ' +
        'toque em falar com a Fly.',
    });
  }

  const modelo =
    typeof cfg.get('assistant.model') === 'string'
      ? (cfg.get('assistant.model') as string)
      : 'claude-opus-5';
  const maxSaida =
    typeof cfg.get('assistant.max_output_tokens') === 'number'
      ? (cfg.get('assistant.max_output_tokens') as number)
      : 4000;
  const precoBruto = cfg.get('assistant.pricing_usd_per_million') as
    { input?: number; output?: number } | undefined;
  const preco = {
    entradaPorMilhao: precoBruto?.input ?? 0,
    saidaPorMilhao: precoBruto?.output ?? 0,
  };

  const anthropic = new Anthropic({ apiKey: chave as string });

  const ferramentas: Anthropic.Tool[] = FERRAMENTAS.map((f) => ({
    name: f.nome,
    description: f.descricao,
    // Acesso indexado em vez do tipo aninhado: `input_schema` esta em toda
    // definicao de tool, e assim o nome nao depende de eu lembrar dele.
    input_schema: f.entrada as Anthropic.Tool['input_schema'],
  }));

  const mensagens: Anthropic.MessageParam[] = [{ role: 'user', content: pergunta }];
  const chamadas: Array<{
    ferramenta: string;
    autorizada: boolean;
    linhas: number | null;
    erro?: string;
  }> = [];
  let entrada = 0;
  let saida = 0;
  let texto = '';

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
      const resposta = await anthropic.messages.create({
        model: modelo,
        max_tokens: maxSaida,
        system: SISTEMA,
        thinking: { type: 'adaptive' },
        tools: ferramentas,
        messages: mensagens,
      });

      entrada += resposta.usage.input_tokens;
      saida += resposta.usage.output_tokens;

      texto = resposta.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      if (resposta.stop_reason !== 'tool_use') break;

      mensagens.push({ role: 'assistant', content: resposta.content });

      const pedidos = resposta.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      // Os resultados voltam **todos numa mensagem só**. Separá-los ensina o
      // modelo a parar de pedir ferramentas em paralelo.
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const pedido of pedidos) {
        const conhecida = FERRAMENTAS.some((f) => f.nome === pedido.name);
        const r = conhecida
          ? await rodarFerramenta(comoUsuario, pedido.name, pedido.input as Record<string, unknown>)
          : { linhas: [], erro: 'ferramenta desconhecida' };

        chamadas.push({
          ferramenta: pedido.name,
          autorizada: conhecida && r.erro === undefined,
          linhas: conhecida ? r.linhas.length : null,
          ...(r.erro === undefined ? {} : { erro: r.erro }),
        });

        const permitido = apenasPermitido(pedido.name, r.linhas);
        resultados.push({
          type: 'tool_result',
          tool_use_id: pedido.id,
          is_error: r.erro !== undefined,
          content: r.erro ?? envelopeDeDado(pedido.name, JSON.stringify(permitido)),
        });
      }

      mensagens.push({ role: 'user', content: resultados });
    }

    const runId = await gravar({
      resposta: texto === '' ? null : texto,
      modelo,
      resultado: texto === '' ? 'sem_resposta' : 'respondeu',
      tokens_entrada: entrada,
      tokens_saida: saida,
      custo_estimado_centavos: custoEstimadoCentavos({ entrada, saida }, preco),
      duracao_ms: Date.now() - comecou,
    });

    if (runId !== null && chamadas.length > 0) {
      await comoServico.from('assistant_tool_calls').insert(
        chamadas.map((c) => ({
          run_id: runId,
          ferramenta: c.ferramenta,
          autorizada: c.autorizada,
          linhas: c.linhas,
          erro: c.erro ?? null,
        })),
      );
    }

    return json({ disponivel: true, run_id: runId, resposta: texto === '' ? null : texto });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    const runId = await gravar({
      modelo,
      resultado: 'erro',
      erro: mensagem,
      tokens_entrada: entrada,
      tokens_saida: saida,
      duracao_ms: Date.now() - comecou,
    });
    // "Custos e falhas sao observaveis" (§45): a falha vira linha antes de
    // virar mensagem. O cliente nao le o erro cru do provedor.
    return json(
      {
        disponivel: true,
        run_id: runId,
        resposta: null,
        motivo: 'Não consegui responder agora. A equipe da Fly pode ajudar.',
      },
      200,
    );
  }
});
