import { Stack } from 'expo-router';

import { stackOptions, tabRootOptions } from '@/ui/stack';
import { useColors } from '@/ui/theme';

export default function DownloadsLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={stackOptions(colors)}>
      <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'Downloads' }} />
    </Stack>
  );
}
