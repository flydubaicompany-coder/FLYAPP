#!/usr/bin/env node
/**
 * Procura UUIDs inválidos nos arquivos SQL.
 *
 * Existe porque o mesmo erro passou duas vezes: `doc10000-…` e `pa000000-…`
 * *parecem* UUID — têm o formato 8-4-4-4-12 — mas `o` e `p` não são
 * hexadecimais. O Postgres só reclama na hora do insert, e num arquivo pgTAP
 * isso derruba a suíte inteira com "Bad plan", longe da linha culpada.
 *
 * Escrever UUID de teste à mão é prático e vai continuar; o que não pode
 * continuar é descobrir o erro de digitação na esteira, três minutos depois.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const FORMATO = /'([0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12})'/g;
const HEXA = /^[0-9a-fA-F-]+$/;

const arquivos = globSync('supabase/**/*.sql');
const problemas = [];

for (const arquivo of arquivos) {
  const linhas = readFileSync(arquivo, 'utf8').split('\n');
  linhas.forEach((linha, i) => {
    for (const m of linha.matchAll(FORMATO)) {
      if (!HEXA.test(m[1])) {
        const fora = [...new Set([...m[1]].filter((c) => !/[0-9a-fA-F-]/.test(c)))];
        problemas.push({ arquivo, linha: i + 1, valor: m[1], fora: fora.join(', ') });
      }
    }
  });
}

if (problemas.length === 0) {
  console.log(`UUIDs conferidos em ${arquivos.length} arquivos SQL: nenhum inválido.`);
  process.exit(0);
}

console.error('UUID com caractere não-hexadecimal:\n');
for (const p of problemas) {
  console.error(`  ${p.arquivo}:${p.linha}`);
  console.error(`    ${p.valor}  →  fora do hexadecimal: ${p.fora}\n`);
}
console.error('Hexadecimal vai de 0 a 9 e de a a f. Troque as letras de fora.');
process.exit(1);
