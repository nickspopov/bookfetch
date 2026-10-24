import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useColors } from '@/ui/theme';

export default function TabsLayout() {
  const colors = useColors();
  const android = Platform.OS === 'android';
  return (
    <NativeTabs
      tintColor={colors.accent}
      backgroundColor={android ? colors.background : undefined}
      iconColor={android ? { default: colors.secondaryText, selected: colors.accent } : undefined}
      labelStyle={android ? { default: { color: colors.secondaryText }, selected: { color: colors.text } } : undefined}
      indicatorColor={android ? colors.fill : undefined}
    >
      <NativeTabs.Trigger name="(libraries)">
        <NativeTabs.Trigger.Label>Libraries</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="books.vertical" md="library_books" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="downloads">
        <NativeTabs.Trigger.Label>Downloads</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.down.circle" md="download_for_offline" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
