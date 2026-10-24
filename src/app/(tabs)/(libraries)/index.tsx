import { Image } from 'expo-image';
import { Stack, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { removeCatalogWithFeedback } from '@/features/remove-catalog';
import { USER_AGENT } from '@/lib/app-info';
import { hostOf, useCatalogs, type Catalog } from '@/lib/catalogs';
import { PRESETS } from '@/lib/presets';
import { Button } from '@/ui/Button';
import { HeaderIconButton } from '@/ui/HeaderButton';
import { Icon } from '@/ui/Icon';
import { Row, Section } from '@/ui/List';
import { accessibilityActionsFor, showRowActions, type RowAction } from '@/ui/row-actions';
import { Text } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

const feedHref = (catalog: Catalog): Href => ({ pathname: '/catalog/[id]/feed', params: { id: catalog.id } });
const formHref = (params: Record<string, string> = {}): Href => ({ pathname: '/catalog-form', params });

export default function LibrariesScreen() {
  const router = useRouter();
  const catalogs = useCatalogs();
  const colors = useColors();

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <HeaderIconButton
                ios="info.circle"
                android="info"
                label="About Bookfetch"
                onPress={() => router.push('/about')}
              />
              <HeaderIconButton
                ios="plus"
                android="add"
                label="Add catalog"
                onPress={() => router.push(formHref())}
                testID="add-catalog"
              />
            </View>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, catalogs.length === 0 && styles.emptyContent]}
        style={{ backgroundColor: colors.groupedBackground }}
      >
        {catalogs.length === 0 ? (
          <EmptyLibraries
            onAdd={() => router.push(formHref())}
            onPreset={(id) => router.push(formHref({ preset: id }))}
          />
        ) : (
          <Section>
            {catalogs.map((catalog) => (
              <CatalogRow key={catalog.id} catalog={catalog} />
            ))}
          </Section>
        )}
      </ScrollView>
    </>
  );
}

function EmptyLibraries({ onAdd, onPreset }: { onAdd: () => void; onPreset: (id: string) => void }) {
  const colors = useColors();
  return (
    <View>
      <View style={styles.hero}>
        <Icon ios="books.vertical" android="library_books" size={48} color={colors.accent} />
        <Text variant="title2" style={styles.center} accessibilityRole="header">
          Bring your book server
        </Text>
        <Text variant="body" color="secondaryText" style={styles.center}>
          Add an OPDS catalog — Calibre-Web, Kavita, Komga, or any OPDS server.
        </Text>
        <Button title="Add catalog" onPress={onAdd} style={styles.heroButton} testID="empty-add-catalog" />
      </View>
      <Section header="Or try">
        {PRESETS.map((preset) => (
          <Row
            key={preset.id}
            title={preset.name}
            subtitle={preset.subtitle}
            subtitleLines={2}
            leading={<FallbackGlyph />}
            chevron
            onPress={() => onPreset(preset.id)}
            accessibilityHint="Adds this catalog"
            testID={`preset-${preset.id}`}
          />
        ))}
      </Section>
    </View>
  );
}

function confirmRemove(catalog: Catalog) {
  Alert.alert(
    `Remove “${catalog.title}”?`,
    catalog.hasCredentials
      ? 'Its login is deleted from this phone. Books you downloaded stay in Downloads.'
      : 'Books you downloaded stay in Downloads.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeCatalogWithFeedback(catalog) },
    ],
  );
}

function CatalogRow({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const colors = useColors();
  const subtitle = catalog.hasCredentials ? `${hostOf(catalog.url)} · Signed in` : hostOf(catalog.url);
  const edit = (focus?: string) => router.push(formHref({ id: catalog.id, ...(focus ? { focus } : {}) }));

  const content = (
    <View style={styles.catalogRow}>
      <CatalogIcon uri={catalog.iconUrl} />
      <View style={styles.flex}>
        <Text variant="body" numberOfLines={1}>
          {catalog.title}
        </Text>
        <Text variant="subhead" color="secondaryText" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.tertiaryText} />
    </View>
  );

  // Rename lives in the edit sheet's Name field, so Android's three-button alert offers Edit and Remove.
  const actions: RowAction[] = [
    ...(Platform.OS === 'ios' ? [{ name: 'rename', label: 'Rename', onPress: () => edit('name') }] : []),
    { name: 'edit', label: 'Edit', onPress: () => edit() },
    { name: 'remove', label: 'Remove', destructive: true, onPress: () => confirmRemove(catalog) },
  ];

  return (
    <Pressable
      onPress={() => router.push(feedHref(catalog))}
      onLongPress={() => showRowActions(catalog.title, hostOf(catalog.url), actions)}
      accessibilityRole="button"
      accessibilityLabel={`${catalog.title}, ${subtitle}`}
      accessibilityHint="Opens the catalog."
      {...accessibilityActionsFor(actions)}
      android_ripple={{ color: colors.cellPressed }}
      style={({ pressed }) => (Platform.OS === 'ios' && pressed ? { backgroundColor: colors.cellPressed } : undefined)}
      testID={`catalog-${catalog.id}`}
    >
      {content}
    </Pressable>
  );
}

function CatalogIcon({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <FallbackGlyph />;
  return (
    <Image
      source={{ uri, headers: { 'User-Agent': USER_AGENT } }}
      style={styles.icon}
      contentFit="contain"
      onError={() => setFailed(true)}
      accessible={false}
    />
  );
}

function FallbackGlyph() {
  const colors = useColors();
  return (
    <View style={[styles.icon, styles.glyph, { backgroundColor: colors.accent }]}>
      <Icon ios="books.vertical.fill" android="library_books" size={18} color={colors.onAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: space.xxl,
  },
  emptyContent: {
    flexGrow: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: space.xxl,
    paddingTop: space.xxl,
    gap: space.s,
  },
  heroButton: {
    alignSelf: 'stretch',
    marginTop: space.l,
  },
  center: {
    textAlign: 'center',
  },
  catalogRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: 10,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.cell / 2,
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
