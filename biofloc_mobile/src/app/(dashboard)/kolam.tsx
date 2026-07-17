import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { pondsService, Pond } from '../../services/ponds.service';

// ─── Design Tokens (mirrored from Figma colour tokens) ───────────────────────
const C = {
  // Primary palette
  primary: '#006a65',
  onPrimary: '#ffffff',
  primaryContainer: '#00b5ad',          // header bg
  onPrimaryContainer: '#00403d',
  primaryFixedDim: '#4edbd2',           // greeting text

  // Surface
  surface: '#f8fafb',
  surfaceContainerLowest: '#ffffff',    // bottom nav bg
  surfaceContainer: '#eceeef',         // bottom nav border

  // On-surface
  onSurface: '#191c1d',
  onSurfaceVariant: '#3c4948',
  outline: '#6c7a78',

  // Secondary container (empty state icon bg)
  secondaryContainer: '#d0e7e6',

  // Shadow helpers
  shadowTeal: 'rgba(0,106,101,0.08)',
} as const;

// ─── Bottom nav tab definitions ───────────────────────────────────────────────
type TabItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconFilled?: React.ComponentProps<typeof MaterialIcons>['name'];
};

const TABS: TabItem[] = [
  { key: 'kolam',   label: 'Kolam',   icon: 'water',       iconFilled: 'water'      },
  { key: 'analisis',label: 'Analisis',icon: 'analytics',   iconFilled: 'analytics'  },
  { key: 'pasar',   label: 'Pasar',   icon: 'storefront',  iconFilled: 'storefront' },
  { key: 'profil',  label: 'Profil',  icon: 'person',      iconFilled: 'person'     },
];

// ─── BottomNav ────────────────────────────────────────────────────────────────
interface BottomNavProps {
  active: string;
  onPress: (key: string) => void;
  bottomInset: number;
}

function BottomNav({ active, onPress, bottomInset }: BottomNavProps) {
  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onPress(tab.key)}
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={tab.icon}
              size={24}
              color={isActive ? C.primary : C.onSurfaceVariant}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── WaterDropIcon (empty state) ──────────────────────────────────────────────
function WaterDropIcon() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    const interval = setInterval(() => {
      pulse.value = withTiming(1.06, { duration: 1000, easing: Easing.inOut(Easing.sin) });
      setTimeout(() => {
        pulse.value = withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) });
      }, 1000);
    }, 2200);
    return () => clearInterval(interval);
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.emptyIconContainer, animStyle]}>
      <MaterialIcons name="water" size={64} color={C.primary} style={{ opacity: 0.85 }} />
    </Animated.View>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────────────────
function FAB({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.fabWrapper, animStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.9, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        style={styles.fab}
      >
        <MaterialIcons name="add" size={32} color={C.onPrimary} />
      </Pressable>
    </Animated.View>
  );
}

