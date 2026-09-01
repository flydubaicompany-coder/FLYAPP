/**
 * O hub de Minha Viagem (§7.2).
 *
 * A §7.2 lista dezesseis destinos. Nem todos existem na Fase 4 — e é
 * justamente por isso que a lista vive aqui, e não espalhada em JSX: o que
 * ainda não abriu aparece marcado com a fase em que abre, em vez de sumir.
 *
 * Um hub que esconde o que não está pronto ensina o cliente a não procurar.
 */

export interface ItemDoHub {
  chave: string;
  rotulo: string;
  descricao: string;
  /** Rota interna, quando a tela existe. */
  rota: string | null;
  /** Fase em que entra, quando ainda não existe. */
  fase: number | null;
  ref: string;
}

export const HUB: readonly ItemDoHub[] = [
  {
    chave: 'roteiro',
    rotulo: 'Roteiro',
    descricao: 'Dia a dia, com horário, ponto de encontro e o que levar.',
    rota: '/viagem/roteiro',
    fase: null,
    ref: '§7.3',
  },
  {
    chave: 'incluso',
    rotulo: 'Tudo que está incluso',
    descricao: 'O que já está pago, o que é opcional e as regras de cada item.',
    rota: '/viagem/incluso',
    fase: null,
    ref: '§7.4',
  },
  {
    chave: 'voos',
    rotulo: 'Voos',
    descricao: 'Horários, terminal, bagagem e quando sair do hotel.',
    rota: '/viagem/voos',
    fase: null,
    ref: '§7.5',
  },
  {
    chave: 'hotel',
    rotulo: 'Hotel e transfers',
    descricao: 'Endereço, política, quarto e o transfer de cada saída.',
    rota: '/viagem/hotel',
    fase: null,
    ref: '§7.6',
  },
  {
    chave: 'passaporte',
    rotulo: 'Passaporte',
    descricao: 'Os dados que a Fly usa para emitir suas passagens.',
    rota: '/perfil/passaporte',
    fase: null,
    ref: '§7.5',
  },
  {
    chave: 'cofre',
    rotulo: 'Documentos',
    descricao: 'Vouchers, autorizações e reservas enviados pela Fly.',
    rota: '/viagem/cofre',
    fase: null,
    ref: '§7.7',
  },
  {
    chave: 'refeicoes',
    rotulo: 'Refeições',
    descricao: 'Escolha o prato de cada dia, até o prazo.',
    rota: '/viagem/refeicoes',
    fase: null,
    ref: '§11.1',
  },
  {
    chave: 'concierge',
    rotulo: 'Restaurantes e serviços',
    descricao: 'Peça mesa, lavanderia, farmácia. A Fly resolve.',
    rota: '/viagem/concierge',
    fase: null,
    ref: '§11.2',
  },
  {
    chave: 'qr',
    rotulo: 'Ingressos e QR',
    descricao: 'Seus códigos de entrada e check-in.',
    rota: '/viagem/qr',
    fase: null,
    ref: '§7.8',
  },
  {
    chave: 'grupo',
    rotulo: 'Grupo e acompanhantes',
    descricao: 'Quem viaja com você e quem você acompanha.',
    rota: '/perfil/acompanhantes',
    fase: null,
    ref: '§7.10',
  },
  {
    chave: 'ajuda',
    rotulo: 'Ajuda e emergência',
    descricao: 'A Fly a um toque, a qualquer hora.',
    rota: '/assist/ajuda',
    fase: null,
    ref: '§12',
  },
  // --- ainda não abertos -------------------------------------------------
  {
    chave: 'passeios',
    rotulo: 'Passeios',
    descricao: 'Catálogo, carrinho e reservas.',
    rota: null,
    fase: 5,
    ref: '§6',
  },
  {
    chave: 'mapa',
    rotulo: 'Mapa e Bases Fly',
    descricao: 'Onde a Fly está, na cidade e no aeroporto.',
    rota: null,
    fase: 8,
    ref: '§12',
  },
  {
    chave: 'album',
    rotulo: 'Álbum e galeria',
    descricao: 'As fotos da viagem, liberadas conforme os dias passam.',
    rota: null,
    fase: 9,
    ref: '§13',
  },
  {
    chave: 'talks',
    rotulo: 'Fly Talks',
    descricao: 'Conversas e conteúdo da viagem.',
    rota: null,
    fase: 9,
    ref: '§15',
  },
  {
    chave: 'compras',
    rotulo: 'Compras vinculadas',
    descricao: 'O que você comprou durante a viagem.',
    rota: null,
    fase: 5,
    ref: '§8',
  },
  {
    chave: 'feedback',
    rotulo: 'Feedback e pós-viagem',
    descricao: 'O que você achou, e o que vem depois.',
    rota: null,
    fase: 9,
    ref: '§13',
  },
];

/** O que já dá para abrir. */
export function itensAbertos(): readonly ItemDoHub[] {
  return HUB.filter((i) => i.rota !== null);
}

/** O que ainda não abriu, com a fase em que abre. */
export function itensPendentes(): readonly ItemDoHub[] {
  return HUB.filter((i) => i.rota === null);
}
