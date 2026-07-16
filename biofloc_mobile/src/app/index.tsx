import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Image,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// ─── Design Tokens (from Figma / tailwind config) ────────────────────────────
const C = {
  oceanTeal: '#00B5AD',
  mistBlue: '#E6F6F5',
  shellWhite: '#F4F7F1',
  deepOcean: '#0D2B45',
  freshGreen: '#2ECC71',
  slateGray: '#708090',
  white: '#FFFFFF',
  deepOcean10: 'rgba(13,43,69,0.10)',
  deepOcean5: 'rgba(13,43,69,0.05)',
  slateGray20: 'rgba(112,128,144,0.20)',
  slateGray50: 'rgba(112,128,144,0.50)',
  slateGray60: 'rgba(112,128,144,0.60)',
  slateGray70: 'rgba(112,128,144,0.70)',
  oceanTeal20: 'rgba(0,181,173,0.20)',
  mistBlue50: 'rgba(230,246,245,0.50)',
} as const;

// ─── LogoIcon: tambak logo image ─────────────────────────────────────────────
function WaveIcon() {
  return (
    <Image
      source={require('../../assets/images/logo_tambak.jpeg')}
      style={styles.logoImage}
      resizeMode="cover"
    />
  );
}

// ─── InputField ───────────────────────────────────────────────────────────────
interface InputFieldProps {
  label: string;
  placeholder: string;
  iconLabel: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  rightElement?: React.ReactNode;
}

function InputField({
  label,
  placeholder,
  secureTextEntry = false,
  value,
  onChangeText,
  rightElement,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          focused && styles.inputContainerFocused,
        ]}
      >
        {/* Left icon placeholder — using a colored dot as icon stand-in */}
        <View style={styles.inputIconDot} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={C.slateGray50}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {rightElement}
      </View>
    </View>
  );
}

// ─── Divider with label ───────────────────────────────────────────────────────
function DividerWithLabel({ label }: { label: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── SocialButton ─────────────────────────────────────────────────────────────
function SocialButton({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.88, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={styles.socialButton}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── PrimaryButton ────────────────────────────────────────────────────────────
function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.primaryButtonWrapper, animStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 20 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20 }); }}
        onPress={onPress}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
        {/* Arrow → */}
        <Text style={styles.primaryButtonArrow}>→</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── SecondaryButton ──────────────────────────────────────────────────────────
function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 20 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20 }); }}
        onPress={onPress}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const router = useRouter();

  const handleLogin = useCallback(() => {
    router.replace('/(dashboard)/kolam');
  }, [router]);

  const handleRegister = useCallback(() => {
    router.replace('/(dashboard)/kolam');
  }, [router]);

  return (
    <View style={styles.root}>
      {/* ── Top Banner ── */}
      <View style={styles.banner}>
        {/* Decorative circles for depth */}
        <View style={styles.bannerCircle1} />
        <View style={styles.bannerCircle2} />
        <View style={styles.bannerCircle3} />

        {/* Wave ripple rows */}
        <View style={styles.rippleRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.ripple,
                { width: 60 + i * 30, height: 60 + i * 30, opacity: 0.08 - i * 0.015 },
              ]}
            />
          ))}
        </View>

        {/* Center logo tile */}
        <View style={styles.logoTile}>
          <WaveIcon />
        </View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Headline card – overlaps the banner */}
        <View style={styles.headlineCard}>
          <Text style={styles.headlineTitle}>Selamat Datang di Tambak</Text>
          <Text style={styles.headlineSubtitle}>Masuk untuk mulai memantau kolammu</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {/* Identifier */}
          <InputField
            label="Nomor HP / Email"
            placeholder="Masukkan nomor atau email"
            iconLabel="person"
            value={identifier}
            onChangeText={setIdentifier}
          />

          {/* Password */}
          <InputField
            label="Kata Sandi"
            placeholder="Masukkan kata sandi"
            iconLabel="lock"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            rightElement={
              <TouchableOpacity onPress={togglePassword} style={styles.eyeButton} hitSlop={8}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            }
          />

          {/* Forgot password */}
          <View style={styles.forgotRow}>
            <TouchableOpacity hitSlop={8}>
              <Text style={styles.forgotText}>Lupa Kata Sandi?</Text>
            </TouchableOpacity>
          </View>

          {/* CTA buttons */}
          <View style={styles.ctaSection}>
            <PrimaryButton label="Masuk" onPress={handleLogin} />
            <SecondaryButton label="Daftar Akun Baru" onPress={handleRegister} />
          </View>
        </View>

        {/* Social login */}
        <View style={styles.socialSection}>
          <DividerWithLabel label="ATAU MASUK DENGAN" />
          <View style={styles.socialRow}>
            <SocialButton>
              {/* Google "G" wordmark stand-in */}
              <Text style={styles.socialGoogleText}>G</Text>
            </SocialButton>
            <SocialButton>
              {/* Apple icon via @expo/vector-icons (cross-platform) */}
              <FontAwesome name="apple" size={24} color="#000000" />
            </SocialButton>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Butuh bantuan?{' '}
            <Text style={styles.footerLink}>Hubungi Support</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const BANNER_HEIGHT = 300;
