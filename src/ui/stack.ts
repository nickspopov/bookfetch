import type { NativeStackNavigationOptions } from 'expo-router';
import { Platform } from 'react-native';

import type { Colors } from './theme';

const ios = Platform.OS === 'ios';
const liquidGlass = ios && parseInt(String(Platform.Version), 10) >= 26;

/**
 * Native stack defaults for the tab stacks: system headers that content scrolls under (scroll views use
 * contentInsetAdjustmentBehavior="automatic"), accent tint, minimal back buttons.
 */
export function stackOptions(colors: Colors): NativeStackNavigationOptions {
  return {
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.text },
    headerLargeTitleShadowVisible: false,
    headerTransparent: ios,
    headerBlurEffect: ios && !liquidGlass ? 'systemChromeMaterial' : undefined,
    headerShadowVisible: ios ? undefined : false,
    headerStyle: ios ? undefined : { backgroundColor: colors.background },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.groupedBackground },
  };
}

export const tabRootOptions: NativeStackNavigationOptions = {
  headerLargeTitleEnabled: true,
};
