import { describe, expect, it, vi } from 'vitest';
import {
  escolherProvedor,
  ProvedorDesligado,
  ProvedorSandbox,
  TOKENS_SANDBOX,
  type IntencaoDePagamento,
} from './index';

/**
 * O que estes testes protegem, em ordem de gravidade:
 *
 * 1. **Nenhum caminho de erro devolve "pagou".** Timeout, rede caída, resposta
 *    estranha e provedor desconhecido têm que virar `indisponivel` — nunca
 *    `pendente`. Um adapter que erra para o lado do sucesso confirma pedido
 *    que ninguém cobrou.
 * 2. **Configuração ausente ou errada cai no desligado, não no sandbox.** Um
 *    typo em `app_config` não pode virar cobrança de mentira em produção.
 * 3. **O instrumento não vaza no log.**
 */

const INTENCAO: IntencaoDePagamento = {
  pedidoId: '11111111-2222-3333-4444-555555555555',
  totalCentavos: 51_000,
  moeda: 'BRL',
  instrumento: TOKENS_SANDBOX.aprovar,
};

function sandbox(resposta: () => Promise<Response>, timeoutMs?: number) {
  return new ProvedorSandbox({
    endpoint: 'https://exemplo.invalid/functions/v1/pagamento-sandbox',
    token: 'jwt-de-teste',
    apiKey: 'chave-publicavel-de-teste',
    fetchImpl: resposta as unknown as typeof fetch,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

function json(corpo: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('adapter do sandbox', () => {
  it('devolve pendente com a referencia quando o provedor aceita', async () => {
    const provedor = sandbox(() => json({ status: 'pendente', referencia: 'sbx_abc' }));

    await expect(provedor.autorizar(INTENCAO)).resolves.toEqual({
      status: 'pendente',
      referencia: 'sbx_abc',
    });
  });

  it('nao promete aprovacao: o desfecho vem do webhook, nao daqui', async () => {
    const provedor = sandbox(() => json({ status: 'pendente', referencia: 'sbx_abc' }));
    const r = await provedor.autorizar(INTENCAO);

    // O tipo `Autorizacao` nao tem `aprovado`. Este teste existe para o dia em
    // que alguem tentar acrescentar um.
    expect(Object.keys(r)).toEqual(['status', 'referencia']);
  });

  it('trata recusa como recusa, mesmo vindo com codigo de erro', async () => {
    const provedor = sandbox(() => json({ status: 'recusado', motivo: 'pedido ja pago' }, 409));

    await expect(provedor.autorizar(INTENCAO)).resolves.toEqual({
      status: 'recusado',
      motivo: 'pedido ja pago',
    });
  });

  it('erro do provedor vira indisponivel, e nunca pendente', async () => {
    const provedor = sandbox(() => json({ motivo: 'sandbox nao configurado' }, 503));
    const r = await provedor.autorizar(INTENCAO);

    expect(r.status).toBe('indisponivel');
  });

  it('rede caida vira indisponivel', async () => {
    const provedor = sandbox(() => Promise.reject(new TypeError('failed to fetch')));
    const r = await provedor.autorizar(INTENCAO);

    expect(r.status).toBe('indisponivel');
  });

  it('resposta 200 que nao e nem pendente nem recusada nao vira sucesso', async () => {
    // O caso real: um proxy devolvendo HTML de erro com status 200.
    const provedor = sandbox(() => json({ mensagem: 'ok' }));
    const r = await provedor.autorizar(INTENCAO);

    expect(r.status).toBe('indisponivel');
  });

  it('corpo que nao e JSON tambem nao vira sucesso', async () => {
    const provedor = sandbox(() =>
      Promise.resolve(new Response('<html>gateway</html>', { status: 200 })),
    );
    const r = await provedor.autorizar(INTENCAO);

    expect(r.status).toBe('indisponivel');
  });

  it('timeout aborta a requisicao em vez de deixa-la correndo', async () => {
    let sinal: AbortSignal | undefined;

    const provedor = sandbox(
      ((_url: string, init: RequestInit) => {
        sinal = init.signal ?? undefined;
        // Um provedor que pendurou. O fake precisa rejeitar no abort porque e
        // assim que o `fetch` de verdade se comporta — um fake que ignora o
        // sinal provaria que o teste trava, nao que o adapter desiste.
        return new Promise<Response>((_resolver, rejeitar) => {
          sinal?.addEventListener('abort', () => rejeitar(sinal?.reason));
        });
      }) as unknown as () => Promise<Response>,
      20,
    );

    const r = await provedor.autorizar(INTENCAO);

    expect(r.status).toBe('indisponivel');
    // O ponto do teste: a requisicao foi cancelada. Sem isso, uma resposta
    // atrasada continuaria viva e poderia cobrar depois de a tela desistir.
    expect(sinal?.aborted).toBe(true);
    // E a pessoa le "demorou demais", nao "sem rede" — sao problemas
    // diferentes, e a acao seguinte tambem e.
    expect(r).toMatchObject({ motivo: 'o provedor demorou demais' });
  });

  it('nao manda o instrumento para o log', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provedor = sandbox(() => Promise.reject(new TypeError('failed to fetch')));

    await provedor.autorizar(INTENCAO);

    const escrito = erro.mock.calls.flat().map(String).join(' ');
    expect(escrito).not.toContain(TOKENS_SANDBOX.aprovar);
    erro.mockRestore();
  });

  it('envia o instrumento tokenizado, e nenhum dado de cartao', async () => {
    let corpo = '';
    const provedor = sandbox(((_url: string, init: RequestInit) => {
      corpo = String(init.body);
      return json({ status: 'pendente', referencia: 'sbx_abc' });
    }) as unknown as () => Promise<Response>);

    await provedor.autorizar(INTENCAO);

    const enviado = JSON.parse(corpo) as Record<string, unknown>;
    expect(enviado.instrumento).toBe(TOKENS_SANDBOX.aprovar);
    expect(Object.keys(enviado)).toEqual(['pedido', 'total_cents', 'currency', 'instrumento']);
  });
});

describe('provedor desligado', () => {
  it('e indisponivel, para a tela cair no atendimento humano', async () => {
    await expect(new ProvedorDesligado().autorizar()).resolves.toMatchObject({
      status: 'indisponivel',
    });
  });
});

describe('escolha do provedor', () => {
  const sandboxOpcoes = {
    endpoint: 'https://exemplo.invalid',
    token: 't',
    apiKey: 'k',
  };

  it('flag desligada ignora o provedor configurado', () => {
    const p = escolherProvedor({
      checkoutLigado: false,
      provedor: 'sandbox',
      sandbox: sandboxOpcoes,
    });

    expect(p.nome).toBe('desligado');
  });

  it('PENDENTE cai no desligado', () => {
    const p = escolherProvedor({
      checkoutLigado: true,
      provedor: 'PENDENTE',
      sandbox: sandboxOpcoes,
    });

    expect(p.nome).toBe('desligado');
  });

  it('configuracao ausente cai no desligado', () => {
    const p = escolherProvedor({ checkoutLigado: true, provedor: null, sandbox: sandboxOpcoes });

    expect(p.nome).toBe('desligado');
  });

  it('nome desconhecido cai no desligado, e nao no sandbox', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const p = escolherProvedor({
      checkoutLigado: true,
      provedor: 'sandbx',
      sandbox: sandboxOpcoes,
    });

    expect(p.nome).toBe('desligado');
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('sandbox ligado nao se apresenta como producao', () => {
    const p = escolherProvedor({
      checkoutLigado: true,
      provedor: 'sandbox',
      sandbox: sandboxOpcoes,
    });

    expect(p.nome).toBe('sandbox');
    expect(p.ehProducao).toBe(false);
  });
});
