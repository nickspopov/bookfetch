import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { radius, space, useColors } from './theme';

export function Section({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.section, style]}>
      {header ? (
        <Text variant="footnote" color="secondaryText" style={styles.header} accessibilityRole="header">
          {Platform.OS === 'ios' ? header.toUpperCase() : header}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: colors.cell }]}>
        {items.map((child, index) => (
          <Fragment key={child.key ?? index}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: colors.separator }]} /> : null}
            {child}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? (
        <Text variant="footnote" color="secondaryText" style={styles.footer}>
          {footer}
        </Text>
      ) : (
        footer
      )}
    </View>
  );
}

export interface RowProps {
  title: string;
  subtitle?: string;
  /** shown on the trailing side, e.g. a value */
  detail?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  external?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  titleLines?: number;
  subtitleLines?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  destructive?: boolean;
  testID?: string;
}

export function Row({
  title,
  subtitle,
  detail,
  leading,
  trailing,
  chevron,
  external,
  onPress,
  onLongPress,
  titleLines = 1,
  subtitleLines = 1,
  accessibilityLabel,
  accessibilityHint,
  destructive,
  testID,
}: RowProps) {
  const colors = useColors();
  const content = (
    <>
      {leading}
      <View style={styles.texts}>
        <Text
          variant="body"
          numberOfLines={titleLines}
          style={destructive ? { color: colors.danger } : external ? { color: colors.accent } : undefined}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subhead" color="secondaryText" numberOfLines={subtitleLines}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text variant="body" color="secondaryText" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      {trailing}
      {chevron ? <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.tertiaryText} /> : null}
      {external ? <Icon ios="arrow.up.right" android="open_in_new" size={14} color={colors.tertiaryText} /> : null}
    </>
  );
  if (!onPress && !onLongPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={accessibilityLabel} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: colors.cellPressed }}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        Platform.OS === 'ios' && pressed ? { backgroundColor: colors.cellPressed } : undefined,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: space.l,
    marginTop: space.xl,
  },
  header: {
    marginHorizontal: space.l,
    marginBottom: 6,
  },
  footer: {
    marginHorizontal: space.l,
    marginTop: 6,
  },
  group: {
    borderRadius: radius.cell,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.l,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: 11,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
