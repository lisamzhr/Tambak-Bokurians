import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Login screen — no tab bar, full-screen */}
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        {/* Dashboard group — has its own bottom nav */}
        <Stack.Screen name="(dashboard)" options={{ animation: 'fade' }} />
      </Stack>
    </ThemeProvider>
  );
}
