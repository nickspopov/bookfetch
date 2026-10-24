import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { radius, useColors } from './theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'filled' | 'tinted' | 'plain' | 'destructive';
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'filled',
  busy = false,
  disabled = false,
  icon,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const colors = useColors();
  const inactive = disabled || busy;
  const background =
    variant === 'filled'
      ? colors.accent
      : variant === 'tinted' || variant === 'destructive'
        ? colors.fill
        : 'transparent';
  const foreground = variant === 'filled' ? colors.onAccent : variant === 'destructive' ? colors.danger : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      // The label stays while busy so VoiceOver/TalkBack still announce what the button does.
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
      android_ripple={variant === 'plain' ? undefined : { color: colors.cellPressed }}
      style={({ pressed }) => [
        styles.base,
        variant === 'plain' && styles.plain,
        { backgroundColor: background, opacity: disabled && !busy ? 0.45 : pressed && Platform.OS === 'ios' ? 0.7 : 1 },
        style,
      ]}
    >
      <View style={styles.content}>
        {busy ? <ActivityIndicator color={foreground} /> : icon}
        <Text variant="headline" style={{ color: foreground }} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plain: {
    minHeight: 44,
    paddingHorizontal: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
