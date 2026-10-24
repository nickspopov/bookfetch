import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from './Icon';
import { useColors } from './theme';

export interface CoverProps {
  uri?: string;
  headers?: Record<string, string>;
  width: number;
  height: number;
  /** "contain" keeps the whole cover visible (book page); thumbnails fill their box */
  fit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
}

export function Cover({ uri, headers, width, height, fit = 'cover', style }: CoverProps) {
  const colors = useColors();
  const [failed, setFailed] = useState<string | undefined>();
  const [loaded, setLoaded] = useState<string | undefined>();
  const showImage = !!uri && failed !== uri;
  const placeholder = !showImage || loaded !== uri;
  return (
    <View
      style={[
        styles.box,
        { width, height, backgroundColor: placeholder || fit === 'cover' ? colors.placeholder : 'transparent' },
        style,
      ]}
      accessibilityIgnoresInvertColors
      importantForAccessibility="no-hide-descendants"
    >
      {placeholder ? (
        <Icon ios="book.closed" android="book" size={Math.min(28, width * 0.45)} color={colors.tertiaryText} />
      ) : null}
      {showImage ? (
        <Image
          source={{ uri, headers }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          transition={150}
          recyclingKey={uri}
          cachePolicy="memory-disk"
          onLoad={() => setLoaded(uri)}
          onError={() => setFailed(uri)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
