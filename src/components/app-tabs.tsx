import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const NativeTabsAny = NativeTabs as any;

  return (
    <NativeTabsAny
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabsAny.Trigger name="index">
        <NativeTabsAny.Trigger.Label>Home</NativeTabsAny.Trigger.Label>
        <NativeTabsAny.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabsAny.Trigger>

      <NativeTabsAny.Trigger name="explore">
        <NativeTabsAny.Trigger.Label>Explore</NativeTabsAny.Trigger.Label>
        <NativeTabsAny.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabsAny.Trigger>
    </NativeTabsAny>
  );
}
