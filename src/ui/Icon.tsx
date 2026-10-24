import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export interface IconProps {
  /** SF Symbol on iOS */
  ios: SFSymbol;
  /** Material Symbol on Android */
  android: AndroidSymbol;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/** SF Symbols on iOS, Material Symbols on Android; never an SF name on Android. */
export function Icon({ ios, android, size = 22, color, style }: IconProps) {
  return (
    <SymbolView
      name={{ ios, android }}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
