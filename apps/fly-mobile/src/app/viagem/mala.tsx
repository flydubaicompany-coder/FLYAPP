import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { palette } from '@/theme';
import {
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  OfflineState,
  Screen,
  Text,
} from '@/ui';
import { useSession } from '@/auth/session';
import { useViagem } from '@/viagem/useViagem';
import { useMala } from '@/viagem/useMala';
import { progresso, type ItemDaMala } from '@/viagem/mala';

/**
 * Mala Pronta (§45, entrega 8).
 *
 * A lista vem do **roteiro**: `what_to_bring` e `dress_code` das atividades,
 * que a operação já preenche por atividade desde a Fase 4. Um passeio de
 * deserto que pede casaco já diz isso na própria atividade.
 *
 * **Clima não entra, e a tela diz isso.** Exigiria provedor de meteorologia, e
 * a §33 não deixa declarar integração sem credencial e homologação. Uma lista
 * que se apresenta como "pelo clima" e foi montada por adivinhação é pior do
 * que uma lista honesta sobre de onde veio.
 */

const ROTULO_FONTE: Record<ItemDaMala['fonte'], string> = {
  roteiro: 'do roteiro',
  fly: 'a Fly sugere',
  proprio: 'você acrescentou',
};

export default function MalaScreen() {
  const { state } = useSession();
  const { data: viagem } = useViagem();
  const userId = state.kind === 'signedIn' ? state.profile.id : null;
  const tripId = viagem.kind === 'ready' ? viagem.viagem.id : null;
  const { data, marcar, acrescentar, recarregar } = useMala(tripId, userId);

  const [novo, setNovo] = useState('');

  if (data.kind === 'loading') {
    return (
      <Screen withBottomNav={false} testID="screen-mala">
        <LoadingSkeleton label="Montando a mala" />
      </Screen>
    );
  }

  if (data.kind === 'offline') {
    return (
      <Screen withBottomNav={false} testID="screen-mala">
        <AppHeader kicker="Minha Viagem" title="Mala Pronta" onBack={() => router.back()} />
        <OfflineState onRetry={() => void recarregar()} />
      </Screen>
    );
  }

  if (data.kind === 'error') {
    return (
      <Screen withBottomNav={false} testID="screen-mala">
        <AppHeader kicker="Minha Viagem" title="Mala Pronta" onBack={() => router.back()} />
        <ErrorState title="Não consegui montar a mala" description={data.message} />
      </Screen>
    );
  }

  if (data.kind === 'semViagem') {
    return (
      <Screen withBottomNav={false} testID="screen-mala">
        <AppHeader kicker="Minha Viagem" title="Mala Pronta" onBack={() => router.back()} />
        <EmptyState
          title="A mala começa com o roteiro"
          description="Quando a Fly montar a sua viagem, a lista aparece aqui — vinda do que cada dia pede."
        />
      </Screen>
    );
  }

  const p = progresso(data.itens);

  return (
    <Screen withBottomNav={false} testID="screen-mala">
      <AppHeader
        kicker="Minha Viagem"
        title="Mala Pronta"
        subtitle={p.total > 0 ? `${p.feitos} de ${p.total} separados` : 'A lista da sua viagem.'}
        onBack={() => router.back()}
      />

      <Text variant="body" style={styles.nota}>
        A lista vem do seu roteiro — do que cada atividade pede — e do que a Fly sugere para o
        destino. Ela não considera a previsão do tempo.
      </Text>

      <View style={styles.linha}>
        <TextInput
          accessibilityLabel="Acrescentar item"
          placeholder="Acrescentar um item seu"
          placeholderTextColor={palette.textDisabled}
          value={novo}
          onChangeText={setNovo}
          style={styles.campo}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Acrescentar"
          onPress={() => {
            void acrescentar(novo);
            setNovo('');
          }}
          testID="mala-acrescentar"
        >
          {({ pressed }) => (
            <View style={[styles.botao, pressed && styles.pressionado]}>
              <Text variant="body" style={styles.botaoTexto}>
                Somar
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {data.itens.length === 0 ? (
        <EmptyState
          title="A lista ainda está vazia"
          description="Ela se monta sozinha conforme a Fly detalha o roteiro. Enquanto isso, acrescente o que você já sabe que vai levar."
        />
      ) : (
        data.itens.map((i) => (
          <Pressable
            key={i.chave}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: i.marcado }}
            accessibilityLabel={`${i.rotulo}, ${i.marcado ? 'separado' : 'ainda não separado'}`}
            onPress={() => void marcar(i, !i.marcado)}
          >
            {({ pressed }) => (
              <View style={[styles.item, pressed && styles.pressionado]}>
                <View style={[styles.caixa, i.marcado && styles.caixaMarcada]}>
                  {i.marcado ? (
                    <Text variant="body" style={styles.tique}>
                      ✓
                    </Text>
                  ) : null}
                </View>
                <View style={styles.itemTexto}>
                  <Text variant="body" style={[styles.itemRotulo, i.marcado && styles.itemFeito]}>
                    {i.rotulo}
                  </Text>
                  <Text variant="body" style={styles.itemMeta}>
                    {i.de ? `${ROTULO_FONTE[i.fonte]} · ${i.de}` : ROTULO_FONTE[i.fonte]}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nota: { marginTop: 14, fontSize: 12, lineHeight: 18, color: palette.textFaint },
  linha: { marginTop: 16, flexDirection: 'row', gap: 8, alignItems: 'center' },
  campo: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
    color: palette.text,
    fontSize: 14,
  },
  botao: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.fillStrong,
  },
  botaoTexto: { fontSize: 14, fontWeight: '600', color: palette.text },

  item: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.strokeSubtle,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  caixa: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: palette.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaMarcada: { borderColor: palette.strokeStrong, backgroundColor: palette.fillStrong },
  tique: { fontSize: 13, color: palette.text },
  itemTexto: { flex: 1, gap: 2 },
  itemRotulo: { fontSize: 14.5, color: palette.text },
  itemFeito: { color: palette.textMuted, textDecorationLine: 'line-through' },
  itemMeta: { fontSize: 11.5, color: palette.textFaint },
  pressionado: { opacity: 0.75 },
});
