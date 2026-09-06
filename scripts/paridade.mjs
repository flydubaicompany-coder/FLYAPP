#!/usr/bin/env node
/**
 * Cruza os nomes de schema tocados pelo app com os tocados pelos painéis.
 *
 * A entrega 1 da Fase 11 (§46) é a auditoria de paridade App ↔ Ops ↔ Crew.
 * Feita à mão, ela envelhece na semana seguinte: alguém acrescenta uma tabela
 * no app e a lacuna nasce sem ninguém notar. Este script não decide nada — ele
 * diz **onde olhar**, e o julgamento fica em `docs/quality/PARIDADE.md`.
 *
 * O inventário vem de `database.types.ts`, e não de uma lista escrita aqui:
 * uma lista escrita aqui seria a segunda verdade que o projeto inteiro evita.
 *
 * A busca é por palavra solta, e não por `.from('x')`. Metade das consultas do
 * projeto embute relação dentro do texto do `select` — `support_cases(...)`,
 * `meal_options(id, label)` — e um casamento por `.from(` daria lacuna falsa
 * em coisas que já estão operáveis.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TIPOS = 'packages/domain-types/src/database.types.ts';

/** Nomes de tabela, view e função do schema `public`. */
function inventario() {
  const linhas = readFileSync(TIPOS, 'utf8').split('\n');
  const nomes = new Set();
  let dentro = false;
  for (const linha of linhas) {
    if (/^ {4}(Tables|Views|Functions): \{$/.test(linha)) dentro = true;
    else if (/^ {4}(Enums|CompositeTypes): \{$/.test(linha)) dentro = false;
    const m = dentro && linha.match(/^ {6}([a-z_]+): \{$/);
    if (m) nomes.add(m[1]);
  }
  nomes.delete('graphql');
  return nomes;
}

function fontes(raiz) {
  const saida = [];
  for (const nome of readdirSync(raiz)) {
    const caminho = join(raiz, nome);
    if (statSync(caminho).isDirectory()) saida.push(...fontes(caminho));
    else if (/\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

function tocados(raiz, conhecidos) {
  const achados = new Set();
  for (const arquivo of fontes(raiz)) {
    for (const palavra of readFileSync(arquivo, 'utf8').match(/[a-z_]{3,}/g) ?? []) {
      if (conhecidos.has(palavra)) achados.add(palavra);
    }
  }
  return achados;
}

const conhecidos = inventario();
const app = tocados('apps/fly-mobile/src', conhecidos);
const ops = tocados('apps/fly-ops/src', conhecidos);
const crew = tocados('apps/fly-crew/src', conhecidos);

const soNoApp = [...app].filter((n) => !ops.has(n) && !crew.has(n)).sort();
const orfas = [...conhecidos].filter((n) => !app.has(n) && !ops.has(n) && !crew.has(n)).sort();

console.log(`Inventário: ${conhecidos.size} nomes em ${TIPOS}`);
console.log(`App ${app.size} · Ops ${ops.size} · Crew ${crew.size}\n`);
console.log(`Só no app (${soNoApp.length}) — candidatos a lacuna de operação:`);
console.log(soNoApp.map((n) => `  ${n}`).join('\n') || '  nenhum');
console.log(`\nSem leitor nenhum (${orfas.length}):`);
console.log(orfas.map((n) => `  ${n}`).join('\n') || '  nenhum');
console.log('\nJulgamento item a item: docs/quality/PARIDADE.md');
