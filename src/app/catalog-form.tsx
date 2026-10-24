import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { connectCatalog, renameCatalog } from '@/lib/catalog-actions';
import { splitUserInfo } from '@/lib/catalog-url';
import { useCatalog } from '@/lib/catalogs';
import { loadCredentials, loadSecretUrl } from '@/lib/credentials';
import { describeError } from '@/lib/errors';
import { PRESETS, presetById, type Preset } from '@/lib/presets';
import { Row, Section } from '@/ui/List';
import { SheetAction, SheetHeader } from '@/ui/SheetHeader';
import { Text, textStyles } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

interface Fields {
  url: string;
  name: string;
  login: boolean;
  username: string;
  password: string;
}

const EMPTY: Fields = { url: '', name: '', login: false, username: '', password: '' };

const sameFields = (a: Fields, b: Fields) =>
  a.url.trim() === b.url.trim() &&
  a.name.trim() === b.name.trim() &&
  a.login === b.login &&
  (!a.login || (a.username === b.username && a.password === b.password));

export default function CatalogFormScreen() {
  const params = useLocalSearchParams<{ id?: string; preset?: string; focus?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useColors();
  const editing = useCatalog(params.id);
  const isEdit = !!params.id;

  const [initial, setInitial] = useState<Fields>(EMPTY);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [loaded, setLoaded] = useState(!isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [leaving, setLeaving] = useState(false);
  const usernameRef = useRef<TextInput>(null);
  const autoConnected = useRef(false);
  const openAfterClose = useRef<string | undefined>(undefined);

  // Edit: prefill from the saved catalog, its keychain URL and its login.
  useEffect(() => {
    if (!isEdit || !editing || loaded) return;
    let cancelled = false;
    void (async () => {
      const url = editing.urlInKeychain ? ((await loadSecretUrl(editing.id)) ?? '') : editing.url;
      const credentials = editing.hasCredentials ? await loadCredentials(editing.id) : undefined;
      if (cancelled) return;
      const next: Fields = {
        url,
        name: editing.title,
        login: !!credentials,
        username: credentials?.username ?? '',
        password: credentials?.password ?? '',
      };
      setInitial(next);
      setFields(next);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editing, loaded]);

  const dirty = loaded && !leaving && !sameFields(fields, initial);

  usePreventRemove(dirty && !busy, ({ data }) => {
    Alert.alert('Discard changes?', 'What you typed here will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const update = (patch: Partial<Fields>) => {
    setFields((current) => ({ ...current, ...patch }));
    setError(undefined);
  };

  const connect = async (input: Fields = fields) => {
    if (busy) return;
    const split = splitUserInfo(input.url.trim());
    const login = input.login || !!split.username;
    const username = split.username ?? input.username;
    const password = split.password ?? input.password;
    if (!split.url.trim()) {
      setError('Enter the address of an OPDS catalog.');
      return;
    }
    if (login && !username.trim()) {
      update({ url: split.url, login: true });
      setError('Enter a username, or turn off the login.');
      usernameRef.current?.focus();
      return;
    }

    // Only the name changed: save it without asking the server again.
    if (isEdit && editing && sameFields({ ...input, name: initial.name }, initial)) {
      renameCatalog(editing.id, input.name || editing.title);
      setLeaving(true);
      return;
    }

    const credentials = login ? { username: username.trim(), password } : undefined;
    setBusy(true);
    setError(undefined);
    try {
      const { catalog } = await connectCatalog({
        url: split.url,
        name: input.name,
        credentials,
        catalogId: editing?.id,
      });
      setLeaving(true);
      if (!isEdit) openAfterClose.current = catalog.id;
    } catch (e) {
      const copy = describeError(e, !!credentials);
      setFields((current) => ({
        ...current,
        url: split.url,
        login: current.login || login || copy.needsLogin,
        username,
        password,
      }));
      setError(copy.message);
      if (copy.needsLogin && !credentials) setTimeout(() => usernameRef.current?.focus(), 250);
    } finally {
      setBusy(false);
    }
  };

  // Close once the guard is lifted (state has settled), then open a newly added catalog.
  useEffect(() => {
    if (!leaving) return;
    const id = openAfterClose.current;
    router.back();
    if (id) setTimeout(() => router.push({ pathname: '/catalog/[id]/feed', params: { id } }), 350);
  }, [leaving, router]);

  const choosePreset = (preset: Preset) => {
    const next = { ...EMPTY, url: preset.url, name: preset.name };
    setFields(next);
    setError(undefined);
    void connect(next);
  };

  // Opened from a preset on the empty Libraries screen: fill in and connect right away.
  useEffect(() => {
    const preset = presetById(params.preset);
    if (!preset || autoConnected.current) return;
    autoConnected.current = true;
    choosePreset(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.preset]);

  const title = isEdit ? 'Edit catalog' : 'Add catalog';

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.groupedBackground }]}>
      <Stack.Screen options={{ gestureEnabled: !dirty && !busy }} />
      <SheetHeader
        title={title}
        onClose={() => router.back()}
        action={
          <SheetAction
            title={isEdit ? 'Save' : 'Connect'}
            onPress={() => void connect()}
            busy={busy}
            disabled={!loaded}
            testID="catalog-connect"
          />
        }
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
      >
        <Section
          header="OPDS catalog URL"
          footer={
            error ? (
              <Text
                variant="footnote"
                style={[styles.footer, { color: colors.danger }]}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                testID="catalog-error"
              >
                {error}
              </Text>
            ) : (
              'Only add catalogs you own or are allowed to use.'
            )
          }
          style={styles.firstSection}
        >
          <Field
            value={fields.url}
            onChangeText={(url) => update({ url })}
            placeholder="https://books.example.com/opds"
            keyboardType="url"
            textContentType="URL"
            autoFocus={!isEdit && !params.preset && params.focus !== 'name'}
            returnKeyType="go"
            onSubmitEditing={() => void connect()}
            accessibilityLabel="OPDS catalog URL"
            editable={!busy}
            testID="catalog-url"
          />
        </Section>
        <Section header="Name">
          <Field
            value={fields.name}
            onChangeText={(name) => update({ name })}
            placeholder={isEdit ? 'Catalog name' : 'Optional — the catalog’s own title is used'}
            autoCapitalize="words"
            autoCorrect
            autoFocus={params.focus === 'name' && loaded}
            returnKeyType="go"
            onSubmitEditing={() => void connect()}
            accessibilityLabel="Name"
            editable={!busy}
          />
        </Section>
        <Section>
          <View style={styles.switchRow}>
            <Text variant="body" style={styles.flex}>
              This catalog needs a login
            </Text>
            <Switch
              value={fields.login}
              onValueChange={(login) => update({ login })}
              trackColor={{ true: colors.accent }}
              accessibilityLabel="This catalog needs a login"
              disabled={busy}
            />
          </View>
          {fields.login ? (
            <Field
              ref={usernameRef}
              value={fields.username}
              onChangeText={(username) => update({ username })}
              placeholder="Username"
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              accessibilityLabel="Username"
              editable={!busy}
            />
          ) : null}
          {fields.login ? (
            <Field
              value={fields.password}
              onChangeText={(password) => update({ password })}
              placeholder="Password"
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={() => void connect()}
              accessibilityLabel="Password"
              editable={!busy}
            />
          ) : null}
        </Section>
        <Text variant="footnote" color="secondaryText" style={styles.examples}>
          Calibre-Web: …/opds · Kavita: copy the OPDS URL from your user settings · Komga: …/opds/v1.2/catalog
        </Text>
        {isEdit ? null : (
          <Section header="Or try">
            {PRESETS.map((preset) => (
              <Row
                key={preset.id}
                title={preset.name}
                subtitle={preset.subtitle}
                subtitleLines={2}
                onPress={busy ? undefined : () => choosePreset(preset)}
                accessibilityHint="Connects to this catalog"
                testID={`sheet-preset-${preset.id}`}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ ref, ...props }: TextInputProps & { ref?: React.Ref<TextInput> }) {
  const colors = useColors();
  return (
    <TextInput
      ref={ref}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      placeholderTextColor={colors.tertiaryText}
      selectionColor={colors.accent}
      {...props}
      style={[styles.field, textStyles.body, { color: colors.text }]}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: space.xxl,
  },
  firstSection: {
    marginTop: space.s,
  },
  footer: {
    marginHorizontal: space.l,
    marginTop: 6,
  },
  field: {
    minHeight: 48,
    paddingHorizontal: space.l,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  switchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.l,
    paddingVertical: 6,
    gap: space.m,
  },
  examples: {
    marginHorizontal: space.xxl,
    marginTop: space.s,
  },
});
