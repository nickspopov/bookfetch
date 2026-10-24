import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { clearPartialDownloads } from '@/lib/downloads/files';
import { colorsFor, useScheme, type Scheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

function navigationTheme(scheme: Scheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = colorsFor(scheme);
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.groupedBackground,
      card: colors.background,
      text: colors.text,
      border: colors.separator,
    },
  };
}

export default function RootLayout() {
  const scheme = useScheme();
  const colors = colorsFor(scheme);

  useEffect(() => {
    clearPartialDownloads();
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navigationTheme(scheme)}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.groupedBackground } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="catalog-form"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetGrabberVisible: true,
              sheetAllowedDetents: [1],
              contentStyle: { backgroundColor: colors.groupedBackground },
            }}
          />
          <Stack.Screen
            name="about"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetGrabberVisible: true,
              sheetAllowedDetents: 'fitToContents',
              contentStyle: { backgroundColor: colors.groupedBackground },
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
