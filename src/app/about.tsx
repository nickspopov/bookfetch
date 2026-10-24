import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_BUILD, APP_VERSION, LINKS } from '@/lib/app-info';
import { Row, Section } from '@/ui/List';
import { SheetHeader } from '@/ui/SheetHeader';
import { Text } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

const icon = require('../../assets/images/icon.png');

export default function AboutScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const open = (url: string) => void Linking.openURL(url);

  return (
    <View style={{ backgroundColor: colors.groupedBackground, paddingBottom: Math.max(insets.bottom, space.l) }}>
      <SheetHeader title="About" onClose={() => router.back()} />
      <View style={styles.hero}>
        <Image source={icon} style={styles.icon} accessible={false} />
        <Text variant="title3" accessibilityRole="header">
          Bookfetch {APP_VERSION} (build {APP_BUILD})
        </Text>
        <Text variant="subhead" color="secondaryText" style={styles.center}>
          Bookfetch connects to OPDS book catalogs you add and downloads books to open in the reader you choose. It has
          no built-in reader, no account, and no tracking.
        </Text>
      </View>
      <Section style={styles.links} footer="You're responsible for the catalogs you add and the books you download.">
        <Row
          title="Privacy policy"
          external
          onPress={() => open(LINKS.privacy)}
          accessibilityHint="Opens in your browser"
        />
        <Row title="Support" external onPress={() => open(LINKS.support)} accessibilityHint="Opens in your browser" />
        <Row
          title="Source code"
          external
          onPress={() => open(LINKS.source)}
          accessibilityHint="Opens in your browser"
        />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingHorizontal: space.xl,
    gap: space.s,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: space.xs,
  },
  center: {
    textAlign: 'center',
  },
  links: {
    marginTop: space.l,
  },
});