// ─── KolamScreen ──────────────────────────────────────────────────────────────
export default function KolamScreen() {
  const insets = useSafeAreaInsets();

  // Entry animation for the empty-state card
  const cardOpacity = useSharedValue(0);
  const cardTranslate = useSharedValue(24);

  // Fetching state
  const { username } = useAuth();
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchPonds = async () => {
        setLoading(true);
        try {
          const data = await pondsService.listPonds();
          if (isActive) setPonds(data);
        } catch (error) {
          console.error("Failed to fetch ponds", error);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      fetchPonds();
      
      return () => {
        isActive = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!loading && ponds.length === 0) {
      const timeout = setTimeout(() => {
        cardOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
        cardTranslate.value = withSpring(0, { damping: 18, stiffness: 120 });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [loading, ponds.length, cardOpacity, cardTranslate]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslate.value }],
  }));

  const router = useRouter();

  const handleFAB = useCallback(() => {
    router.push('/(dashboard)/tambah-kolam');
  }, [router]);

  const handleTabPress = useCallback((key: string) => {
    // TODO: navigate to respective tab screens
    console.log('Tab pressed:', key);
  }, []);

  const BOTTOM_NAV_HEIGHT = 72;
  const FAB_BOTTOM = BOTTOM_NAV_HEIGHT + 20;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryContainer} />

      {/* ── Fixed Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Kolam Saya</Text>
        <Text style={styles.headerGreeting}>Halo, {username || 'Petambak'} 👋</Text>
      </View>

      {/* ── Main Content ── */}
      <View style={[
        styles.content,
        { paddingBottom: BOTTOM_NAV_HEIGHT + 24 },
        (loading || ponds.length === 0) && styles.centerContent
      ]}>
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} />
        ) : ponds.length === 0 ? (
          <Animated.View style={[styles.emptyCard, cardAnimStyle]}>
            {/* Water icon */}
            <WaterDropIcon />
            {/* Headline */}
            <Text style={styles.emptyTitle}>Belum ada kolam terdaftar</Text>
            {/* Body */}
            <Text style={styles.emptyBody}>
              Yuk tambahkan kolam pertamamu untuk mulai memantau kondisi air dan pertumbuhan ikan secara akurat.
            </Text>
            {/* Decorative info row */}
            <View style={styles.infoRow}>
              <MaterialIcons name="info-outline" size={14} color={C.outline} style={{ opacity: 0.7 }} />
              <Text style={styles.infoText}>Butuh bantuan pengaturan?</Text>
            </View>
          </Animated.View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
            {ponds.map((pond) => (
              <TouchableOpacity
                key={pond.pond_id}
                style={styles.pondCard}
                onPress={() => router.push(`/(dashboard)/pond/${pond.pond_id}` as any)}
                activeOpacity={0.8}
              >
                <View style={styles.pondCardContent}>
                  <Text style={styles.pondCardName}>{pond.name || pond.pond_id}</Text>
                  <View style={styles.pondCardBadges}>
                    <View style={styles.badge}>
                      <MaterialIcons name={pond.profile_id.includes('tilapia') ? 'water-drop' : 'restaurant'} size={14} color={C.primary} />
                      <Text style={styles.badgeText}>{pond.profile_id.replace('_', ' ')}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pond.volume_liters} m³</Text>
                    </View>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={C.outline} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── FAB ── */}
      <View style={[styles.fabPositioner, { bottom: FAB_BOTTOM + insets.bottom }]}>
        <FAB onPress={handleFAB} />
      </View>

      {/* ── Bottom Nav ── */}
      <BottomNav
        active="kolam"
        onPress={handleTabPress}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.surface,
  },

  // ── Header ──
  header: {
    backgroundColor: C.onPrimaryContainer,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    color: C.onPrimary,
    letterSpacing: -0.3,
  },
  headerGreeting: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: C.primaryFixedDim,
    marginTop: 2,
  },

  // ── Content ──
  content: {
    flex: 1,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  // ── Empty state card ──
  emptyCard: {
    alignItems: 'center',
    maxWidth: 312,
    width: '100%',
  },
  emptyIconContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: C.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    // Inner shadow via elevation
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: C.onSurface,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: C.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.65,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.outline,
    letterSpacing: 0.5,
  },

  // ── FAB ──
  fabPositioner: {
    position: 'absolute',
    right: 20,
    zIndex: 40,
  },
  fabWrapper: {
    borderRadius: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Bottom Nav ──
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'auto',
    minHeight: 72,
    backgroundColor: C.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: C.surfaceContainer,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    // Subtle top shadow
    shadowColor: C.shadowTeal,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 50,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  navLabelActive: {
    color: C.primary,
    opacity: 1,
  },

  // ── List styles ──
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 80, // for FAB
    gap: 16,
  },
  pondCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.surfaceContainer,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pondCardContent: {
    flex: 1,
  },
  pondCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: C.onSurface,
    marginBottom: 8,
  },
  pondCardBadges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    textTransform: 'capitalize',
  },
});
