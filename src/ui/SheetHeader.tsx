import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { space, useColors } from './theme';

/** Title row for form sheets: close on the leading side, an optional action on the trailing side. */
export function SheetHeader({ title, onClose, action }: { title: string; onClose: () => void; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={({ pressed }) => [styles.close, { backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon ios="xmark" android="close" size={15} color={colors.secondaryText} />
        </Pressable>
      </View>
      <Text variant="headline" numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.side, styles.trailing]}>{action}</View>
    </View>
  );
}

export function SheetAction({
  title,
  onPress,
  busy,
  disabled,
  testID,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const inactive = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: !!busy }}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      {busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Text variant="headline" style={{ color: colors.accent }} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: space.l,
    paddingTop: space.s,
  },
  side: {
    width: 96,
  },
  trailing: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    minHeight: 36,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
