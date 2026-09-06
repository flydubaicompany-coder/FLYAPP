import { describe, expect, it } from 'vitest';
import {
  ASSUNTOS,
  linkDeWhatsapp,
  mensagemDeExperiencia,
  mensagemDeSuporte,
  normalizarTelefone,
} from './whatsapp';

describe('normalizarTelefone', () => {
  it('tira tudo que nao e digito — o wa.me recusa o resto', () => {
    expect(normalizarTelefone('+55 21 98323-8650')).toBe('5521983238650');
  });

  it('recusa o que nao parece telefone', () => {
    expect(normalizarTelefone('PENDENTE')).toBeNull();
    expect(normalizarTelefone('123')).toBeNull();
    expect(normalizarTelefone('')).toBeNull();
    expect(normalizarTelefone(null)).toBeNull();
  });

  it('recusa numero longo demais para E.164', () => {
    expect(normalizarTelefone('1234567890123456')).toBeNull();
  });
});

describe('mensagemDeSuporte', () => {
  it('carrega nome, viagem, assunto e atividade', () => {
    const m = mensagemDeSuporte('perdido', {
      nome: 'Marina',
      viagem: 'viagem Dubai Setembro 2026',
      atividade: 'Desert Safari',
      local: 'Lobby do hotel',
    });
    expect(m).toContain('Sou Marina.');
    expect(m).toContain('viagem Dubai Setembro 2026');
    expect(m).toContain('Estou perdido');
    expect(m).toContain('Desert Safari — Lobby do hotel');
  });

  /**
   * O caso que motiva a funcao: campo vazio nao entra.
   *
   * "Atividade atual: —" ocupa uma linha e nao diz nada. Quem atende le a
   * mensagem no celular, em pe, e cada linha inutil custa uma rolada.
   */
  it('omite o que nao se sabe, em vez de escrever um traco', () => {
    const m = mensagemDeSuporte('duvida', { nome: null, viagem: null });
    expect(m).not.toContain('—');
    expect(m).not.toContain('Atividade');
    expect(m).toContain('Sou participante da viagem.');
  });

  it('todo assunto da lista produz um rotulo legivel', () => {
    for (const a of ASSUNTOS) {
      expect(mensagemDeSuporte(a.chave, { nome: 'X', viagem: null })).toContain(a.rotulo);
    }
  });
});

describe('mensagemDeExperiencia', () => {
  it('e curta: e venda, nao chamado', () => {
    const m = mensagemDeExperiencia('Balão no deserto', { nome: 'Marina', viagem: null });
    expect(m.split('\n')).toHaveLength(2);
    expect(m).toContain('Balão no deserto');
  });
});

describe('linkDeWhatsapp', () => {
  it('monta wa.me com a mensagem codificada', () => {
    const url = linkDeWhatsapp('+55 21 98323-8650', 'Olá, equipe Fly.');
    expect(url).toBe('https://wa.me/5521983238650?text=Ol%C3%A1%2C%20equipe%20Fly.');
  });

  /**
   * Sem numero, sem link.
   *
   * A alternativa seria abrir `wa.me/?text=...` — que abre o WhatsApp sem
   * destinatario e faz o cliente achar que mandou.
   */
  it('devolve null quando o canal nao esta configurado', () => {
    expect(linkDeWhatsapp(null, 'oi')).toBeNull();
    expect(linkDeWhatsapp('PENDENTE', 'oi')).toBeNull();
  });

  it('quebra de linha sobrevive a codificacao', () => {
    const url = linkDeWhatsapp('5521983238650', 'linha um\nlinha dois');
    expect(url).toContain('linha%20um%0Alinha%20dois');
  });
});
