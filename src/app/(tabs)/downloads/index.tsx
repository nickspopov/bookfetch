import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { openInOtherApp } from '@/features/open-file';
import { fileExists } from '@/lib/downloads/files';
import { downloadIndex, useDownloads, type DownloadRecord } from '@/lib/downloads/index-store';
import { deleteDownload } from '@/lib/downloads/manager';
import { cleanText, formatBytes } from '@/lib/text';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { CenteredMessage } from '@/ui/States';
import { Text } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

const ios = Platform.OS === 'ios';

function shortDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function confirmDelete(record: DownloadRecord) {
  Alert.alert(`Delete “${record.title}”?`, 'The file is removed from this phone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteDownload(record) },
  ]);
}

export default function DownloadsScreen() {
  const router = useRouter();
  const colors = useColors();
  const downloads = useDownloads();

  // Files deleted in the Files app disappear from the list when the tab comes back into view.
  useFocusEffect(
    useCallback(() => {
      downloadIndex.prune((record) => fileExists(record.fileName));
    }, []),
  );

  return (
    <FlatList
      data={downloads}
      keyExtractor={(record) => record.id}
      renderItem={({ item }) => <DownloadRow record={item} />}
      ItemSeparatorComponent={Separator}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={downloads.length === 0 ? styles.emptyList : styles.list}
      ListEmptyComponent={
        <CenteredMessage
          title="No downloads yet"
          message="Books you download appear here, ready to open in your reader."
        >
          <Button title="Browse your libraries" variant="tinted" onPress={() => router.navigate('/')} />
        </CenteredMessage>
      }
      ListFooterComponent={
        downloads.length > 0 ? (
          <Text variant="footnote" color="secondaryText" style={styles.footnote}>
            {ios
              ? 'Files are also in the Files app → On My iPhone → Bookfetch.'
              : 'Tap a book to open it in a reader app.'}
          </Text>
        ) : null
      }
    />
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.separator }]} />;
}

function DownloadRow({ record }: { record: DownloadRecord }) {
  const colors = useColors();
  const title = cleanText(record.title) || record.fileName;
  const author = record.authors
    .map((a) => cleanText(a))
    .filter(Boolean)
    .join(', ');
  const details = [record.formatLabel, formatBytes(record.size), record.catalogTitle, shortDate(record.downloadedAt)]
    .filter(Boolean)
    .join(' · ');
  const open = () => void openInOtherApp(record);

  const content = (
    <View style={[styles.row, { backgroundColor: colors.background }]}>
      <View style={[styles.badge, { backgroundColor: colors.fill }]}>
        <Icon ios="book.closed.fill" android="book" size={18} color={colors.accent} />
      </View>
      <View style={styles.texts}>
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        {author ? (
          <Text variant="subhead" color="secondaryText" numberOfLines={1}>
            {author}
          </Text>
        ) : null}
        {details ? (
          <Text variant="caption" color="tertiaryText" numberOfLines={1}>
            {details}
          </Text>
        ) : null}
      </View>
      <Icon ios="square.and.arrow.up" android="open_in_new" size={18} color={colors.tertiaryText} />
    </View>
  );

  const label = [title, author, details].filter(Boolean).join(', ');

  const row = ios ? (
    <Link
      href="/downloads"
      asChild
      onPress={(event) => {
        // The link exists only for its native context menu; a tap opens the file instead of navigating.
        event.preventDefault();
        open();
      }}
    >
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens in another app. Touch and hold for more options."
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
        >
          {content}
        </Pressable>
      </Link.Trigger>
      <Link.Menu>
        <Link.MenuAction title="Open in…" icon="square.and.arrow.up" onPress={open} />
        <Link.MenuAction title="Delete" icon="trash" destructive onPress={() => confirmDelete(record)} />
      </Link.Menu>
    </Link>
  ) : (
    <Pressable
      onPress={open}
      onLongPress={() => confirmDelete(record)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens in a reader app. Long-press to delete."
      accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
      onAccessibilityAction={(event) => event.nativeEvent.actionName === 'delete' && confirmDelete(record)}
      android_ripple={{ color: colors.cellPressed }}
    >
      {content}
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(_progress, _translation, swipeable) => (
        <Pressable
          onPress={() => {
            swipeable.close();
            confirmDelete(record);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${title}`}
          style={[styles.deleteAction, { backgroundColor: colors.danger }]}
        >
          <Icon ios="trash.fill" android="delete" size={20} color="#FFFFFF" />
          <Text variant="footnote" style={styles.deleteText}>
            Delete
          </Text>
        </Pressable>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: space.xl,
  },
  emptyList: {
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  footnote: {
    paddingHorizontal: space.l,
    paddingTop: space.l,
    textAlign: 'center',
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
