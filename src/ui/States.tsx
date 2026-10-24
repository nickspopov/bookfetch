import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { space, useColors } from './theme';

export function CenteredMessage({
  icon,
  title,
  message,
  children,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      {icon}
      <Text variant="title3" style={styles.centerText} accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="secondaryText" style={styles.centerText}>
          {message}
        </Text>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  extraAction,
}: {
  message: string;
  onRetry: () => void;
  extraAction?: { title: string; onPress: () => void };
}) {
  return (
    <CenteredMessage title="Couldn't open this page" message={message}>
      <Button title="Try again" onPress={onRetry} variant="tinted" />
      {extraAction ? <Button title={extraAction.title} onPress={extraAction.onPress} variant="plain" /> : null}
    </CenteredMessage>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.center} accessible accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.secondaryText} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    paddingTop: 48,
    // Sit slightly above the middle, like system empty states, rather than drifting toward the tab bar.
    paddingBottom: 140,
    gap: space.s,
  },
  centerText: {
    textAlign: 'center',
  },
  actions: {
    marginTop: space.l,
    alignSelf: 'stretch',
    gap: space.s,
  },
});
