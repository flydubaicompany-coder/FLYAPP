import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { palette, radius, space } from '@/theme';
import {
  AlertBanner,
  AppHeader,
  Botao,
  Card,
  Field,
  Kicker,
  LoadingSkeleton,
  Screen,
  Text,
} from '@/ui';
import { supabase } from '@/auth/client';
import { useSession } from '@/auth/session';
import {
  deIso,
  estaValido,
  normalizarNumero,
  paraIso,
  validar,
  type DadosDoPassaporte,
  type Erros,
} from '@/viagem/passaporte';

/**
 * Passaporte (§7.5 e §9).
 *
 * **A pessoa digita.** Não há captura do documento oficial, não há OCR e não
 * há foto no cofre — o que também resolve, por eliminação, a proibição da §7.7
 * de mandar passaporte a modelo genérico de IA: não existe imagem para mandar.
 *
 * Por isso a tela investe onde a digitação erra: o nome vem com a instrução de
 * copiar do documento (divergência aqui é embarque negado), o número é
 * normalizado como o banco normaliza, e a validade é conferida contra hoje.
 *
 * Editar qualquer dado derruba a conferência da Fly. Isso não é escolha da
 * tela — é gatilho no banco, e vale para qualquer caminho.
 */

interface Passaporte extends DadosDoPassaporte {
  id: string;
  conferidoEm: string | null;
}

const VAZIO: DadosDoPassaporte = {
  nomeCompleto: '',
  numero: '',
  paisEmissor: '',
  nacionalidade: '',
  nascimento: '',
  emissao: '',
  validade: '',
};

