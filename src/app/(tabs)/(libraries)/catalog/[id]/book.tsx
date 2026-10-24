import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';

import type { Acquisition, Entry } from '@/opds';
import { openInOtherApp } from '@/features/open-file';
import { acquisitionLabel, downloadableAcquisitions } from '@/lib/acquisitions';
import { useCatalog, type Catalog } from '@/lib/catalogs';
import { fileExists } from '@/lib/downloads/files';
import { hrefKeyOf, useDownloads } from '@/lib/downloads/index-store';
import { cancelDownload, clearFailure, startDownload, useActiveDownload } from '@/lib/downloads/manager';
import { getEntry } from '@/lib/nav-store';
import { cleanText, formatBytes, languageName, yearOf } from '@/lib/text';
import { useCatalogSession } from '@/lib/use-session';
import { Button } from '@/ui/Button';
import { Cover } from '@/ui/Cover';
import { Icon } from '@/ui/Icon';
import { CenteredMessage } from '@/ui/States';
import { Text } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

const SUMMARY_LINES = 8;

export default function BookScreen() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  const router = useRouter();
  const colors = useColors();
  const catalog = useCatalog(id);
  const stored = getEntry(token);
  const { session } = useCatalogSession(catalog);
  const [expanded, setExpanded] = useState(false);

  if (!stored || !catalog) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.grow}>
        <Stack.Screen options={{ title: '' }} />
        <CenteredMessage
          title="This book isn't open anymore"
          message={catalog ? 'Go back to the catalog and open it again.' : 'Its catalog was removed.'}
        >
          <Button title="Go back" variant="tinted" onPress={() => router.back()} />
        </CenteredMessage>
      </ScrollView>
    );
  }

  const { entry } = stored;
  const title = cleanText(entry.title) || 'Untitled';
  const authors = entry.authors
    .map((a) => cleanText(a))
    .filter(Boolean)
    .join(', ');
  const meta = [cleanText(entry.publisher), yearOf(entry.issued), languageName(entry.language)]
    .filter(Boolean)
    .join(' · ');
  const categories = entry.categories
    .map((c) => cleanText(c))
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
  const summary = cleanText(entry.summary, true);
  const longSummary = summary.length > 480 || summary.split('\n').length > SUMMARY_LINES;
  const cover = entry.coverUrl ?? entry.thumbnailUrl;
  const acquisitions = downloadableAcquisitions(entry);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.coverBox}>
        <Cover
          uri={session ? cover : undefined}
          headers={cover && session ? session.client.headersFor(cover) : undefined}
          width={180}
          height={270}
          fit="contain"
        />
      </View>
      <View style={styles.heading}>
        <Text variant="title2" style={styles.center} accessibilityRole="header" selectable>
          {title}
        </Text>
        {authors ? (
          <Text variant="body" color="secondaryText" style={styles.center} numberOfLines={3}>
            {authors}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="footnote" color="secondaryText" style={styles.center} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>

      <View style={styles.downloads}>
        {acquisitions.length === 0 ? (
          <View style={styles.noDownload}>
            <Text variant="subhead" color="secondaryText" style={styles.center}>
              This book can&apos;t be downloaded here.
            </Text>
            {entry.alternateHref ? (
              <Button
                title="Open book page"
                variant="tinted"
                onPress={() => void Linking.openURL(entry.alternateHref!)}
                accessibilityHint="Opens in your browser"
              />
            ) : null}
          </View>
        ) : (
          acquisitions.map((acquisition) => (
            <DownloadControl
              key={acquisition.href}
              catalog={catalog}
              entry={entry}
              acquisition={acquisition}
              prominent={acquisition === acquisitions[0]}
            />
          ))
        )}
      </View>

      {summary ? (
        <View style={styles.section}>
          <Text variant="headline" accessibilityRole="header">
            About this book
          </Text>
          <Text variant="body" numberOfLines={expanded || !longSummary ? undefined : SUMMARY_LINES} selectable>
            {summary}
          </Text>
          {longSummary ? (
            <Button
              title={expanded ? 'Less' : 'More'}
              variant="plain"
              onPress={() => setExpanded((e) => !e)}
              style={styles.more}
            />
          ) : null}
        </View>
      ) : null}
      {categories ? (
        <View style={styles.section}>
          <Text variant="footnote" color="secondaryText">
            {categories}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DownloadControl({
  catalog,
  entry,
  acquisition,
  prominent,
}: {
  catalog: Catalog;
  entry: Entry;
  acquisition: Acquisition;
  prominent: boolean;
}) {
  const router = useRouter();
  const colors = useColors();
  const downloads = useDownloads();
  const active = useActiveDownload(acquisition.href);
  const key = hrefKeyOf(acquisition.href);
  const record = downloads.find((r) => r.hrefKey === key && fileExists(r.fileName));
  const label = acquisitionLabel(acquisition);
  const size = formatBytes(acquisition.size);

  if (active?.status === 'downloading') {
    const fraction = active.total > 0 ? Math.min(1, active.written / active.total) : undefined;
    const progressText =
      fraction !== undefined
        ? `${formatBytes(active.written) || '0 KB'} of ${formatBytes(active.total)}`
        : formatBytes(active.written) || 'Starting…';
    return (
      <View
        style={[styles.card, { backgroundColor: colors.fill }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Downloading ${label}`}
        accessibilityValue={
          fraction !== undefined ? { min: 0, max: 100, now: Math.round(fraction * 100) } : { text: progressText }
        }
      >
        <View style={styles.progressHeader}>
          <Text variant="subhead" style={styles.flex} numberOfLines={1}>
            Downloading {label}
          </Text>
          {fraction === undefined ? <ActivityIndicator size="small" color={colors.secondaryText} /> : null}
        </View>
        <View style={[styles.track, { backgroundColor: colors.placeholder }]}>
          {fraction !== undefined ? (
            <View style={[styles.bar, { backgroundColor: colors.accent, width: `${Math.max(2, fraction * 100)}%` }]} />
          ) : null}
        </View>
        <View style={styles.progressFooter}>
          <Text variant="footnote" color="secondaryText" style={styles.flex}>
            {progressText}
          </Text>
          <Button title="Cancel" variant="plain" onPress={() => cancelDownload(acquisition.href)} />
        </View>
      </View>
    );
  }

  if (record) {
    return (
      <View style={styles.doneBlock}>
        <View style={styles.doneLabel}>
          <Icon ios="checkmark.circle.fill" android="check_circle" size={18} color={colors.accent} />
          <Text variant="subhead" color="secondaryText" numberOfLines={1}>
            {label} downloaded
          </Text>
        </View>
        <Button
          title="Open in…"
          variant={prominent ? 'filled' : 'tinted'}
          onPress={() => void openInOtherApp(record)}
          accessibilityHint={`Opens the ${label} file in another app`}
        />
        <Button title="Show in Downloads" variant="plain" onPress={() => router.navigate('/downloads')} />
      </View>
    );
  }

  const title = `Download ${label}${size ? ` · ${size}` : ''}`;
  return (
    <View style={styles.doneBlock}>
      <Button
        title={title}
        variant={prominent ? 'filled' : 'tinted'}
        onPress={() => {
          clearFailure(acquisition.href);
          void startDownload(catalog, entry, acquisition);
        }}
      />
      {active?.status === 'failed' ? (
        <View style={styles.failure}>
          <Text variant="footnote" style={{ color: colors.danger }} accessibilityRole="alert">
            {active.message}
          </Text>
          {active.needsLogin ? (
            <Button
              title="Edit login"
              variant="plain"
              onPress={() => router.push({ pathname: '/catalog-form', params: { id: catalog.id } })}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
  },
  content: {
    paddingBottom: 48,
  },
  coverBox: {
    alignItems: 'center',
    paddingTop: space.l,
  },
  heading: {
    paddingHorizontal: space.xl,
    paddingTop: space.l,
    gap: space.xs,
  },
  center: {
    textAlign: 'center',
  },
  downloads: {
    paddingHorizontal: space.l,
    paddingTop: space.xl,
    gap: space.m,
  },
  noDownload: {
    gap: space.m,
  },
  doneBlock: {
    gap: space.xs,
  },
  doneLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: space.xs,
  },
  failure: {
    alignItems: 'center',
    paddingTop: space.xs,
  },
  card: {
    borderRadius: radius.button,
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.xs,
    gap: space.s,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
  },
  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  flex: {
    flex: 1,
  },
  section: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.s,
  },
  more: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
});
