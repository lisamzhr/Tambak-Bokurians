import { Stack } from 'expo-router';

/**
 * Dashboard group layout.
 * The bottom navigation bar is rendered inside each dashboard screen
 * so each screen has full control over its layout.
 * Header is hidden globally for all dashboard screens.
 */
export default function DashboardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
