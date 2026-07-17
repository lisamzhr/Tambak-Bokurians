import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { readingsService } from '../../../services/readings.service';
import { aiService } from '../../../services/ai.service';
import { pondsService, Pond } from '../../../services/ponds.service';

const C = {
  primary: '#006a65',
  lighterPrimary: '#03837dff',
  onPrimary: '#ffffff',
  surface: '#f8fafb',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#eceeef',
  onSurface: '#191c1d',
  onSurfaceVariant: '#3c4948',
  outline: '#6c7a78',
  outlineVariant: '#bbc9c7',
  error: '#ba1a1a',
  success: '#2e7d32',
  warning: '#ed6c02',
};

const TABS = [
  { key: 'readings', label: 'Grafik' },
  { key: 'input', label: 'Input Manual' },
  { key: 'health', label: 'AI Kesehatan' },
  { key: 'setup', label: 'AI Setup' },
  { key: 'maturity', label: 'AI Maturitas' },
];

export default function PondDetailScreen() {
  const { pond_id } = useLocalSearchParams<{ pond_id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState('readings');
  const [pond, setPond] = useState<Pond | null>(null);

  useEffect(() => {
    pondsService.getPond(pond_id).then(setPond).catch(console.error);
  }, [pond_id]);

  return (
    <View style={styles.root}>
      {/* App Bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{pond?.name || pond_id}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'readings' && <TabReadings pondId={pond_id} />}
        {activeTab === 'input' && <TabInput pondId={pond_id} />}
        {activeTab === 'health' && <TabAIHealth pondId={pond_id} />}
        {activeTab === 'setup' && <TabAISetup pondId={pond_id} />}
        {activeTab === 'maturity' && <TabAIMaturity pondId={pond_id} />}
      </View>
    </View>
  );
}

// ─── TABS CONTENT ─────────────────────────────────────────────────────────────

// ─── LINE CHART COMPONENT ─────────────────────────────────────────────────────

const CHART_PADDING = { top: 20, right: 16, bottom: 36, left: 44 };

function LineChart({
  readings,
  field,
  label,
  unit,
  color,
  gradientId,
}: {
  readings: any[];
  field: string;
  label: string;
  unit: string;
  color: string;
  gradientId: string;
}) {
  const screenWidth = Dimensions.get('window').width;
  const CHART_WIDTH = screenWidth - 32; // 16px padding each side
  const CHART_HEIGHT = 180;

  const values = readings.map((r: any) => r[field]).filter((v: any) => v != null);
  if (values.length === 0) {
    return (
      <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardText}>Tidak ada data</Text>
      </View>
    );
  }

  const pointsWithValue = readings
    .map((r: any, i: number) => ({ i, v: r[field], ts: r.ts }))
    .filter((p) => p.v != null);

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const plotW = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const toX = (i: number) =>
    CHART_PADDING.left + (i / (readings.length - 1 || 1)) * plotW;
  const toY = (v: number) =>
    CHART_PADDING.top + (1 - (v - minVal) / range) * plotH;

  // Build SVG path for line
  const linePath = pointsWithValue
    .map((p, idx) => {
      const x = toX(p.i);
      const y = toY(p.v);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Build fill path (close to bottom)
  const firstX = toX(pointsWithValue[0].i);
  const lastX = toX(pointsWithValue[pointsWithValue.length - 1].i);
  const bottomY = CHART_PADDING.top + plotH;
  const fillPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  const latestPoint = pointsWithValue[pointsWithValue.length - 1];
  const latestX = toX(latestPoint.i);
  const latestY = toY(latestPoint.v);

  // Y axis ticks
  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (range / yTicks) * i
  );

  // X axis: show first and last timestamps
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.chartCard}>
      {/* Header */}
      <View style={styles.chartHeader}>
        <View style={[styles.chartDot, { backgroundColor: color }]} />
        <Text style={styles.chartTitle}>{label}</Text>
        <View style={[styles.chartBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
          <Text style={[styles.chartBadgeText, { color }]}>
            {latestPoint.v.toFixed(1)} {unit}
          </Text>
        </View>
      </View>

      {/* SVG Chart */}
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {tickValues.map((tick, i) => {
          const y = toY(tick);
          return (
            <React.Fragment key={i}>
              <Line
                x1={CHART_PADDING.left}
                y1={y}
                x2={CHART_PADDING.left + plotW}
                y2={y}
                stroke="#eceeef"
                strokeWidth={1}
              />
              <SvgText
                x={CHART_PADDING.left - 6}
                y={y + 4}
                fill="#6c7a78"
                fontSize={9}
                textAnchor="end"
              >
                {tick.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X axis labels */}
        {pointsWithValue.length > 1 && (
          <>
            <SvgText
              x={toX(pointsWithValue[0].i)}
              y={CHART_PADDING.top + plotH + 20}
              fill="#6c7a78"
              fontSize={9}
              textAnchor="middle"
            >
              {formatTime(pointsWithValue[0].ts)}
            </SvgText>
            <SvgText
              x={toX(pointsWithValue[pointsWithValue.length - 1].i)}
              y={CHART_PADDING.top + plotH + 20}
              fill="#6c7a78"
              fontSize={9}
              textAnchor="middle"
            >
              {formatTime(pointsWithValue[pointsWithValue.length - 1].ts)}
            </SvgText>
          </>
        )}

        {/* Axis lines */}
        <Line
          x1={CHART_PADDING.left}
          y1={CHART_PADDING.top}
          x2={CHART_PADDING.left}
          y2={CHART_PADDING.top + plotH}
          stroke="#bbc9c7"
          strokeWidth={1}
        />
        <Line
          x1={CHART_PADDING.left}
          y1={CHART_PADDING.top + plotH}
          x2={CHART_PADDING.left + plotW}
          y2={CHART_PADDING.top + plotH}
          stroke="#bbc9c7"
          strokeWidth={1}
        />

        {/* Gradient fill */}
        <Path d={fillPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <Path
          d={linePath}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Latest point dot */}
        <Circle cx={latestX} cy={latestY} r={5} fill={color} />
        <Circle cx={latestX} cy={latestY} r={9} fill={color} fillOpacity={0.2} />
      </Svg>
    </View>
  );
}

// ─── TAB READINGS ─────────────────────────────────────────────────────────────

function TabReadings({ pondId }: { pondId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readingsService.getReadings(pondId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [pondId]);

  if (loading) return <CenterLoader />;
  if (!data?.readings || data.readings.length === 0)
    return <EmptyState text="Belum ada data sensor / manual." />;

  const readings = data.readings.slice(-20); // last 20 readings
  const latest = readings[readings.length - 1];

  const FIELDS = [
    { field: 'ph', label: 'pH', unit: '', color: '#006a65', gradientId: 'grad_ph' },
    { field: 'temperature_c', label: 'Suhu', unit: '°C', color: '#e07b39', gradientId: 'grad_suhu' },
    { field: 'do_mg_l', label: 'DO', unit: 'mg/L', color: '#2e7d9f', gradientId: 'grad_do' },
    { field: 'ammonia_mg_l', label: 'Amonia', unit: 'mg/L', color: '#b5521e', gradientId: 'grad_amonia' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      {/* Latest Reading Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Pembacaan Terkini</Text>
        <Text style={styles.summaryTime}>{latest?.ts ? new Date(latest.ts).toLocaleString() : '-'}</Text>
        <View style={styles.summaryRow}>
          {FIELDS.map((f) => (
            <View key={f.field} style={styles.summaryCell}>
              <Text style={styles.summaryCellValue}>
                {latest?.[f.field] != null ? Number(latest[f.field]).toFixed(1) : '-'}
              </Text>
              <Text style={styles.summaryCellLabel}>{f.label}</Text>
              {f.unit ? <Text style={styles.summaryCellUnit}>{f.unit}</Text> : null}
            </View>
          ))}
        </View>
      </View>

      {/* 4 Charts */}
      {FIELDS.map((f) => (
        <LineChart
          key={f.field}
          readings={readings}
          field={f.field}
          label={f.label}
          unit={f.unit}
          color={f.color}
          gradientId={f.gradientId}
        />
      ))}
    </ScrollView>
  );
}

function TabInput({ pondId }: { pondId: string }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    ph: '',
    temperature_c: '',
    do_mg_l: '',
    ammonia_mg_l: '',
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await readingsService.postManualReading({
        pond_id: pondId,
        ph: form.ph ? parseFloat(form.ph) : undefined,
        temperature_c: form.temperature_c ? parseFloat(form.temperature_c) : undefined,
        do_mg_l: form.do_mg_l ? parseFloat(form.do_mg_l) : undefined,
        ammonia_mg_l: form.ammonia_mg_l ? parseFloat(form.ammonia_mg_l) : undefined,
      });
      Alert.alert('Sukses', 'Data manual berhasil disimpan');
      setForm({ ph: '', temperature_c: '', do_mg_l: '', ammonia_mg_l: '' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Input Parameter Air</Text>
        
        <InputField label="pH" value={form.ph} onChangeText={(v) => setForm({...form, ph: v})} keyboardType="numeric" />
        <InputField label="Suhu (°C)" value={form.temperature_c} onChangeText={(v) => setForm({...form, temperature_c: v})} keyboardType="numeric" />
        <InputField label="DO (mg/L)" value={form.do_mg_l} onChangeText={(v) => setForm({...form, do_mg_l: v})} keyboardType="numeric" />
        <InputField label="Amonia (mg/L)" value={form.ammonia_mg_l} onChangeText={(v) => setForm({...form, ammonia_mg_l: v})} keyboardType="numeric" />

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Simpan Data</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function TabAIHealth({ pondId }: { pondId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiService.getAIHealth(pondId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pondId]);

  if (loading) return <CenterLoader />;
  if (error) return <EmptyState text={error} />;

  const pondData = data?.ponds?.[pondId];
  const profile = data?.profile;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return C.success;
      case 'warning': return C.warning;
      case 'danger': return C.error;
      default: return C.outline;
    }
  };

  const getScoreColor = (label: string) => {
    if (label === 'Baik') return C.success;
    if (label === 'Waspada') return C.warning;
    return C.error;
  };

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      {/* Profile Header */}
      {profile && (
        <View style={styles.setupHeader}>
          <MaterialIcons name="info-outline" size={24} color={C.primary} />
          <View style={{flex: 1}}>
            <Text style={styles.setupSpecies}>{profile.species}</Text>
            <Text style={styles.setupVolume}>Profile: {profile.id}</Text>
            {profile.source && (
              <Text style={{ fontSize: 11, color: C.outline, fontStyle: 'italic', marginTop: 8, lineHeight: 16 }}>
                Sumber referensi: {profile.source}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Empty State or Predictions */}
      {!pondData ? (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 40, borderStyle: 'dashed' }]}>
          <MaterialIcons name="analytics" size={48} color={C.outlineVariant} style={{ marginBottom: 16 }} />
          <Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 8 }]}>Belum Ada Prediksi</Text>
          <Text style={[styles.cardText, { textAlign: 'center' }]}>
            AI belum dapat menghasilkan prediksi untuk kolam ini. Pastikan data sensor atau input manual air telah dimasukkan dalam jumlah yang cukup (minimal 1 hari data lengkap).
          </Text>
        </View>
      ) : (
        <>
          {/* Score Card */}
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
            <View style={[styles.scoreCircle, { borderColor: getScoreColor(pondData.health_label) }]}>
              <Text style={[styles.scoreText, { color: getScoreColor(pondData.health_label) }]}>{pondData.health_score}</Text>
            </View>
            <Text style={styles.scoreLabel}>{pondData.health_label}</Text>
          </View>

          {/* Predictions Grid */}
          <Text style={styles.sectionTitle}>Parameter Air</Text>
          <View style={styles.gridContainer}>
            {Object.entries(pondData.predictions || {}).map(([key, value]: any) => {
              const status = pondData.status?.[key] || 'unknown';
              return (
                <View key={key} style={styles.gridItem}>
                  <View style={styles.gridHeader}>
                    <Text style={styles.gridLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                  </View>
                  <Text style={styles.gridValue}>{value}</Text>
                </View>
              );
            })}
          </View>

          {/* Recommendations */}
          <Text style={styles.sectionTitle}>Rekomendasi Tindakan</Text>
          <View style={styles.card}>
            {(pondData.recommendations || []).map((rec: string, idx: number) => (
              <View key={idx} style={styles.listItem}>
                <MaterialIcons name="chevron-right" size={20} color={C.primary} style={{marginTop: 2}} />
                <Text style={styles.listText}>{rec}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function TabAISetup({ pondId }: { pondId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiService.getAISetup(pondId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pondId]);

  if (loading) return <CenterLoader />;
  if (error) return <EmptyState text={error} />;

  const rec = data?.recommendations;

  if (!rec) {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent}>
        <View style={styles.card}>
           <Text style={styles.emptyText}>Tidak ada rekomendasi setup tersedia.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      {/* Header Info */}
      <View style={styles.setupHeader}>
        <MaterialIcons name="info-outline" size={24} color={C.primary} />
        <View style={{flex: 1}}>
          <Text style={styles.setupSpecies}>{data.species}</Text>
          <Text style={styles.setupVolume}>Volume: {data.pond_volume_liters} L</Text>
        </View>
      </View>

      {/* Stocking */}
      <Text style={styles.sectionTitle}>Tebar Benih</Text>
      <View style={styles.card}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Jumlah Bibit</Text>
          <Text style={styles.statValue}>{rec.stocking?.jumlah_bibit_ekor} ekor</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Berat Awal</Text>
          <Text style={styles.statValue}>{rec.stocking?.berat_awal_per_ekor_g} g</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Biomassa</Text>
          <Text style={styles.statValue}>{rec.stocking?.total_biomassa_tebar_g} g</Text>
        </View>
        <Text style={styles.noteText}>{rec.stocking?.note}</Text>
      </View>

      {/* Water Prep */}
      <Text style={styles.sectionTitle}>Persiapan Air (Inokulum & Karbon)</Text>
      <View style={styles.card}>
        <View style={styles.listItem}>
          <MaterialIcons name="science" size={20} color={C.primary} style={{marginTop: 2}} />
          <Text style={styles.listText}>{rec.inoculum?.note}</Text>
        </View>
        <View style={[styles.listItem, { marginTop: 12 }]}>
          <MaterialIcons name="eco" size={20} color={C.primary} style={{marginTop: 2}} />
          <View style={{flex: 1}}>
            <Text style={[styles.listText, {fontWeight: 'bold'}]}>Target C:N Ratio: {rec.carbon_dosing?.cn_ratio_target}:1</Text>
            <Text style={styles.listText}>{rec.carbon_dosing?.note}</Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <Text style={styles.sectionTitle}>Estimasi Maturitas</Text>
      <View style={styles.card}>
        <Text style={styles.timelineText}><Text style={{fontWeight: 'bold', color: C.onSurface}}>Waktu:</Text> {rec.estimated_maturity}</Text>
        <Text style={styles.timelineText}><Text style={{fontWeight: 'bold', color: C.onSurface}}>Next step:</Text> {rec.next_step}</Text>
      </View>
    </ScrollView>
  );
}

function TabAIMaturity({ pondId }: { pondId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiService.getAIMaturity(pondId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pondId]);

  if (loading) return <CenterLoader />;
  if (error) return <EmptyState text={error} />;

  const matData = data?.[pondId];

  if (!matData) {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent}>
        <View style={styles.card}>
           <Text style={styles.emptyText}>Tidak ada data maturitas untuk kolam ini.</Text>
        </View>
      </ScrollView>
    );
  }

  const isMature = matData.is_mature;
  const amoniaDays = matData.consecutive_safe_days?.ammonia_mg_l || 0;
  const reqDays = matData.required_consecutive_days || 0;

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: isMature ? C.success : C.surfaceContainer }]}>
        <MaterialIcons name={isMature ? "check-circle" : "hourglass-empty"} size={32} color={isMature ? C.onPrimary : C.onSurfaceVariant} />
        <Text style={[styles.statusBannerText, { color: isMature ? C.onPrimary : C.onSurface }]}>
          {isMature ? "Biofloc Matang" : "Belum Matang"}
        </Text>
      </View>

      {/* Progress */}
      <Text style={styles.sectionTitle}>Progress Stabilitas (Amonia Aman)</Text>
      <View style={styles.card}>
        <View style={styles.progressRow}>
          <Text style={styles.progressValue}>{amoniaDays}</Text>
          <Text style={styles.progressDiv}>/</Text>
          <Text style={styles.progressValue}>{reqDays}</Text>
          <Text style={styles.progressUnit}>Hari</Text>
        </View>
        <Text style={styles.messageText}>{matData.message}</Text>
      </View>

      {/* Warnings */}
      {matData.params_missing_from_data && matData.params_missing_from_data.length > 0 && (
        <View style={[styles.card, { borderColor: C.warning, backgroundColor: '#fff3e0' }]}>
          <Text style={[styles.cardTitle, { color: C.warning }]}>Data Kurang</Text>
          <Text style={styles.cardText}>AI butuh data berikut untuk analisis akurat: {matData.params_missing_from_data.join(', ')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function InputField({ label, value, onChangeText, keyboardType }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function CenterLoader() {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.surface,
  },
  appBar: {
    backgroundColor: C.surfaceContainerLowest,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceContainer,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.onSurface,
  },
  tabsContainer: {
    backgroundColor: C.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceContainer,
  },
  tabsScroll: {
    paddingHorizontal: 8,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: C.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
  tabTextActive: {
    color: C.primary,
  },
  content: {
    flex: 1,
  },
  tabScrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: C.surfaceContainerLowest,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onSurface,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    marginBottom: 4,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: C.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: C.onSurface,
  },
  primaryButton: {
    backgroundColor: C.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: C.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: 'center',
  },
  
  // ─── NEW AI TABS STYLES ──────────────────────────────────────────────────────
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 56,
  },
  scoreLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: C.onSurface,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.onSurface,
    marginTop: 8,
    marginBottom: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
    backgroundColor: C.surfaceContainerLowest,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceContainer,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.outline,
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gridValue: {
    fontSize: 22,
    fontWeight: '700',
    color: C.onSurface,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainer,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
  },
  setupSpecies: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onSurface,
  },
  setupVolume: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceContainer,
  },
  statLabel: {
    fontSize: 14,
    color: C.onSurfaceVariant,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onSurface,
  },
  noteText: {
    fontSize: 12,
    color: C.outline,
    fontStyle: 'italic',
    marginTop: 12,
    lineHeight: 18,
  },
  timelineText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    marginBottom: 8,
    lineHeight: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    gap: 16,
    marginBottom: 12,
  },
  statusBannerText: {
    fontSize: 20,
    fontWeight: '800',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 8,
  },
  progressValue: {
    fontSize: 48,
    fontWeight: '800',
    color: C.primary,
  },
  progressDiv: {
    fontSize: 32,
    fontWeight: '300',
    color: C.outline,
  },
  progressUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
  messageText: {
    fontSize: 15,
    textAlign: 'center',
    color: C.onSurfaceVariant,
    lineHeight: 22,
  },

  // ─── CHART STYLES ──────────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    overflow: 'hidden',
    paddingTop: 16,
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  chartDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chartTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: C.onSurface,
  },
  chartBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  chartBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── SUMMARY CARD ──────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: C.primary,
    borderRadius: 16,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.onPrimary,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryTime: {
    fontSize: 12,
    color: C.onPrimary,
    opacity: 0.6,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCell: {
    alignItems: 'center',
  },
  summaryCellValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  summaryCellLabel: {
    fontSize: 11,
    color: C.onPrimary,
    opacity: 0.7,
    marginTop: 4,
  },
  summaryCellUnit: {
    fontSize: 10,
    color: C.onPrimary,
    opacity: 0.5,
  },
});
