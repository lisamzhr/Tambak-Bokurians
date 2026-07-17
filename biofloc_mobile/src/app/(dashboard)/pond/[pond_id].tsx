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
  StatusBar,
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
  { key: 'diagnose', label: 'AI Diagnosa' },
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
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* App Bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={C.onPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>{pond?.name || pond_id}</Text>
          {pond && (
            <Text style={styles.appBarSubtitle}>
              {pond.profile_id.replace(/_/g, ' ').toUpperCase()} • {pond.volume_liters} L
            </Text>
          )}
        </View>
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
        {activeTab === 'diagnose' && <TabAIDiagnose pondId={pond_id} />}
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
// ─── TAB AI DIAGNOSE ──────────────────────────────────────────────────────────

function TabAIDiagnose({ pondId }: { pondId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiService.getAIDiagnose(pondId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pondId]);

  if (loading) return <CenterLoader />;
  if (error) return <EmptyState text={error} />;

  const diag = data?.[pondId];

  if (!diag) {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent}>
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <MaterialIcons name="search-off" size={48} color={C.outlineVariant} style={{ marginBottom: 12 }} />
          <Text style={[styles.cardTitle, { textAlign: 'center' }]}>Belum Ada Diagnosa</Text>
          <Text style={[styles.cardText, { textAlign: 'center' }]}>Masukkan data sensor untuk mendapatkan diagnosa kondisi kolam.</Text>
        </View>
      </ScrollView>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'safe') return C.success;
    if (status === 'warning') return C.warning;
    if (status === 'danger') return C.error;
    return C.outline;
  };

  const getStatusBg = (status: string) => {
    if (status === 'safe') return '#e8f5e9';
    if (status === 'warning') return '#fff8e1';
    if (status === 'danger') return '#ffebee';
    return C.surfaceContainer;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'safe') return 'Aman';
    if (status === 'warning') return 'Waspada';
    if (status === 'danger') return 'Bahaya';
    return 'Tidak Diketahui';
  };

  const getStatusIcon = (status: string): any => {
    if (status === 'safe') return 'check-circle';
    if (status === 'warning') return 'warning';
    if (status === 'danger') return 'error';
    return 'help';
  };

  const PARAM_LABELS: Record<string, { label: string; unit: string }> = {
    temperature_c: { label: 'Suhu', unit: '°C' },
    do_mg_l: { label: 'DO', unit: 'mg/L' },
    ph: { label: 'pH', unit: '' },
    ammonia_mg_l: { label: 'Amonia', unit: 'mg/L' },
    nitrite_mg_l: { label: 'Nitrit', unit: 'mg/L' },
    nitrate_mg_l: { label: 'Nitrat', unit: 'mg/L' },
    TSS_mg_l: { label: 'TSS', unit: 'mg/L' },
  };

  const hasAnyDanger = Object.values(diag.status || {}).some((s: any) => s === 'danger');
  const hasAnyWarning = Object.values(diag.status || {}).some((s: any) => s === 'warning');
  const overallStatus = hasAnyDanger ? 'danger' : hasAnyWarning ? 'warning' : 'safe';

  const asOfDate = diag.as_of ? new Date(diag.as_of).toLocaleString() : null;

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>

      {/* ── Overall Status Banner ─────────────────────────────────────────── */}
      <View style={[styles.diagBanner, { backgroundColor: getStatusBg(overallStatus) }]}>
        <View style={[styles.diagBannerIconWrap, { backgroundColor: getStatusColor(overallStatus) + '22' }]}>
          <MaterialIcons name={getStatusIcon(overallStatus)} size={36} color={getStatusColor(overallStatus)} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.diagBannerTitle, { color: getStatusColor(overallStatus) }]}>
            {overallStatus === 'safe' ? 'Kondisi Normal' : overallStatus === 'warning' ? 'Perlu Perhatian' : 'Perlu Tindakan Segera'}
          </Text>
          {asOfDate && <Text style={styles.diagBannerTime}>Data per {asOfDate}</Text>}
        </View>
      </View>

      {/* ── Parameter Grid ───────────────────────────────────────────────── */}
      <Text style={styles.setupSectionLabel}>PARAMETER AIR</Text>
      <View style={styles.gridContainer}>
        {Object.entries(diag.values || {}).map(([key, value]: any) => {
          const status = diag.status?.[key] || 'unknown';
          const meta = PARAM_LABELS[key] || { label: key, unit: '' };
          return (
            <View key={key} style={[styles.diagParamCard, { borderTopColor: getStatusColor(status) }]}>
              <View style={styles.diagParamHeader}>
                <Text style={styles.diagParamLabel}>{meta.label.toUpperCase()}</Text>
                <View style={[styles.diagStatusChip, { backgroundColor: getStatusColor(status) + '20' }]}>
                  <MaterialIcons name={getStatusIcon(status)} size={12} color={getStatusColor(status)} />
                  <Text style={[styles.diagStatusChipText, { color: getStatusColor(status) }]}>{getStatusLabel(status)}</Text>
                </View>
              </View>
              <View style={styles.diagParamValueRow}>
                <Text style={[styles.diagParamValue, { color: getStatusColor(status) }]}>{value}</Text>
                {meta.unit ? <Text style={styles.diagParamUnit}>{meta.unit}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Recommendations ──────────────────────────────────────────────── */}
      {diag.recommendations && diag.recommendations.length > 0 && (
        <>
          <Text style={styles.setupSectionLabel}>REKOMENDASI TINDAKAN</Text>
          <View style={styles.card}>
            {diag.recommendations.map((rec: string, idx: number) => (
              <View key={idx} style={[styles.listItem, idx < diag.recommendations.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.surfaceContainer, paddingBottom: 12 }]}>
                <View style={styles.diagRecNumWrap}>
                  <Text style={styles.diagRecNum}>{idx + 1}</Text>
                </View>
                <Text style={styles.listText}>{rec}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── TSS Status ───────────────────────────────────────────────────── */}
      {diag.tss_note && (
        <View style={styles.diagTssCard}>
          <MaterialIcons name="science" size={20} color={C.warning} />
          <Text style={styles.diagTssText}>{diag.tss_note}</Text>
        </View>
      )}

      {/* ── Missing Fields ───────────────────────────────────────────────── */}
      {diag.missing_fields && diag.missing_fields.length > 0 && (
        <View style={[styles.card, { borderColor: C.outlineVariant }]}>
          <View style={styles.listItem}>
            <MaterialIcons name="info" size={18} color={C.outline} />
            <Text style={[styles.setupStockStatLabel, { flex: 1 }]}>Data Belum Terkirim</Text>
          </View>
          <View style={styles.diagMissingWrap}>
            {diag.missing_fields.map((f: string) => (
              <View key={f} style={styles.diagMissingChip}>
                <Text style={styles.diagMissingText}>{PARAM_LABELS[f]?.label || f}</Text>
              </View>
            ))}
          </View>
        </View>
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

  const stocking = rec.stocking;
  const inoculum = rec.inoculum;
  const carbon = rec.carbon_dosing;

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>

      {/* ── Section 1: Profile Kolam ──────────────────────────────────────── */}
      <View style={styles.setupProfileCard}>
        <View style={styles.setupIconBox}>
          <MaterialIcons name="water" size={24} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.setupProfileSpecies} numberOfLines={2}>{data.species}</Text>
          <View style={styles.setupProfileMeta}>
            <MaterialIcons name="crop-free" size={14} color={C.onSurfaceVariant} />
            <Text style={styles.setupProfileMetaText}>Vol: {data.pond_volume_liters} L</Text>
          </View>
        </View>
      </View>

      {/* ── Section 2: Tebar Benih ────────────────────────────────────────── */}
      <Text style={styles.setupSectionLabel}>TARGET TEBAR BENIH</Text>
      <View style={styles.setupStockCard}>
        {/* Left accent bar */}
        <View style={styles.setupStockAccent} />
        <View style={{ flex: 1 }}>
          <View style={styles.setupStockRow}>
            <View style={styles.setupStockStat}>
              <Text style={styles.setupStockStatLabel}>Jumlah Bibit</Text>
              <View style={styles.setupStockStatValue}>
                <Text style={styles.setupStockBigNum}>{stocking?.jumlah_bibit_ekor?.toLocaleString()}</Text>
                <Text style={styles.setupStockUnit}>ekor</Text>
              </View>
            </View>
            <View style={styles.setupStockStat}>
              <Text style={styles.setupStockStatLabel}>Berat Awal</Text>
              <View style={styles.setupStockStatValue}>
                <Text style={[styles.setupStockBigNum, { color: C.onSurface }]}>{stocking?.berat_awal_per_ekor_g}</Text>
                <Text style={styles.setupStockUnit}>g/ekor</Text>
              </View>
            </View>
          </View>

          <View style={styles.setupStockDivider} />
          <View style={styles.setupBiomassRow}>
            <View>
              <Text style={styles.setupStockStatLabel}>Total Biomassa</Text>
              <Text style={styles.setupBiomassValue}>
                {stocking?.total_biomassa_tebar_g != null
                  ? `${(stocking.total_biomassa_tebar_g / 1000).toFixed(2)} kg`
                  : '-'}
              </Text>
            </View>
            {stocking?.densitas_acuan_per_m3 != null && (
              <View style={styles.setupDensityChip}>
                <MaterialIcons name="bolt" size={16} color={C.primary} />
                <Text style={styles.setupDensityText}>
                  {stocking.densitas_acuan_per_m3} ekor/m³
                </Text>
              </View>
            )}
          </View>
          {stocking?.note ? (
            <Text style={styles.setupNoteText}>{stocking.note}</Text>
          ) : null}
        </View>
      </View>

      {/* ── Section 3: Persiapan Air ──────────────────────────────────────── */}
      <Text style={styles.setupSectionLabel}>PERSIAPAN AIR (BIOFLOC)</Text>
      <View style={styles.setupWaterCard}>
        {/* C:N ratio chip */}
        {carbon?.cn_ratio_target != null && (
          <View style={styles.setupCNRow}>
            <View style={styles.setupCNChip}>
              <Text style={styles.setupCNLabel}>Target C:N Ratio</Text>
              <Text style={styles.setupCNValue}>{carbon.cn_ratio_target}:1</Text>
            </View>
            <View style={styles.setupCNNote}>
              <MaterialIcons name="eco" size={16} color={C.primary} />
              <Text style={styles.setupCNNoteText} numberOfLines={3}>{carbon.note}</Text>
            </View>
          </View>
        )}

        {/* Inoculum tip */}
        {inoculum?.note ? (
          <View style={styles.setupInoculumTip}>
            <MaterialIcons name="lightbulb" size={20} color={C.primary} />
            <Text style={styles.setupInoculumText}>{inoculum.note}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Section 4: Estimasi Maturitas ─────────────────────────────────── */}
      {(rec.estimated_maturity || rec.next_step) && (
        <>
          <Text style={styles.setupSectionLabel}>STATUS PERSIAPAN</Text>
          <View style={styles.card}>
            {rec.estimated_maturity ? (
              <View style={styles.listItem}>
                <MaterialIcons name="schedule" size={20} color={C.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.setupStockStatLabel, { marginBottom: 4 }]}>Estimasi Maturitas</Text>
                  <Text style={styles.listText}>{rec.estimated_maturity}</Text>
                </View>
              </View>
            ) : null}
            {rec.next_step ? (
              <View style={[styles.listItem, { marginTop: rec.estimated_maturity ? 12 : 0 }]}>
                <MaterialIcons name="send" size={20} color={C.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.setupStockStatLabel, { marginBottom: 4 }]}>Langkah Berikutnya</Text>
                  <Text style={styles.listText}>{rec.next_step}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </>
      )}

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

      {/* Info Ringkas Kolam */}
      <View style={styles.gridContainer}>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Mulai Kolam</Text>
          <Text style={[styles.gridValue, { fontSize: 15, marginTop: 4 }]}>
            {matData.pond_start_date || '-'}
          </Text>
          {matData.pond_start_date_is_assumed && (
            <Text style={{ fontSize: 10, color: C.warning, fontStyle: 'italic', marginTop: 2 }}>*Asumsi</Text>
          )}
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Hari Berjalan</Text>
          <Text style={[styles.gridValue, { fontSize: 20, marginTop: 4 }]}>
            {matData.elapsed_days_since_pond_start ?? 0} hari
          </Text>
        </View>
      </View>

      {/* Progress */}
      <Text style={styles.setupSectionLabel}>PROGRESS STABILITAS (AMONIA AMAN)</Text>
      <View style={styles.card}>
        <View style={styles.progressRow}>
          <Text style={styles.progressValue}>{amoniaDays}</Text>
          <Text style={styles.progressDiv}>/</Text>
          <Text style={styles.progressValue}>{reqDays}</Text>
          <Text style={styles.progressUnit}>Hari</Text>
        </View>
        <Text style={styles.messageText}>{matData.message}</Text>
      </View>

      {/* Timeline Budidaya */}
      {matData.journal_timeline && (
        <>
          <Text style={styles.setupSectionLabel}>ESTIMASI MATURITAS & SKENARIO</Text>

          {matData.journal_timeline.note && (
            <View style={[styles.setupInoculumTip, { backgroundColor: C.primary + '0d', borderColor: C.outlineVariant, borderWidth: 1, borderRadius: 12, marginBottom: 12 }]}>
              <MaterialIcons name="info" size={20} color={C.primary} />
              <Text style={styles.setupInoculumText}>{matData.journal_timeline.note}</Text>
            </View>
          )}

          <View style={{ gap: 12 }}>
            {matData.journal_timeline.if_used_inoculum && (
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: C.success }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <MaterialIcons name="opacity" size={18} color={C.success} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.onSurface }}>Dengan Inokulum</Text>
                </View>
                <Text style={styles.cardText}>
                  <Text style={{ fontWeight: '600' }}>Estimasi Jurnal:</Text> {matData.journal_timeline.if_used_inoculum.journal_estimated_days} hari
                </Text>
                {matData.journal_timeline.if_used_inoculum.estimated_target_date_range && (
                  <Text style={styles.cardText}>
                    <Text style={{ fontWeight: '600' }}>Target Tanggal:</Text> {matData.journal_timeline.if_used_inoculum.estimated_target_date_range.join(' s/d ')}
                  </Text>
                )}
                <Text style={[styles.setupNoteText, { marginTop: 8 }]}>
                  {matData.journal_timeline.if_used_inoculum.note}
                </Text>
              </View>
            )}

            {matData.journal_timeline.if_no_inoculum && (
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: C.outline }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <MaterialIcons name="blur-off" size={18} color={C.outline} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.onSurface }}>Tanpa Inokulum</Text>
                </View>
                <Text style={styles.cardText}>
                  <Text style={{ fontWeight: '600' }}>Estimasi Jurnal:</Text> {matData.journal_timeline.if_no_inoculum.journal_estimated_days} hari
                </Text>
                {matData.journal_timeline.if_no_inoculum.estimated_target_date_range && (
                  <Text style={styles.cardText}>
                    <Text style={{ fontWeight: '600' }}>Target Tanggal:</Text> {matData.journal_timeline.if_no_inoculum.estimated_target_date_range.join(' s/d ')}
                  </Text>
                )}
                <Text style={[styles.setupNoteText, { marginTop: 8 }]}>
                  {matData.journal_timeline.if_no_inoculum.note}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

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
    backgroundColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.onPrimary,
  },
  appBarSubtitle: {
    fontSize: 12,
    color: C.onPrimary,
    opacity: 0.8,
    marginTop: 2,
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

  // ─── REDESIGNED AI SETUP STYLES ───────────────────────────────────────────
  setupProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  setupIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupProfileSpecies: {
    fontSize: 15,
    fontWeight: '700',
    color: C.onSurface,
    lineHeight: 20,
  },
  setupProfileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  setupProfileMetaText: {
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  setupSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.outline,
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  setupStockCard: {
    flexDirection: 'row',
    backgroundColor: C.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    borderRadius: 16,
    overflow: 'hidden',
    paddingRight: 16,
    paddingVertical: 16,
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  setupStockAccent: {
    width: 6,
    backgroundColor: C.primary,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginRight: 14,
  },
  setupStockRow: {
    flexDirection: 'row',
    gap: 24,
  },
  setupStockStat: {
    flex: 1,
  },
  setupStockStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.outline,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  setupStockStatValue: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  setupStockBigNum: {
    fontSize: 28,
    fontWeight: '800',
    color: C.primary,
    lineHeight: 32,
  },
  setupStockUnit: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    marginBottom: 2,
  },
  setupStockDivider: {
    height: 1,
    backgroundColor: C.surfaceContainer,
    marginVertical: 14,
  },
  setupBiomassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setupBiomassValue: {
    fontSize: 22,
    fontWeight: '700',
    color: C.onSurface,
    marginTop: 2,
  },
  setupDensityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  setupDensityText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
  setupNoteText: {
    fontSize: 12,
    color: C.outline,
    fontStyle: 'italic',
    marginTop: 12,
    lineHeight: 18,
  },
  setupWaterCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    borderRadius: 16,
    overflow: 'hidden',
  },
  setupCNRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceContainer,
    alignItems: 'flex-start',
  },
  setupCNChip: {
    backgroundColor: C.surfaceContainer,
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  setupCNLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.outline,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  setupCNValue: {
    fontSize: 22,
    fontWeight: '800',
    color: C.onSurface,
  },
  setupCNNote: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  setupCNNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: C.onSurfaceVariant,
  },
  setupInoculumTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: C.primary + '0d',
    borderTopWidth: 1,
    borderTopColor: C.outlineVariant,
  },
  setupInoculumText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: C.onSurface,
    fontStyle: 'italic',
  },
  // keep old keys for any remaining usages in other tabs
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

  // ─── AI DIAGNOSE STYLES ───────────────────────────────────────────────────
  diagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  diagBannerIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  diagBannerTime: {
    fontSize: 11,
    color: C.outline,
  },
  diagParamCard: {
    width: '48%',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 12,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  diagParamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  diagParamLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.outline,
    letterSpacing: 0.5,
  },
  diagStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  diagStatusChipText: {
    fontSize: 9,
    fontWeight: '700',
  },
  diagParamValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  diagParamValue: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  diagParamUnit: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginBottom: 2,
  },
  diagRecNumWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  diagRecNum: {
    fontSize: 11,
    fontWeight: '800',
    color: C.onPrimary,
  },
  diagTssCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.warning + '55',
    padding: 14,
  },
  diagTssText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: C.onSurface,
    fontStyle: 'italic',
  },
  diagMissingWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  diagMissingChip: {
    backgroundColor: C.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  diagMissingText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
});
