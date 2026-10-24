import { Stack } from 'expo-router';

import { stackOptions, tabRootOptions } from '@/ui/stack';
import { useColors } from '@/ui/theme';

export default function LibrariesLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={stackOptions(colors)}>
      <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'Libraries' }} />
      <Stack.Screen name="catalog/[id]/feed" options={{ title: '' }} />
      <Stack.Screen name="catalog/[id]/book" options={{ title: '' }} />
    </Stack>
  );
}
