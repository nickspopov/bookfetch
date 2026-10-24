import { Platform, useColorScheme } from 'react-native';

export interface Colors {
  accent: string;
  onAccent: string;
  background: string;
  groupedBackground: string;
  cell: string;
  cellPressed: string;
  text: string;
  secondaryText: string;
  tertiaryText: string;
  separator: string;
  placeholder: string;
  danger: string;
  fill: string;
}

// System look: iOS system colors on iOS, Material 3 neutral surfaces on Android.
const ios: Record<'light' | 'dark', Colors> = {
  light: {
    accent: '#2F6FDE',
    onAccent: '#FFFFFF',
    background: '#FFFFFF',
    groupedBackground: '#F2F2F7',
    cell: '#FFFFFF',
    cellPressed: '#E5E5EA',
    text: '#000000',
    secondaryText: '#3C3C4399',
    tertiaryText: '#3C3C434D',
    separator: '#3C3C4349',
    placeholder: '#E5E5EA',
    danger: '#FF3B30',
    fill: '#7878801F',
  },
  dark: {
    accent: '#6EA0FF',
    onAccent: '#0B1B33',
    background: '#000000',
    groupedBackground: '#000000',
    cell: '#1C1C1E',
    cellPressed: '#2C2C2E',
    text: '#FFFFFF',
    secondaryText: '#EBEBF599',
    tertiaryText: '#EBEBF54D',
    separator: '#54545899',
    placeholder: '#2C2C2E',
    danger: '#FF453A',
    fill: '#7878803D',
  },
};

const android: Record<'light' | 'dark', Colors> = {
  light: {
    ...ios.light,
    background: '#FDFBFF',
    groupedBackground: '#F4F3F8',
    cell: '#FDFBFF',
    cellPressed: '#E6E5EB',
    text: '#1B1B1F',
    secondaryText: '#46464F',
    tertiaryText: '#77767F',
    separator: '#C7C5D0',
    danger: '#BA1A1A',
  },
  dark: {
    ...ios.dark,
    background: '#121316',
    groupedBackground: '#121316',
    cell: '#1E1F23',
    cellPressed: '#2A2B30',
    text: '#E4E2E6',
    secondaryText: '#C7C5D0',
    tertiaryText: '#918F9A',
    separator: '#46464F',
    danger: '#FFB4AB',
  },
};

export type Scheme = 'light' | 'dark';

export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function colorsFor(scheme: Scheme): Colors {
  return (Platform.OS === 'ios' ? ios : android)[scheme];
}

export function useColors(): Colors {
  return colorsFor(useScheme());
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { cell: Platform.OS === 'ios' ? 12 : 16, button: Platform.OS === 'ios' ? 12 : 20 } as const;
