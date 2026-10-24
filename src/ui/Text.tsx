import { Platform, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useColors, type Colors } from './theme';

const ios = Platform.OS === 'ios';

// Line heights always exceed font sizes so glyphs never clip; both scale with Dynamic Type / font scale.
export const textStyles = {
  largeTitle: { fontSize: ios ? 34 : 32, lineHeight: ios ? 41 : 40, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: ios ? 17 : 16, lineHeight: ios ? 22 : 24 },
  callout: { fontSize: 16, lineHeight: 21 },
  subhead: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textStyles;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: keyof Colors;
}

export function Text({ variant = 'body', color = 'text', style, ...props }: TextProps) {
  const colors = useColors();
  return <RNText {...props} style={[textStyles[variant], { color: colors[color] }, style]} />;
}
