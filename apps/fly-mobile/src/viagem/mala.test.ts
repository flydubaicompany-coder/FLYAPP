import { describe, expect, it } from 'vitest';
import { chaveDoItem, itensDoTexto, montarMala, progresso } from './mala';

describe('chaveDoItem', () => {
  it('junta o que é o mesmo item escrito diferente', () => {
    expect(chaveDoItem('Protetor Solar')).toBe(chaveDoItem('protetor  solar '));
    expect(chaveDoItem('Óculos')).toBe('oculos');
  });
});

describe('itensDoTexto', () => {
  it('separa por vírgula, ponto e vírgula e quebra de linha', () => {
    expect(itensDoTexto('Protetor solar, chapéu; água\ntênis')).toEqual([
      'Protetor solar',
      'chapéu',
      'água',
      'tênis',
    ]);
  });

  // " e " não separa: "camisa e calça de linho" viraria dois itens errados.
  it('não quebra no "e"', () => {
    expect(itensDoTexto('Camisa e calça de linho')).toEqual(['Camisa e calça de linho']);
  });

  it('texto vazio não vira item', () => {
    expect(itensDoTexto(null)).toEqual([]);
    expect(itensDoTexto('  ,  ; ')).toEqual([]);
  });
});

describe('montarMala', () => {
  const atividades = [
    { titulo: 'Deserto', oQueLevar: 'Protetor solar, chapéu', trajeSugerido: 'Tênis fechado' },
    { titulo: 'Jantar', oQueLevar: null, trajeSugerido: 'Traje social' },
  ];

  it('junta roteiro, curados e próprios', () => {
    const mala = montarMala(
      atividades,
      ['Passaporte'],
      [{ item: 'Carregador', marcado: false, proprio: true }],
    );
    expect(mala.map((i) => i.rotulo).sort()).toEqual([
      'Carregador',
      'Passaporte',
      'Protetor solar',
      'Traje social',
      'Tênis fechado',
      'chapéu',
    ]);
  });

  // Sem isto, "passaporte" apareceria três vezes — uma por fonte.
  it('item repetido entre fontes aparece uma vez, com a fonte mais forte', () => {
    const mala = montarMala(
      [{ titulo: 'Voo', oQueLevar: 'Passaporte', trajeSugerido: null }],
      ['passaporte'],
      [{ item: 'PASSAPORTE', marcado: true, proprio: true }],
    );
    expect(mala).toHaveLength(1);
    expect(mala[0]?.fonte).toBe('proprio');
    // O rótulo mantém a primeira grafia vista, e não a última.
    expect(mala[0]?.rotulo).toBe('Passaporte');
  });

  it('leva a marcação para o item certo, mesmo escrito diferente', () => {
    const mala = montarMala(
      atividades,
      [],
      [{ item: 'protetor  solar', marcado: true, proprio: false }],
    );
    expect(mala.find((i) => i.rotulo === 'Protetor solar')?.marcado).toBe(true);
    expect(mala.find((i) => i.rotulo === 'chapéu')?.marcado).toBe(false);
  });

  it('diz de qual atividade o item veio', () => {
    const mala = montarMala(atividades, [], []);
    expect(mala.find((i) => i.rotulo === 'chapéu')?.de).toBe('Deserto');
  });

  it('sem roteiro e sem curadoria, a mala é vazia', () => {
    expect(montarMala([], [], [])).toEqual([]);
  });
});

describe('progresso', () => {
  it('conta o que já foi separado', () => {
    const mala = montarMala(
      [{ titulo: 'Voo', oQueLevar: 'Passaporte, fone', trajeSugerido: null }],
      [],
      [{ item: 'passaporte', marcado: true, proprio: false }],
    );
    expect(progresso(mala)).toEqual({ feitos: 1, total: 2 });
  });
});
