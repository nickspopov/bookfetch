import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { Entry, Feed } from '@/opds';
import { useCatalog } from '@/lib/catalogs';
import type { CatalogSession } from '@/lib/client';
import { describeError } from '@/lib/errors';
import { getSearchSource, putEntry, putFeedPage, putSearchSource, resolveFeedPage, takeFeed } from '@/lib/nav-store';
import { cleanText, formatBytes } from '@/lib/text';
import { useCatalogSession } from '@/lib/use-session';
import { Button } from '@/ui/Button';
import { Cover } from '@/ui/Cover';
import { Icon } from '@/ui/Icon';
import { CenteredMessage, ErrorState, Loading } from '@/ui/States';
import { Text } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

// `page` and `search` are nav-store tokens: feed URLs can carry an API key, so they never go into a route.
type Params = { id: string; page?: string; search?: string; q?: string };

interface ListState {
  feed?: Feed;
  entries: Entry[];
  next?: string;
  error?: unknown;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  moreError?: string;
}

const INITIAL: ListState = { entries: [], loading: true, refreshing: false, loadingMore: false };

const entryKey = (entry: Entry) =>
  `${entry.id}|${entry.navigation?.href ?? entry.acquisitions[0]?.href ?? entry.title}`;

const isBook = (entry: Entry) => entry.acquisitions.length > 0 || !entry.navigation;

export default function FeedScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const colors = useColors();
  const catalog = useCatalog(params.id);
  const { session, error: sessionError } = useCatalogSession(catalog);
  const [state, setState] = useState<ListState>(INITIAL);
  const seen = useRef(new Set<string>());
  const visited = useRef(new Set<string>());
  const isSearch = !!params.q;
  const query = params.q ?? '';
  const target = useMemo(() => resolveFeedPage(params.id, params.page), [params.id, params.page]);
  const pageUrl = target.kind === 'page' ? target.url : undefined;
  const pageGone = !isSearch && target.kind === 'gone';

  const load = useCallback(
    async (session: CatalogSession, mode: 'initial' | 'refresh') => {
      setState((s) => ({ ...s, loading: mode === 'initial', refreshing: mode === 'refresh', error: undefined }));
      try {
        let feed: Feed;
        if (isSearch) {
          const source = getSearchSource(params.search);
          if (!source) throw new Error('Search source is gone');
          feed = await session.client.search(source, query);
        } else {
          const url = pageUrl ?? session.rootUrl;
          feed = (mode === 'initial' ? takeFeed(params.id, url) : undefined) ?? (await session.client.fetchFeed(url));
        }
        seen.current = new Set();
        visited.current = new Set([feed.url]);
        const entries = feed.entries.filter((e) => addSeen(seen.current, e));
        setState({
          feed,
          entries,
          next: nextUrl(feed, visited.current),
          loading: false,
          refreshing: false,
          loadingMore: false,
        });
      } catch (error) {
        setState((s) => ({ ...s, error, loading: false, refreshing: false }));
      }
    },
    [isSearch, params.search, pageUrl, params.id, query],
  );

  useEffect(() => {
    if (session && !pageGone) void load(session, 'initial');
  }, [session, load, pageGone]);

  const loadMore = useCallback(
    async (retry = false) => {
      if (!session || !state.next || state.loadingMore || (state.moreError && !retry)) return;
      const url = state.next;
      setState((s) => ({ ...s, loadingMore: true, moreError: undefined }));
      try {
        const page = await session.client.fetchFeed(url);
        visited.current.add(url);
        visited.current.add(page.url);
        const fresh = page.entries.filter((e) => addSeen(seen.current, e));
        setState((s) => ({
          ...s,
          entries: [...s.entries, ...fresh],
          // A page that brings nothing new ends the list, so a looping "next" link cannot spin forever.
          next: fresh.length > 0 ? nextUrl(page, visited.current) : undefined,
          loadingMore: false,
        }));
      } catch (error) {
        setState((s) => ({
          ...s,
          loadingMore: false,
          moreError: describeError(error, session.sentCredentials).message,
        }));
      }
    },
    [session, state.next, state.loadingMore, state.moreError],
  );

  const openEntry = useCallback(
    (entry: Entry) => {
      if (!isBook(entry) && entry.navigation) {
        router.push({
          pathname: '/catalog/[id]/feed',
          params: { id: params.id, page: putFeedPage(params.id, entry.navigation.href) },
        });
      } else {
        router.push({ pathname: '/catalog/[id]/book', params: { id: params.id, token: putEntry(params.id, entry) } });
      }
    },
    [router, params.id],
  );

  const feed = state.feed;
  // The root shows the catalog's (user-editable) name; sections show their feed titles.
  const title = isSearch
    ? `“${query}”`
    : (target.kind === 'root' && catalog?.title) || cleanText(feed?.title) || catalog?.title || '';
  const canSearch = !isSearch && !!feed?.search;

  const screenOptions = (
    <Stack.Screen
      options={{
        title,
        headerSearchBarOptions: canSearch
          ? {
              placeholder: 'Search this catalog',
              autoCapitalize: 'none',
              hideWhenScrolling: false,
              tintColor: colors.accent,
              textColor: colors.text,
              headerIconColor: colors.text,
              hintTextColor: colors.secondaryText,
              onSearchButtonPress: (event) => {
                const q = event.nativeEvent.text.trim();
                if (!q || !feed) return;
                router.push({
                  pathname: '/catalog/[id]/feed',
                  params: { id: params.id, search: putSearchSource(feed), q },
                });
              },
            }
          : undefined,
      }}
    />
  );

  if (!catalog) {
    return (
      <Scroll>
        {screenOptions}
        <CenteredMessage title="Catalog removed" message="This catalog is no longer in your libraries.">
          <Button title="Back to Libraries" variant="tinted" onPress={() => router.dismissTo('/')} />
        </CenteredMessage>
      </Scroll>
    );
  }

  if (pageGone) {
    return (
      <Scroll>
        {screenOptions}
        <CenteredMessage title="This page is no longer open" message="Go back to the catalog and open it again.">
          <Button
            title="Back to catalog"
            variant="tinted"
            onPress={() => router.dismissTo({ pathname: '/catalog/[id]/feed', params: { id: catalog.id } })}
          />
        </CenteredMessage>
      </Scroll>
    );
  }

  const error = sessionError ?? state.error;
  if (error && !feed) {
    const sent = session?.sentCredentials ?? catalog.hasCredentials;
    const copy =
      error instanceof Error && error.message === 'Search source is gone'
        ? { message: 'This search has expired. Go back and search again.', needsLogin: false }
        : describeError(error, sent);
    return (
      <Scroll>
        {screenOptions}
        <ErrorState
          message={copy.message}
          onRetry={() => (session ? void load(session, 'initial') : router.back())}
          extraAction={
            copy.needsLogin || sessionError
              ? {
                  title: 'Edit login',
                  onPress: () => router.push({ pathname: '/catalog-form', params: { id: catalog.id } }),
                }
              : undefined
          }
        />
      </Scroll>
    );
  }

  if (!feed) {
    return (
      <Scroll>
        {screenOptions}
        <Loading label={isSearch ? 'Searching' : 'Loading catalog'} />
      </Scroll>
    );
  }

  return (
    <>
      {screenOptions}
      <FlatList
        data={state.entries}
        keyExtractor={(entry, index) => `${index}:${entry.id}`}
        renderItem={({ item }) => <EntryRow entry={item} session={session} onPress={openEntry} />}
        ItemSeparatorComponent={Separator}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={state.entries.length === 0 ? styles.emptyList : styles.list}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        initialNumToRender={14}
        windowSize={11}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => session && void load(session, 'refresh')}
            tintColor={colors.secondaryText}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          isSearch ? (
            <CenteredMessage title={`No books found for “${query}”.`} message="Try a shorter or different search." />
          ) : (
            <CenteredMessage title="Nothing here yet" message="This part of the catalog is empty." />
          )
        }
        ListFooterComponent={
          state.loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.secondaryText} accessibilityLabel="Loading more" />
            </View>
          ) : state.moreError ? (
            <View style={styles.footer}>
              <Text variant="footnote" color="secondaryText" style={styles.footerText}>
                {state.moreError}
              </Text>
              <Button title="Load more" variant="plain" onPress={() => void loadMore(true)} />
            </View>
          ) : null
        }
      />
    </>
  );
}

