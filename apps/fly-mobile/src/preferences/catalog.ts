/**
 * Catálogo de preferências (§9.4).
 *
 * A lista de campos vem literalmente da especificação. Ela vive aqui, e não no
 * componente, para que a tela seja só desenho: acrescentar uma pergunta não
 * deveria exigir mexer em layout.
 *
 * `isSensitive` não é rótulo decorativo. Ele vai para
 * `preference_items.is_sensitive`, e é o que faz a RLS esconder o campo da
 * equipe enquanto não houver consentimento vigente para `health_data`.
 */

export interface PreferenceGroup {
  key: string;
  label: string;
  note?: string;
}

export const PREFERENCE_GROUPS: readonly PreferenceGroup[] = [
  { key: 'sobre', label: 'Sobre você' },
  { key: 'tamanhos', label: 'Tamanhos', note: 'Para presentes, uniformes e press kit.' },
  { key: 'gosto', label: 'Gostos' },
  {
    key: 'saude',
    label: 'Saúde e restrições',
    note: 'Dado sensível. Só chega à equipe da sua viagem se você autorizar em Privacidade — e some no instante em que revogar.',
  },
  { key: 'ocasioes', label: 'Ocasiões especiais' },
];

export interface PreferenceField {
  key: string;
  group: string;
  label: string;
  placeholder: string;
  hint?: string;
  isSensitive: boolean;
}

export const PREFERENCE_FIELDS: readonly PreferenceField[] = [
  {
    key: 'sobre.como_chamar',
    group: 'sobre',
    label: 'Como gosta de ser chamado',
    placeholder: 'Apelido ou primeiro nome',
    isSensitive: false,
  },
  {
    key: 'sobre.idioma',
    group: 'sobre',
    label: 'Idioma preferido',
    placeholder: 'Português',
    isSensitive: false,
  },
  {
    key: 'sobre.comunicacao',
    group: 'sobre',
    label: 'Como prefere falar com a Fly',
    placeholder: 'App, WhatsApp, ligação…',
    isSensitive: false,
  },

  {
    key: 'tamanho.camisa',
    group: 'tamanhos',
    label: 'Camisa',
    placeholder: 'P, M, G, GG…',
    isSensitive: false,
  },
  {
    key: 'tamanho.calcado',
    group: 'tamanhos',
    label: 'Calçado',
    placeholder: '42',
    isSensitive: false,
  },

  {
    key: 'gosto.snacks',
    group: 'gosto',
    label: 'Snacks, doces e bebidas',
    placeholder: 'Chocolate amargo, água com gás…',
    hint: 'É o que aparece no quarto quando você chega cansado',
    isSensitive: false,
  },
  {
    key: 'gosto.comidas_favoritas',
    group: 'gosto',
    label: 'Comidas favoritas',
    placeholder: 'Massa, frutos do mar…',
    isSensitive: false,
  },
  {
    key: 'gosto.comidas_recusadas',
    group: 'gosto',
    label: 'Comidas que não gosta',
    placeholder: 'Coentro, pimenta…',
    isSensitive: false,
  },
  {
    key: 'gosto.musica',
    group: 'gosto',
    label: 'Artistas e estilos',
    placeholder: 'Quem você ouviria numa viagem de carro',
    isSensitive: false,
  },
  {
    key: 'gosto.hobbies',
    group: 'gosto',
    label: 'Hobbies',
    placeholder: 'Surf, fotografia, corrida…',
    isSensitive: false,
  },
  {
    key: 'gosto.time',
    group: 'gosto',
    label: 'Time',
    placeholder: 'Seu time do coração',
    isSensitive: false,
  },
  {
    key: 'gosto.marcas',
    group: 'gosto',
    label: 'Marcas e estilo',
    placeholder: 'O que você usaria',
    isSensitive: false,
  },

  {
    key: 'saude.alergias',
    group: 'saude',
    label: 'Alergias',
    placeholder: 'Amendoim, frutos do mar, látex…',
    hint: 'A equipe usa para escolher restaurante e preparar o que for preciso',
    isSensitive: true,
  },
  {
    key: 'saude.restricoes',
    group: 'saude',
    label: 'Restrições alimentares',
    placeholder: 'Vegetariano, sem glúten, halal…',
    isSensitive: true,
  },
  {
    key: 'saude.condicoes',
    group: 'saude',
    label: 'Condições que a equipe deve saber',
    placeholder: 'Opcional',
    hint: 'Só compartilhe o que ajudar a cuidar de você',
    isSensitive: true,
  },

  {
    key: 'ocasiao.datas',
    group: 'ocasioes',
    label: 'Datas especiais',
    placeholder: 'Aniversário, bodas…',
    isSensitive: false,
  },
  {
    key: 'ocasiao.comemorando',
    group: 'ocasioes',
    label: 'Está comemorando algo?',
    placeholder: 'Uma conquista, uma virada',
    isSensitive: false,
  },
];

/** Quantos campos sensíveis existem. Usado em teste e no painel. */
export const SENSITIVE_FIELD_KEYS = PREFERENCE_FIELDS.filter((f) => f.isSensitive).map(
  (f) => f.key,
);
