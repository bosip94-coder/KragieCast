export type NavSection = 'setup' | 'studio' | 'analytics' | 'community';

export type UserPersonaRole = 'host' | 'admin';

export type OverlayTemplateId = 'modern' | 'flash_sale' | 'minimalis' | 'berita';

export type NoiseCancellationLevel = 'off' | 'ringan' | 'standar' | 'agresif';

export type CameraZoomPreset = 1.0 | 1.2 | 1.5;

export type HostGender = 'perempuan' | 'laki-laki';

export interface HostCharacter {
  id: string;
  name: string;
  gender: HostGender;
  styleLabel: string;
  specialty: string;
  description: string;
  imageUrl: string;
  sampleGreeting: string;
}

export interface Product {
  id: string;
  name: string;
  normalPrice: number;
  promoPrice: number;
  stock: number;
  imageUrl: string;
  keywords: string[];
  ctaText: string;
  category: string;
}

export interface OverlayConfig {
  templateId: OverlayTemplateId;
  durationSeconds: number;
  defaultCta: string;
  showStockAlert: boolean;
}

export interface RtmpConfig {
  platform: 'YouTube Live' | 'TikTok Live' | 'Shopee Live' | 'Custom RTMP';
  serverUrl: string;
  streamKey: string;
  resolution: '720p 30fps' | '1080p 30fps';
  virtualCamEnabled: boolean;
}

export interface SpeechTriggerEvent {
  id: string;
  timestampSec: number;
  recordedAt: string;
  transcript: string;
  matchedKeyword: string;
  productId: string;
  productName: string;
  latencyMs: number;
  displayDurationSec: number;
}

export interface TranscriptLogEntry {
  id: string;
  timeLabel: string;
  text: string;
  matchedProductName?: string;
  matchedKeyword?: string;
  voiceCommand?: string;
  latencyMs?: number;
}

export interface AiRecommendation {
  title: string;
  detail: string;
  actionStep: string;
  priority: 'Tinggi' | 'Sedang' | 'Peluang' | string;
}

export interface BroadcastSession {
  id: string;
  title: string;
  hostStoreName: string;
  platform: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  overlayTemplateId: OverlayTemplateId;
  overlayDurationSeconds: number;
  productsSnapshot: Product[];
  triggers: SpeechTriggerEvent[];
  transcripts: string[];
  aiRecommendations: AiRecommendation[];
  aiGeneratedAt?: string;
  peakViewersEstimate?: number;
}

export interface ProductPerformanceRow {
  productId: string;
  productName: string;
  keywords: string[];
  normalPrice: number;
  promoPrice: number;
  discountPercent: number;
  stock: number;
  triggerCount: number;
  totalScreenSeconds: number;
  avgLatencyMs: number;
  sharePercent: number;
}

export interface SessionSummaryMetrics {
  durationSeconds: number;
  totalTriggers: number;
  uniqueProductsShown: number;
  totalCatalogProducts: number;
  averageLatencyMs: number;
  slaCompliant: boolean;
  topProduct: ProductPerformanceRow | null;
  productBreakdown: ProductPerformanceRow[];
  timelineBuckets: Array<{
    label: string;
    startSec: number;
    endSec: number;
    count: number;
  }>;
}

export interface UmkmCohortMember {
  id: string;
  storeName: string;
  ownerName: string;
  city: string;
  sector: 'Kuliner' | 'Fesyen' | 'Kerajinan';
  programBatch: string;
  sessionsThisWeek: number;
  weeklyRetained: boolean;
  avgLatencyMs: number;
  totalTriggersMonth: number;
  lastBroadcastDate: string;
  topProduct: string;
  status: 'Aktif' | 'Perlu Pendampingan' | 'Baru Bergabung';
}

export type ForecastScenario = 'konservatif' | 'moderat' | 'optimis';

export interface HistoricalRevenuePoint {
  sessionId: string;
  label: string;
  title: string;
  durationMinutes: number;
  triggersCount: number;
  estimatedUnits: number;
  estimatedRevenue: number;
}

export interface ProjectedSessionPoint {
  index: number;
  label: string;
  durationMinutes: number;
  projectedTriggers: number;
  projectedUnits: number;
  projectedRevenue: number;
  lowRevenue: number;
  highRevenue: number;
}

export interface ProductForecastRow {
  productId: string;
  productName: string;
  promoPrice: number;
  currentStock: number;
  projectedUnits: number;
  projectedRevenue: number;
  revenueSharePercent: number;
  restockNeeded: number;
}

export interface SalesForecastResult {
  basedOnSessionsCount: number;
  scenario: ForecastScenario;
  upcomingSessionsCount: number;
  plannedDurationMinutes: number;
  historicalAverageRevenue: number;
  trendPercentPerSession: number;
  totalProjectedRevenue: number;
  totalLowRevenue: number;
  totalHighRevenue: number;
  averageProjectedPerSession: number;
  totalProjectedUnits: number;
  totalProjectedTriggers: number;
  deltaVsHistoricalPercent: number;
  historicalPoints: HistoricalRevenuePoint[];
  projectedPoints: ProjectedSessionPoint[];
  productForecasts: ProductForecastRow[];
}

