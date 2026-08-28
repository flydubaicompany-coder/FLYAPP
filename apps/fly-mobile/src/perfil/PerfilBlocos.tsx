import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { palette } from '@/theme';
import { Text } from '@/ui';
import type { FlyPackage } from '@fly/design-tokens';
import { SeloDoPacote } from '@/carteira/CarteiraBlocos';
import asaDim from '../../assets/brand/fly-wing-dim.png';
import { ChevronIcon } from './PerfilIcons';

/**
 * Os blocos do Perfil, medidos em `docs/design/extracao/06-perfil.html`.
 *
 * O design agrupa as linhas em cartoes de raio 24 com um fio de 1 px recuado
 * 48 px — a largura do icone mais o respiro. E esse recuo que faz a lista
 * parecer um bloco unico em vez de linhas soltas, e e o detalhe que some
 * quando alguem desenha a mesma tela de memoria.
 */

/* ---------------------------------------------------------------- cabecalho */

export interface CabecalhoDoPerfilProps {
  titulo: string;
  /** A engrenagem do canto. Sem acao ela nao aparece — botao morto e pior. */
  aoAbrirAjustes?: (() => void) | undefined;
  rotuloAjustes?: string;
  icone?: ReactNode;
}

export function CabecalhoDoPerfil({
  titulo,
  aoAbrirAjustes,
  rotuloAjustes = 'Ajustes',
  icone,
}: CabecalhoDoPerfilProps) {
  return (
    <View style={styles.cabecalho}>
      <Text variant="largeTitle" style={styles.titulo}>
        {titulo}
      </Text>
      {aoAbrirAjustes ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rotuloAjustes}
          onPress={aoAbrirAjustes}
          testID="perfil-ajustes"
        >
          {({ pressed }) => (
            <View style={[styles.engrenagem, pressed && styles.engrenagemPressionada]}>
              {icone}
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- identidade */

export interface CartaoDeIdentidadeProps {
  nome: string;
  /** E-mail da sessao. Nao ha campo de e-mail no perfil — vem do Fly ID. */
  contato?: string | null;
  /**
   * Pacote adquirido, com a cor do pacote (D120): Standard **azul**, Black
   * **branco**, Billionaire **dourado**. Vem de `customer_packages`, tabela
   * que so operador escreve.
   *
   * `null` = a Fly ainda nao registrou. O selo simplesmente nao aparece, em
   * vez de afirmar um pacote que o cliente talvez nao tenha.
   */
  pacote?: FlyPackage | null;
}

/** Iniciais do nome: primeira e ultima palavra, no maximo duas letras. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function CartaoDeIdentidade({ nome, contato, pacote }: CartaoDeIdentidadeProps) {
  return (
    <View style={styles.identidade}>
      <LinearGradient
        colors={['rgba(255,255,255,.075)', 'rgba(255,255,255,.032)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* O nucleo do avatar e um degrade radial, que so o SVG faz no React
          Native — o `expo-linear-gradient` nao tem radial. */}
      <View style={styles.avatar}>
        <Svg width={64} height={64} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="perfilAvatar" cx="30%" cy="12%" r="118%">
              <Stop offset="0" stopColor="#3A3A42" />
              <Stop offset="0.6" stopColor="#1A1A20" />
              <Stop offset="1" stopColor="#0D0D10" />
            </RadialGradient>
          </Defs>
          <Circle cx={32} cy={32} r={32} fill="url(#perfilAvatar)" />
        </Svg>
        <Text variant="section" style={styles.avatarTexto}>
          {iniciais(nome)}
        </Text>
      </View>

      <View style={styles.identidadeTexto}>
        <Text variant="section" numberOfLines={1} style={styles.nome}>
          {nome}
        </Text>
        {contato ? (
          <Text variant="body" numberOfLines={1} style={styles.contato}>
            {contato}
          </Text>
        ) : null}
        {pacote ? (
          <View style={styles.seloArea}>
            <SeloDoPacote pacote={pacote} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ lista */

export function TituloDeSecao({ children }: { children: ReactNode }) {
  return (
    <Text variant="caption" style={styles.tituloSecao}>
      {children}
    </Text>
  );
}

export function Grupo({ children }: { children: ReactNode }) {
  return <View style={styles.grupo}>{children}</View>;
}

export function Divisor() {
  return <View style={styles.divisor} />;
}

export interface LinhaProps {
  icone: ReactNode;
  rotulo: string;
  /** Texto a direita, antes do chevron. "Português", "24h". */
  valor?: string | null;
  /** Ponto ambar de pendencia, como em "Documentos e visto". */
  pendente?: boolean;
  valorDourado?: boolean;
  onPress: () => void;
  testID?: string;
}

export function Linha({
  icone,
  rotulo,
  valor,
  pendente = false,
  valorDourado = false,
  onPress,
  testID,
}: LinhaProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={valor ? `${rotulo}, ${valor}` : rotulo}
      onPress={onPress}
      testID={testID}
    >
      {({ pressed }) => (
        <View style={[styles.linha, pressed && styles.linhaPressionada]}>
          <View style={styles.linhaIcone}>{icone}</View>
          <Text variant="body" numberOfLines={1} style={styles.linhaRotulo}>
            {rotulo}
          </Text>
          <View style={styles.linhaFim}>
            {pendente ? <View style={styles.pendente} /> : null}
            {valor ? (
              <Text
                variant="body"
                style={[styles.linhaValor, valorDourado && styles.linhaValorOuro]}
              >
                {valor}
              </Text>
            ) : null}
            <ChevronIcon />
          </View>
        </View>
      )}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- rodape */

export interface SairProps {
  onPress: () => void;
  /** Nota abaixo do botao. O design nao tem — mas a informacao e real. */
  nota?: string | null;
}

export function BotaoSair({ onPress, nota }: SairProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
        accessibilityHint={nota ?? undefined}
        onPress={onPress}
        testID="perfil-sair"
      >
        {({ pressed }) => (
          <View style={[styles.sair, pressed && styles.sairPressionado]}>
            <Text variant="body" style={styles.sairTexto}>
              Sair da conta
            </Text>
          </View>
        )}
      </Pressable>
      {nota ? (
        <Text variant="body" style={styles.sairNota}>
          {nota}
        </Text>
      ) : null}
    </View>
  );
}

export function RodapeDaVersao({ versao }: { versao: string }) {
  return (
    <View style={styles.rodape}>
      <Image source={asaDim} style={styles.asa} contentFit="contain" />
      <Text variant="body" style={styles.versao}>
        {versao}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  titulo: { fontSize: 33, lineHeight: 34, fontWeight: '700', letterSpacing: -1.25 },
  engrenagem: {
    width: 36,
    height: 36,
    marginBottom: 3,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.085)',
  },
  engrenagemPressionada: { transform: [{ scale: 0.9 }] },

  identidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginTop: 22,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.085)',
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(223,201,138,.34)',
    shadowColor: 'rgba(223,201,138,.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  avatarTexto: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.22,
    color: 'rgba(245,245,247,.9)',
  },
  identidadeTexto: { flex: 1, minWidth: 0 },
  nome: { fontSize: 20, lineHeight: 22, fontWeight: '600', letterSpacing: -0.56 },
  contato: {
    marginTop: 4,
    fontSize: 12.5,
    letterSpacing: -0.06,
    color: 'rgba(245,245,247,.42)',
  },
  seloArea: { marginTop: 9, alignSelf: 'flex-start' },

  tituloSecao: {
    marginTop: 24,
    marginBottom: 10,
    marginHorizontal: 20,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.35,
    color: 'rgba(245,245,247,.34)',
  },
  grupo: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  divisor: { height: 1, marginLeft: 48, backgroundColor: 'rgba(255,255,255,.07)' },

  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  linhaPressionada: { backgroundColor: 'rgba(255,255,255,.05)' },
  linhaIcone: { width: 19, alignItems: 'center' },
  linhaRotulo: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.24,
    color: palette.text,
  },
  linhaFim: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pendente: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.warning,
    shadowColor: 'rgba(233,162,59,.7)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  linhaValor: { fontSize: 13, letterSpacing: -0.06, color: 'rgba(245,245,247,.36)' },
  linhaValorOuro: { color: palette.gold },

  sair: {
    marginTop: 22,
    marginHorizontal: 16,
    height: 50,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
  },
  sairPressionado: { transform: [{ scale: 0.985 }] },
  sairTexto: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.24,
    color: 'rgba(245,245,247,.6)',
  },
  sairNota: {
    marginTop: 10,
    marginHorizontal: 20,
    textAlign: 'center',
    fontSize: 11.5,
    letterSpacing: -0.02,
    color: 'rgba(245,245,247,.28)',
  },

  rodape: { marginTop: 20, alignItems: 'center', gap: 8 },
  asa: { width: 21, height: 9, opacity: 0.5 },
  versao: { fontSize: 11, letterSpacing: 0.33, color: 'rgba(245,245,247,.24)' },
});
