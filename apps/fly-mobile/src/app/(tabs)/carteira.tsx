import { AppHeader, PhaseStub, Screen } from '@/ui';

/** Carteira. Pontos, status, benefícios e tax-free são entrega da Fase 6 (§8). */
export default function WalletScreen() {
  return (
    <Screen testID="screen-carteira">
      <AppHeader kicker="Carteira" title="Fly Wallet" />
      <PhaseStub
        phase={6}
        summary="Onde valor e benefício se concentram. Dinheiro, crédito, pontos e status são domínios separados, cada um com ledger próprio."
        planned={[
          'Resumo com saldo, status e movimentações',
          'Fly Points com ledger append-only',
          'Fly Status e plaquinhas',
          'Benefícios e resgates',
          'Pagamentos tokenizados pelo provedor',
          'Notas e Tax-Free, sempre como estimativa',
        ]}
        specRef="§8"
      />
    </Screen>
  );
}
