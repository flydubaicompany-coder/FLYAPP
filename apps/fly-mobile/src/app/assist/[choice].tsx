import { useLocalSearchParams } from 'expo-router';
import { AppHeader, PhaseStub, Screen } from '@/ui';

/**
 * Destino das tres escolhas do Fly Assist.
 *
 * A Fase 1 entrega a rota e o contexto correto. Chat, fila de ajuda urgente e
 * o fluxo real de SOS — com localizacao autorizada, atribuicao e SLA — sao
 * entrega da Fase 8, atras da flag `sos.enabled`.
 */

const CONTENT = {
  chat: {
    kicker: 'Fly Assist',
    title: 'Falar com a Fly',
    summary: 'Conversa comum: roupa, horário, indicação.',
    planned: ['Chat com a equipe', 'Histórico da conversa', 'Templates de resposta'],
  },
  urgent: {
    kicker: 'Ajuda urgente',
    title: 'Precisa de ajuda agora',
    summary: 'Fila prioritária, com localização opcional.',
    planned: ['Fila prioritária', 'Localização apenas com permissão', 'Atribuição para a equipe'],
  },
  sos: {
    kicker: 'SOS',
    title: 'Emergência',
    summary:
      'Alerta imediato, localização e fallback de ligação. O app nunca substitui serviços públicos de emergência.',
    planned: [
      'Confirmação de recebimento',
      'Atribuição e primeira resposta',
      'Fallback de ligação quando a conexão falha',
      'Contatos oficiais vindos do painel',
      'Registro de aceite, resolução e escalonamento',
    ],
  },
} as const;

type Choice = keyof typeof CONTENT;

function isChoice(value: string | undefined): value is Choice {
  return value === 'chat' || value === 'urgent' || value === 'sos';
}

export default function AssistScreen() {
  const { choice } = useLocalSearchParams<{ choice?: string }>();
  const content = isChoice(choice) ? CONTENT[choice] : CONTENT.chat;

  return (
    <Screen withBottomNav={false} testID="screen-assist">
      <AppHeader kicker={content.kicker} title={content.title} />
      <PhaseStub phase={8} summary={content.summary} planned={content.planned} specRef="§12" />
    </Screen>
  );
}