const CARD_OVERLAP = 56;
const BORDER_RADIUS_2XL = 16;
const BORDER_RADIUS_4XL = 32;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.shellWhite,
  },

  // ── Banner ──
  banner: {
    width: '100%',
    height: BANNER_HEIGHT,
    backgroundColor: C.mistBlue,
    borderBottomLeftRadius: BORDER_RADIUS_4XL,
    borderBottomRightRadius: BORDER_RADIUS_4XL,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bannerCircle1: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.oceanTeal,
    opacity: 0.07,
    top: -60,
    right: -40,
  },
  bannerCircle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: C.oceanTeal,
    opacity: 0.06,
    bottom: -30,
    left: -30,
  },
  bannerCircle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.deepOcean,
    opacity: 0.04,
    top: 40,
    left: 50,
  },
  rippleRow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: C.oceanTeal,
  },
  logoTile: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.oceanTeal,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle tilt
    transform: [{ rotate: '-3deg' }],
    shadowColor: C.oceanTeal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },

  // ── Scroll ──
  scrollView: {
    flex: 1,
    marginTop: -CARD_OVERLAP,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  // ── Headline card ──
  headlineCard: {
    backgroundColor: C.white,
    borderRadius: BORDER_RADIUS_4XL,
    padding: 24,
    marginBottom: 16,
    shadowColor: C.deepOcean,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  headlineTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: C.deepOcean,
    marginBottom: 8,
  },
  headlineSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: C.slateGray,
  },

  // ── Form ──
  formSection: {
    gap: 16,
  },
  fieldWrapper: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '600',
    color: C.deepOcean,
    letterSpacing: 0.01 * 14,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.mistBlue,
    borderRadius: BORDER_RADIUS_2XL,
    borderWidth: 1.5,
    borderColor: C.deepOcean10,
    height: 56,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputContainerFocused: {
    borderColor: C.oceanTeal,
    shadowColor: C.oceanTeal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.slateGray,
    opacity: 0.5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: Platform.OS === 'ios' ? undefined : 24,
    fontWeight: '500',
    color: C.deepOcean,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },

  // ── Forgot row ──
  forgotRow: {
    alignItems: 'flex-end',
    paddingRight: 4,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    color: C.oceanTeal,
  },

  // ── CTA ──
  ctaSection: {
    marginTop: 8,
    gap: 16,
  },
  primaryButtonWrapper: {
    borderRadius: BORDER_RADIUS_2XL,
    shadowColor: C.oceanTeal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButton: {
    height: 56,
    backgroundColor: C.oceanTeal,
    borderRadius: BORDER_RADIUS_2XL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
    lineHeight: 24,
  },
  primaryButtonArrow: {
    fontSize: 18,
    color: C.white,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    backgroundColor: C.white,
    borderRadius: BORDER_RADIUS_2XL,
    borderWidth: 2,
    borderColor: C.deepOcean,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.deepOcean,
    lineHeight: 24,
  },

  // ── Social ──
  socialSection: {
    marginTop: 32,
    alignItems: 'center',
    gap: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.slateGray20,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.slateGray60,
    letterSpacing: 1.5,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 24,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS_2XL,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.deepOcean5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.deepOcean,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  socialGoogleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4285F4',
  },
  // ── Footer ──
  footer: {
    marginTop: 48,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    color: C.slateGray70,
  },
  footerLink: {
    color: C.oceanTeal,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
