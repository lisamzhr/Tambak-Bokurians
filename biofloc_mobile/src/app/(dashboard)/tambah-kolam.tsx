import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { pondsService } from '../../services/ponds.service';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  primary: '#006a65',
  onPrimary: '#ffffff',
  primaryContainer: '#00b5ad',
  onPrimaryContainer: '#00403d',
  primaryFixedDim: '#4edbd2',
  surface: '#f8fafb',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#eceeef',
  surfaceContainerHigh: '#e6e8e9',
  onSurface: '#191c1d',
  onSurfaceVariant: '#3c4948',
  outline: '#6c7a78',
  outlineVariant: '#bbc9c7',
  error: '#ba1a1a',
} as const;

// ─── AnimatedPressable helper ─────────────────────────────────────────────────
function ScalePressable({
  style,
  onPress,
  children,
}: {
  style?: any;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.94, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }); }}
        onPress={onPress}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── SegmentedControl ─────────────────────────────────────────────────────────
interface SegmentedControlProps {
  options: { value: string; label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[];
  selected: string;
  onChange: (val: string) => void;
}

function SegmentedControl({ options, selected, onChange }: SegmentedControlProps) {
  return (
    <View style={styles.segmentedWrapper}>
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segmentItem, isActive && styles.segmentItemActive]}
          >
            <MaterialIcons
              name={opt.icon}
              size={18}
              color={isActive ? C.onPrimary : C.onSurfaceVariant}
            />
            <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── VolumeStepper ────────────────────────────────────────────────────────────
interface VolumeStepperProps {
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
}

function VolumeStepper({ value, onChange, step = 1, min = 0.5 }: VolumeStepperProps) {
  const numScale = useSharedValue(1);
  const numColor = useSharedValue(0); // 0 = onSurface, 1 = primary

  const handleStep = useCallback((delta: number) => {
    const next = Math.max(min, parseFloat((value + delta).toFixed(1)));
    onChange(next);
    // Micro-pop feedback
    numScale.value = withSpring(1.15, { damping: 12 }, (finished) => {
      if (finished) {
        numScale.value = withSpring(1, { damping: 14 });
      }
    });
    numColor.value = withTiming(1, { duration: 80 }, (finished) => {
      if (finished) {
        numColor.value = withTiming(0, { duration: 300 });
      }
    });
  }, [value, onChange, numScale, numColor, min]);

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numScale.value }],
    color: numColor.value === 1 ? C.primary : C.onSurface,
  }));

  return (
    <View style={styles.stepperRow}>
      <ScalePressable style={styles.stepperBtn} onPress={() => handleStep(-step)}>
        <MaterialIcons name="remove" size={22} color={C.primary} />
      </ScalePressable>

      <View style={styles.stepperValueRow}>
        <Animated.Text style={[styles.stepperValue, numStyle]}>
          {value.toFixed(0)}
        </Animated.Text>
        <Text style={styles.stepperUnit}>L</Text>
      </View>

      <ScalePressable style={styles.stepperBtn} onPress={() => handleStep(step)}>
        <MaterialIcons name="add" size={22} color={C.primary} />
      </ScalePressable>
    </View>
  );
}

// ─── FieldWrapper ─────────────────────────────────────────────────────────────
function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

