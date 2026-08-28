import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { color, geometry, typography, GOLD_ALLOWED_USES } from './index';

/**
 * Estes testes existem para impedir que os tokens escorreguem em relacao ao
 * design. Eles leem o proprio arquivo do Claude Design versionado no repo e
 * conferem que cada valor declarado aqui aparece la.
 *
 * Se um teste destes quebrar, ha duas saidas legitimas: ressincronizar o
 * design (ver docs/design/DESIGN_SOURCE.md) ou registrar a divergencia em um
 * ADR. Editar o token para "passar o teste" nao e uma delas.
 */

function readCanvas(file: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../docs/design/canvas/${file}`, import.meta.url)),
    'utf8',
  );
}

/** O prototipo navegavel — carrega as telas. */
const phone = readCanvas('Fly Phone.dc.html');
/** A pagina de sistema — carrega a documentacao de paleta, tipo e geometria. */
const systemPage = readCanvas('Fly App.dc.html');
/** Alguns tokens so aparecem em um dos dois; a conferencia usa os dois. */
const canvas = `${phone}\n${systemPage}`;

describe('cores derivadas do design', () => {
  it.each([
    ['fundo', color.surface.base],
    ['grafite', color.surface.graphite],
    ['texto primario', color.text.primary],
    ['dourado Fly', color.gold.base],
    ['ambar de alerta', color.status.warning],
  ])('%s (%s) aparece no design', (_nome, hex) => {
    expect(canvas).toContain(hex);
  });

  it.each([
    ['standard', color.flyPackage.standard.dot],
    ['black', color.flyPackage.black.dot],
    ['billionaire', color.flyPackage.billionaire.dot],
  ])('nivel Fly Status %s (%s) aparece no design', (_nivel, hex) => {
    expect(canvas).toContain(hex);
  });
});

describe('regra do dourado', () => {
  it('declara exatamente os sete usos permitidos', () => {
    expect(GOLD_ALLOWED_USES).toHaveLength(7);
  });

  // A aba selecionada era dourada no codigo e nunca esteve na lista. O handoff
  // de 28/08 fecha a questao: ativa e `#F5F5F7`. Este teste existe para o
  // dourado nao voltar para a barra por descuido.
  it('nao inclui rotulo nem icone de aba', () => {
    expect(GOLD_ALLOWED_USES).not.toContain('active-tab');
    expect(geometry.bottomBar.labelActive).toBe('#F5F5F7');
    expect(geometry.bottomBar.labelInactive).toBe('rgba(245,245,247,.4)');
  });

  it('nao permite duplicatas na lista de usos', () => {
    expect(new Set(GOLD_ALLOWED_USES).size).toBe(GOLD_ALLOWED_USES.length);
  });
});

describe('geometria', () => {
  it('mantem os raios entre 16 e 34 px, como manda o design', () => {
    for (const value of Object.values(geometry.radius)) {
      expect(value).toBeGreaterThanOrEqual(16);
      expect(value).toBeLessThanOrEqual(34);
    }
  });

  it('ordena os raios do maior recipiente para o menor', () => {
    const { sheet, card, block, chip } = geometry.radius;
    expect(sheet).toBeGreaterThan(card);
    expect(card).toBeGreaterThan(block);
    expect(block).toBeGreaterThan(chip);
  });

  it('calcula raio concentrico descontando o inset', () => {
    expect(geometry.concentricRadius(geometry.radius.card, 12)).toBe(18);
  });

  it('nunca devolve raio negativo', () => {
    expect(geometry.concentricRadius(10, 40)).toBe(0);
  });

  it('respeita o alvo de toque minimo de 44 px', () => {
    expect(geometry.touchTarget.min).toBeGreaterThanOrEqual(44);
  });

  it('mantem o botao central na faixa de 68 a 76 dp da spec §4.1', () => {
    expect(geometry.touchTarget.centralButtonMin).toBe(68);
    expect(geometry.touchTarget.centralButtonMax).toBe(76);
    expect(geometry.touchTarget.centralButtonMin).toBeGreaterThan(geometry.touchTarget.min);
  });

  it('a area visual do botao central cai dentro da faixa da spec', () => {
    // 62 de nucleo + 6 de anel em cada lado = 74.
    expect(geometry.centralButtonVisualSize).toBe(74);
    expect(geometry.centralButtonVisualSize).toBeGreaterThanOrEqual(
      geometry.touchTarget.centralButtonMin,
    );
    expect(geometry.centralButtonVisualSize).toBeLessThanOrEqual(
      geometry.touchTarget.centralButtonMax,
    );
  });

  it('o nucleo tocavel do botao central supera o alvo minimo de 44', () => {
    expect(geometry.centralButton.core).toBeGreaterThanOrEqual(geometry.touchTarget.min);
  });

  it('usa as medidas de barra e botao central do prototipo', () => {
    expect(phone).toContain('height:86px');
    expect(phone).toContain('width:62px;height:62px');
    expect(phone).toContain('top:-30px');
  });

  it('usa o aparelho de referencia do prototipo', () => {
    expect(geometry.referenceDevice.width).toBe(393);
    expect(geometry.referenceDevice.height).toBe(852);
    expect(phone).toContain('width:393px;height:852px');
  });
});

describe('tipografia', () => {
  it('aperta o tracking dos titulos e abre o das captions', () => {
    expect(typography.textStyle.largeTitle.letterSpacing).toBeLessThan(0);
    expect(typography.textStyle.section.letterSpacing).toBeLessThan(0);
    expect(typography.textStyle.caption.letterSpacing).toBeGreaterThan(0);
  });

  it('desce de tamanho do titulo ate a caption', () => {
    const { largeTitle, section, body, caption } = typography.textStyle;
    expect(largeTitle.fontSize).toBeGreaterThan(section.fontSize);
    expect(section.fontSize).toBeGreaterThan(body.fontSize);
    expect(body.fontSize).toBeGreaterThan(caption.fontSize);
  });

  it('separa rotulo de aba de kicker — sao degraus diferentes', () => {
    const { tabLabel, caption } = typography.textStyle;
    // Mesmo corpo...
    expect(tabLabel.fontSize).toBe(caption.fontSize);
    // ...mas o rotulo de aba nao tem tracking e e mais leve.
    expect(tabLabel.letterSpacing).toBe(0);
    expect(caption.letterSpacing).toBeGreaterThan(0);
    expect(Number(tabLabel.fontWeight)).toBeLessThan(Number(caption.fontWeight));
  });

  it('o rotulo de aba bate com o do design: 9.5px, peso 600, sem tracking', () => {
    expect(phone).toContain('font-size:9.5px;font-weight:600');
    expect(typography.textStyle.tabLabel.fontSize).toBe(9.5);
    expect(typography.textStyle.tabLabel.fontWeight).toBe('600');
  });

  it('usa a mesma pilha de fontes do design', () => {
    expect(canvas).toContain("'SF Pro Display'");
    expect(typography.fontFamily).toContain("'SF Pro Display'");
  });
});