export default function PassaporteScreen() {
  const { state: sessao } = useSession();
  const [lista, setLista] = useState<Passaporte[] | null>(null);
  const [form, setForm] = useState<DadosDoPassaporte>(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const userId = sessao.kind === 'signedIn' ? sessao.profile.id : null;

  const carregar = useCallback(async () => {
    if (!userId) return setLista([]);

    const { data, error } = await supabase()
      .from('passports')
      .select(
        'id, full_name, number, issuing_country, nationality, birth_date, issued_on, expires_on, verified_at',
      )
      .order('expires_on', { ascending: false });

    if (error) return setAviso(error.message);

    setLista(
      (data ?? []).map((p) => ({
        id: p.id,
        nomeCompleto: p.full_name,
        numero: p.number,
        paisEmissor: p.issuing_country,
        nacionalidade: p.nationality ?? '',
        nascimento: deIso(p.birth_date),
        emissao: deIso(p.issued_on),
        validade: deIso(p.expires_on),
        conferidoEm: p.verified_at,
      })),
    );
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function alterar(campo: keyof DadosDoPassaporte, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    // Some o erro do campo assim que a pessoa mexe nele. Manter o erro
    // enquanto ela corrige é dizer que está errado enquanto ela conserta.
    setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function salvar() {
    if (!userId) return;

    const achados = validar(form);
    setErros(achados);
    if (!estaValido(achados)) return;

    setSalvando(true);
    setAviso(null);

    const linha = {
      user_id: userId,
      full_name: form.nomeCompleto.trim(),
      number: normalizarNumero(form.numero),
      issuing_country: form.paisEmissor.trim().toUpperCase(),
      nationality: form.nacionalidade.trim() ? form.nacionalidade.trim().toUpperCase() : null,
      birth_date: paraIso(form.nascimento),
      issued_on: paraIso(form.emissao),
      expires_on: paraIso(form.validade) as string,
    };

    const db = supabase();
    const { error } = editando
      ? await db.from('passports').update(linha).eq('id', editando)
      : await db.from('passports').insert(linha);

    setSalvando(false);

    if (error) {
      setAviso(
        error.code === '23505'
          ? 'Este passaporte já está cadastrado.'
          : 'Não consegui salvar. Confira os dados e tente de novo.',
      );
      return;
    }

    setForm(VAZIO);
    setEditando(null);
    await carregar();
  }

  async function remover(id: string) {
    const { error } = await supabase().from('passports').delete().eq('id', id);
    if (error) setAviso('Não consegui remover agora.');
    await carregar();
  }

  function editar(p: Passaporte) {
    setEditando(p.id);
    setErros({});
    setForm({
      nomeCompleto: p.nomeCompleto,
      numero: p.numero,
      paisEmissor: p.paisEmissor,
      nacionalidade: p.nacionalidade,
      nascimento: p.nascimento,
      emissao: p.emissao,
      validade: p.validade,
    });
  }

  if (!lista) {
    return (
      <Screen withBottomNav={false} testID="screen-passaporte">
        <LoadingSkeleton label="Carregando seus documentos" />
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false} testID="screen-passaporte">
      <AppHeader kicker="Perfil" title="Passaporte" onBack={() => router.back()} />

      <Text variant="body" tone="muted">
        Digite os dados exatamente como estão no seu passaporte. A Fly usa isso para emitir suas
        passagens — um caractere diferente é embarque negado no balcão.
      </Text>

      {aviso ? <AlertBanner severity="warning" title={aviso} /> : null}

      {lista.map((p) => (
        <Card key={p.id}>
          <View style={styles.bloco}>
            <View style={styles.linhaTopo}>
              <View style={styles.corpo}>
                <Kicker>{p.paisEmissor}</Kicker>
                <Text variant="body" style={styles.nome}>
                  {p.nomeCompleto}
                </Text>
              </View>
              <Text variant="body" tone={p.conferidoEm ? 'ok' : 'faint'}>
                {p.conferidoEm ? 'Conferido' : 'Aguardando conferência'}
              </Text>
            </View>

            <View style={styles.linha}>
              <Text variant="body" tone="muted">
                Número
              </Text>
              <Text variant="body">{p.numero}</Text>
            </View>
            <View style={styles.linha}>
              <Text variant="body" tone="muted">
                Válido até
              </Text>
              <Text variant="body">{p.validade}</Text>
            </View>

            {!p.conferidoEm ? (
              <Text variant="body" tone="faint">
                A equipe Fly confere antes de emitir qualquer passagem.
              </Text>
            ) : null}

            <View style={styles.acoes}>
              <Botao
                rotulo="Editar"
                variante="fantasma"
                rotuloAcessivel={`Editar passaporte ${p.paisEmissor}`}
                onPress={() => editar(p)}
                testID={`editar-${p.id}`}
              />
              <Botao
                rotulo="Remover"
                variante="fantasma"
                rotuloAcessivel={`Remover passaporte ${p.paisEmissor}`}
                onPress={() => void remover(p.id)}
              />
            </View>
          </View>
        </Card>
      ))}

      <View style={styles.secao}>
        <Kicker>{editando ? 'Editar passaporte' : 'Adicionar passaporte'}</Kicker>

        {editando ? (
          <Text variant="body" tone="faint">
            Alterar qualquer dado faz a Fly conferir de novo antes de emitir.
          </Text>
        ) : null}

        <Field
          label="Nome completo"
          hint="Copie exatamente como está impresso, inclusive a ordem dos sobrenomes."
          value={form.nomeCompleto}
          onChangeText={(v) => alterar('nomeCompleto', v)}
          autoCapitalize="characters"
          {...(erros.nomeCompleto ? { error: erros.nomeCompleto } : {})}
          testID="passaporte-nome"
        />

        <Field
          label="Número do passaporte"
          value={form.numero}
          onChangeText={(v) => alterar('numero', v)}
          autoCapitalize="characters"
          autoCorrect={false}
          {...(erros.numero ? { error: erros.numero } : {})}
          testID="passaporte-numero"
        />

        <Field
          label="País emissor"
          hint="Sigla de três letras. Brasil é BRA."
          value={form.paisEmissor}
          onChangeText={(v) => alterar('paisEmissor', v)}
          autoCapitalize="characters"
          maxLength={3}
          {...(erros.paisEmissor ? { error: erros.paisEmissor } : {})}
          testID="passaporte-pais"
        />

        <Field
          label="Nacionalidade"
          hint="Opcional. Deixe em branco se for a mesma do país emissor."
          value={form.nacionalidade}
          onChangeText={(v) => alterar('nacionalidade', v)}
          autoCapitalize="characters"
          maxLength={3}
          {...(erros.nacionalidade ? { error: erros.nacionalidade } : {})}
        />

        <Field
          label="Válido até"
          hint="dd/mm/aaaa"
          value={form.validade}
          onChangeText={(v) => alterar('validade', v)}
          keyboardType="numbers-and-punctuation"
          {...(erros.validade ? { error: erros.validade } : {})}
          testID="passaporte-validade"
        />

        <Field
          label="Data de emissão"
          hint="Opcional. dd/mm/aaaa"
          value={form.emissao}
          onChangeText={(v) => alterar('emissao', v)}
          keyboardType="numbers-and-punctuation"
          {...(erros.emissao ? { error: erros.emissao } : {})}
        />

        <Field
          label="Data de nascimento"
          hint="Opcional. dd/mm/aaaa"
          value={form.nascimento}
          onChangeText={(v) => alterar('nascimento', v)}
          keyboardType="numbers-and-punctuation"
          {...(erros.nascimento ? { error: erros.nascimento } : {})}
        />

        <View style={styles.acoes}>
          <Botao
            rotulo={editando ? 'Salvar alterações' : 'Adicionar'}
            ocupado={salvando}
            onPress={() => void salvar()}
            testID="passaporte-salvar"
          />
          {editando ? (
            <Botao
              rotulo="Cancelar"
              variante="fantasma"
              onPress={() => {
                setEditando(null);
                setForm(VAZIO);
                setErros({});
              }}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.rodape}>
        <Text variant="body" tone="faint">
          A equipe que cuida da sua viagem enxerga estes dados — é com eles que a Fly emite suas
          passagens. Cada abertura fica registrada, e só quem opera a sua viagem tem acesso.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: space.sm },
  secao: { gap: space.lg, marginTop: space.section },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  corpo: { flex: 1, gap: space.xs },
  nome: { fontWeight: '600' },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.stroke,
    borderRadius: radius.chip,
  },
  acoes: { gap: space.sm, marginTop: space.sm },
  rodape: {
    marginTop: space.section,
    padding: space.lg,
    borderRadius: radius.block,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
});