// ─── TambahKolamScreen ────────────────────────────────────────────────────────
export default function TambahKolamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [namaKolam, setNamaKolam] = useState('');
  const [jenisHewan, setJenisHewan] = useState<'nila' | 'udang'>('nila');
  const [volume, setVolume] = useState(1500);
  const [loading, setLoading] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleLanjutkan = useCallback(async () => {
    if (!namaKolam.trim()) {
      Alert.alert('Error', 'Nama kolam tidak boleh kosong');
      return;
    }
    
    setLoading(true);
    try {
      const pondId = namaKolam.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
      const profileId = jenisHewan === 'nila' ? 'tilapia_freshwater' : 'vannamei_marine';
      
      await pondsService.createPond({
        pond_id: pondId,
        profile_id: profileId,
        name: namaKolam.trim(),
        volume_liters: volume,
      });
      
      Alert.alert('Sukses', 'Kolam berhasil ditambahkan', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal menambahkan kolam');
    } finally {
      setLoading(false);
    }
  }, [namaKolam, jenisHewan, volume, router]);

  const jenisOptions = [
    { value: 'nila', label: 'Nila', icon: 'water-drop' as const },
    { value: 'udang', label: 'Udang', icon: 'restaurant' as const },
  ];

  const ctaBtnScale = useSharedValue(1);
  const ctaAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaBtnScale.value }] }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surfaceContainerLowest} />

      {/* ── AppBar ── */}
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Profil Kolam Baru</Text>
      </View>

      {/* ── Scrollable Form ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={require('../../../assets/images/bg_tambak.jpeg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {/* Gradient overlay */}
          <View style={styles.heroOverlay} />
          {/* Caption */}
          <View style={styles.heroCaptionRow}>
            <MaterialIcons name="eco" size={14} color={C.primary} />
            <Text style={styles.heroCaption}>Lengkapi data untuk optimasi biofloc</Text>
          </View>
        </View>

        {/* ── Form Fields ── */}
        <View style={styles.formSection}>

          {/* Nama Kolam */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Nama Kolam" />
            <View style={styles.inputContainer}>
              <MaterialIcons name="water-drop" size={20} color={C.outline} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Kolam Biofloc A1"
                placeholderTextColor={`${C.outline}99`}
                value={namaKolam}
                onChangeText={setNamaKolam}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Jenis Hewan Budidaya */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Jenis Hewan Budidaya" />
            <SegmentedControl
              options={jenisOptions}
              selected={jenisHewan}
              onChange={(v) => setJenisHewan(v as 'nila' | 'udang')}
            />
          </View>

          {/* Volume Kolam */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Volume Kolam (Liter)" />
            <VolumeStepper value={volume} onChange={setVolume} step={100} min={100} />
          </View>

        </View>
      </ScrollView>

      {/* ── Fixed Bottom CTA ── */}
      <View style={[styles.bottomCTA, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Animated.View style={ctaAnimStyle}>
          <Pressable
            onPressIn={() => { ctaBtnScale.value = withSpring(0.97, { damping: 20 }); }}
            onPressOut={() => { ctaBtnScale.value = withSpring(1, { damping: 20 }); }}
            onPress={handleLanjutkan}
            style={styles.ctaButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.onPrimary} />
            ) : (
              <>
                <Text style={styles.ctaButtonText}>Lanjutkan</Text>
                <MaterialIcons name="arrow-forward" size={22} color={C.onPrimary} />
              </>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const APPBAR_HEIGHT = 56;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.surface,
  },

  // ── AppBar ──
  appBar: {
    backgroundColor: C.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  appBarTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: C.onSurface,
    marginLeft: 8,
    letterSpacing: -0.2,
  },

  // ── Scroll ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },

  // ── Hero Image ──
  heroContainer: {
    height: 160,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Gradient-like overlay: dark at bottom, light/transparent at top
    backgroundColor: 'rgba(0, 64, 61, 0.35)',
  },
  heroCaptionRow: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  heroCaption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.primary,
    letterSpacing: 0.3,
  },

  // ── Form ──
  formSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginLeft: 4,
  },

  // ── Text Input ──
  inputContainer: {
    height: 56,
    backgroundColor: C.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: C.outlineVariant,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  inputContainerFocused: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    // no extra style needed
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: Platform.OS === 'ios' ? undefined : 22,
    fontWeight: '500',
    color: C.onSurface,
    paddingVertical: 0,
  },

  // ── Segmented Control ──
  segmentedWrapper: {
    flexDirection: 'row',
    backgroundColor: C.surfaceContainer,
    borderRadius: 12,
    padding: 4,
    height: 52,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    gap: 6,
  },
  segmentItemActive: {
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    letterSpacing: 0.1,
  },
  segmentLabelActive: {
    color: C.onPrimary,
  },

  // ── Volume Stepper ──
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    backgroundColor: C.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: C.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stepperValue: {
    fontSize: 24,
    fontWeight: '700',
    color: C.onSurface,
    lineHeight: 30,
  },
  stepperUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: C.outline,
  },

  // ── Dropdown Button ──
  dropdownButton: {
    height: 56,
    backgroundColor: C.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: C.outlineVariant,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dropdownButtonPressed: {
    backgroundColor: C.surfaceContainerHigh,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
    color: C.onSurface,
    lineHeight: 22,
  },

  // ── Bottom CTA ──
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.surfaceContainer,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  ctaButton: {
    height: 56,
    backgroundColor: C.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onPrimary,
    letterSpacing: 0.1,
  },
});
