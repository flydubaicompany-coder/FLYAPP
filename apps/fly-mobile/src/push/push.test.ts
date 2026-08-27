import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumirPendente,
  decidir,
  guardarPendente,
  limparPendente,
  rotaValida,
  temPendente,
} from './destino';
import { devePedir, textoDoPedido } from './permissao';

/**
 * O critério da §38 que estes testes existem para provar:
 *
 *   "notificação abre contexto ou pede login e retorna ao contexto"
 *
 * A segunda metade é a que se quebra em silêncio. Um app que manda para o
 * login e esquece o destino passa em qualquer teste manual feito por quem já
 * está logado.
 */

describe('validacao de deep link', () => {
  it('aceita rota interna conhecida', () => {
    expect(rotaValida('/eventos/fly-summit')).toBe('/eventos/fly-summit');
    expect(rotaValida('/viagem')).toBe('/viagem');
    expect(rotaValida('/')).toBe('/');
  });

  it('aceita rota com query', () => {
    expect(rotaValida('/eventos?categoria=fly-cup')).toBe('/eventos?categoria=fly-cup');
  });

  it('recusa url absoluta', () => {
    // Uma notificação vem de fora. Sem esta recusa, um push forjado
    // redireciona para fora do app.
    expect(rotaValida('https://exemplo.com/phishing')).toBeNull();
    expect(rotaValida('flycup://evento/1')).toBeNull();
  });

  it('recusa caminho protocolo-relativo', () => {
    expect(rotaValida('//exemplo.com')).toBeNull();
  });

  it('recusa rota que o app nao tem', () => {
    expect(rotaValida('/admin')).toBeNull();
    expect(rotaValida('/perfilzinho')).toBeNull();
  });

  it('recusa vazio e nulo', () => {
    expect(rotaValida(null)).toBeNull();
    expect(rotaValida('')).toBeNull();
    expect(rotaValida('eventos')).toBeNull();
  });
});

describe('decisao ao tocar num aviso', () => {
  const aviso = {
    id: 'n1',
    deepLink: '/eventos/legends-dubai-cup',
    categoria: 'events',
    critica: false,
  };

  it('logado vai direto ao contexto', () => {
    expect(decidir(aviso, true)).toEqual({
      acao: 'navegar',
      rota: '/eventos/legends-dubai-cup',
    });
  });

  it('deslogado pede login guardando o contexto', () => {
    expect(decidir(aviso, false)).toEqual({
      acao: 'pedirLogin',
      retomar: '/eventos/legends-dubai-cup',
    });
  });

  it('sem deep link abre a central, nao a Home', () => {
    expect(decidir({ ...aviso, deepLink: null }, true)).toEqual({ acao: 'abrirCentral' });
  });

  it('deep link invalido cai na central mesmo deslogado', () => {
    // Não pode virar `pedirLogin` com destino inválido: o login terminaria
    // navegando para lugar nenhum.
    expect(decidir({ ...aviso, deepLink: 'https://mal.com' }, false)).toEqual({
      acao: 'abrirCentral',
    });
  });
});

describe('contexto pendente entre o toque e o login', () => {
  beforeEach(() => limparPendente());

  it('guarda e devolve o destino', () => {
    guardarPendente('/viagem');
    expect(temPendente()).toBe(true);
    expect(consumirPendente()).toBe('/viagem');
  });

  it('consome uma vez so', () => {
    guardarPendente('/carteira');
    expect(consumirPendente()).toBe('/carteira');
    expect(consumirPendente()).toBeNull();
    expect(temPendente()).toBe(false);
  });

  it('nao guarda destino invalido', () => {
    guardarPendente('https://exemplo.com');
    expect(temPendente()).toBe(false);
  });

  it('logout limpa o destino da sessao anterior', () => {
    guardarPendente('/perfil/dados');
    limparPendente();
    expect(consumirPendente()).toBeNull();
  });

  it('o ciclo completo do criterio da §38', () => {
    const a = { id: 'n2', deepLink: '/viagem', categoria: 'operational', critica: true };

    const d = decidir(a, false);
    expect(d.acao).toBe('pedirLogin');
    if (d.acao === 'pedirLogin') guardarPendente(d.retomar);

    // ... a pessoa entra ...
    expect(consumirPendente()).toBe('/viagem');
  });
});

describe('quando pedir permissao', () => {
  const base = {
    permissao: 'indeterminado' as const,
    temViagem: false,
    viuCentral: false,
    vezesPerguntado: 0,
  };

  it('nao pede na primeira abertura, sem contexto', () => {
    expect(devePedir(base)).toEqual({ pedir: false, motivo: 'sem_contexto' });
  });

  it('pede quando ha viagem', () => {
    expect(devePedir({ ...base, temViagem: true })).toEqual({ pedir: true, motivo: 'viagem' });
  });

  it('pede quando a pessoa abriu a central', () => {
    expect(devePedir({ ...base, viuCentral: true })).toEqual({ pedir: true, motivo: 'central' });
  });

  it('viagem tem prioridade sobre central', () => {
    expect(devePedir({ ...base, temViagem: true, viuCentral: true }).motivo).toBe('viagem');
  });

  it('nao repergunta depois de concedida', () => {
    expect(devePedir({ ...base, permissao: 'concedida', temViagem: true })).toEqual({
      pedir: false,
      motivo: 'ja_respondeu',
    });
  });

  it('nao insiste depois de negada', () => {
    expect(devePedir({ ...base, permissao: 'negada', temViagem: true })).toEqual({
      pedir: false,
      motivo: 'ja_respondeu',
    });
  });

  it('nao pergunta duas vezes na mesma instalacao', () => {
    expect(devePedir({ ...base, temViagem: true, vezesPerguntado: 1 })).toEqual({
      pedir: false,
      motivo: 'ja_perguntou',
    });
  });

  it('o texto do pedido fala do que vai chegar', () => {
    expect(textoDoPedido('viagem')).toContain('roteiro');
    expect(textoDoPedido('central')).toContain('avisos');
  });
});