function addSeen(seen: Set<string>, entry: Entry) {
  const key = entryKey(entry);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

function nextUrl(feed: Feed, visited: Set<string>) {
  return feed.next && !visited.has(feed.next) ? feed.next : undefined;
}

function Scroll({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.grow}
      style={{ backgroundColor: colors.background }}
    >
      {children}
    </ScrollView>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.separator }]} />;
}

const EntryRow = memo(function EntryRow({
  entry,
  session,
  onPress,
}: {
  entry: Entry;
  session?: CatalogSession;
  onPress: (entry: Entry) => void;
}) {
  const colors = useColors();
  const title = cleanText(entry.title) || 'Untitled';

  if (!isBook(entry)) {
    const summary = cleanText(entry.summary);
    return (
      <Pressable
        onPress={() => onPress(entry)}
        accessibilityRole="button"
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        android_ripple={{ color: colors.cellPressed }}
        style={({ pressed }) => [
          styles.navRow,
          Platform.OS === 'ios' && pressed ? { backgroundColor: colors.cellPressed } : undefined,
        ]}
      >
        <View style={styles.texts}>
          <Text variant="body" numberOfLines={2}>
            {title}
          </Text>
          {summary ? (
            <Text variant="subhead" color="secondaryText" numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.tertiaryText} />
      </Pressable>
    );
  }

  const authors = entry.authors
    .map((a) => cleanText(a))
    .filter(Boolean)
    .join(', ');
  const downloadable = entry.acquisitions.filter((a) => a.downloadable);
  const formats = [
    ...[...new Set(downloadable.map((a) => a.formatLabel))].filter(Boolean).slice(0, 4),
    formatBytes(downloadable[0]?.size),
  ]
    .filter(Boolean)
    .join(' · ');
  const image = entry.thumbnailUrl ?? entry.coverUrl;
  return (
    <Pressable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={[title, authors, formats].filter(Boolean).join(', ')}
      android_ripple={{ color: colors.cellPressed }}
      style={({ pressed }) => [
        styles.bookRow,
        Platform.OS === 'ios' && pressed ? { backgroundColor: colors.cellPressed } : undefined,
      ]}
    >
      <Cover
        uri={session ? image : undefined}
        headers={image && session ? session.client.headersFor(image) : undefined}
        width={44}
        height={66}
      />
      <View style={styles.texts}>
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        {authors ? (
          <Text variant="subhead" color="secondaryText" numberOfLines={1}>
            {authors}
          </Text>
        ) : null}
        {formats ? (
          <Text variant="caption" color="tertiaryText" numberOfLines={1}>
            {formats}
          </Text>
        ) : null}
      </View>
      <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.tertiaryText} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
  },
  list: {
    paddingBottom: space.xl,
  },
  emptyList: {
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.l,
  },
  navRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: 10,
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: 10,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: space.l,
    paddingHorizontal: space.xl,
    gap: space.xs,
  },
  footerText: {
    textAlign: 'center',
  },
});
