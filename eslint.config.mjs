// Configuracao unica do monorepo (ESLint 9 flat config).
// Regra do projeto: TypeScript estrito em todo lugar; nada de `any` silencioso.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      'docs/design/canvas/**',
      'docs/design/extracao/**', // fragmentos do prototipo, extraidos para consulta // artefatos do Claude Design — nao sao codigo do app
      'design_handoff_fly_app/**', // handoff do Claude Design: `support.js` e o runtime do prototipo, nao do produto
      // Skills instaladas por `npx skills add` e `npx impeccable install`.
      // Sao ferramenta de terceiro, versionada para o time inteiro ter a
      // mesma, mas nao e codigo deste projeto: o estilo e de quem publica.
      '.claude/skills/**',
      '.agents/**',
      '.codex/**',
      '.github/skills/**',
      '.github/hooks/**',
      '.github/agents/**',
      // Gerado por `npm run db:types`: o gerador decide o estilo, nao o linter.
      'packages/domain-types/src/database.types.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  // Scripts do repositorio rodam no Node, fora do app: `console` e `process`
  // sao a interface deles, e um script de verificacao que nao pode escrever no
  // terminal nem sair com codigo de erro nao serve para nada.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
);
