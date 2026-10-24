import { Pressable, StyleSheet } from 'react-native';
import type { AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from './Icon';
import { useColors } from './theme';

export function HeaderIconButton({
  ios,
  android,
  label,
  onPress,
  testID,
}: {
  ios: SFSymbol;
  android: AndroidSymbol;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      testID={testID}
      android_ripple={{ color: colors.cellPressed, borderless: true, radius: 20 }}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : undefined]}
    >
      <Icon ios={ios} android={android} size={22} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
});
