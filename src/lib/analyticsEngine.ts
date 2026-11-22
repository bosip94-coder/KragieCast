import type {
  BroadcastSession,
  ForecastScenario,
  HistoricalRevenuePoint,
  Product,
  ProductForecastRow,
  ProductPerformanceRow,
  ProjectedSessionPoint,
  SalesForecastResult,
  SessionSummaryMetrics,
} from '../types/kragiecast';

export const MAX_PRODUCTS_PER_SESSION = 10;
export const MIN_KEYWORDS_PER_PRODUCT = 1;
export const MAX_KEYWORDS_PER_PRODUCT = 3;
export const LATENCY_SLA_MS = 1500;

export interface ProductDraftInput {
  name: string;
  normalPrice: number;
  promoPrice: number;
  stock: number;
  keywords: string[];
  ctaText: string;
  category: string;
  imageUrl: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function calculateDiscountPercent(normalPrice: number, promoPrice: number): number {
  if (normalPrice <= 0 || promoPrice <= 0 || promoPrice >= normalPrice) return 0;
  return Math.round(((normalPrice - promoPrice) / normalPrice) * 100);
}

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rp${safe.toLocaleString('id-ID')}`;
}

export function formatCompactRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (safe >= 1_000_000) {
    const jt = safe / 1_000_000;
    const formatted = jt >= 10 ? Math.round(jt).toString() : jt.toFixed(1).replace('.', ',');
    return `Rp${formatted} jt`;
  }
  if (safe >= 1_000) {
    return `Rp${Math.round(safe / 1_000)} rb`;
  }
  return `Rp${Math.round(safe)}`;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hrs > 0) {
    return `${hrs}j ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}d`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}d`;
}

export function formatClockTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseKeywordsInput(raw: string): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      cleaned.push(trimmed);
    }
  }
  return cleaned;
}

export function validateProductDraft(
  draft: ProductDraftInput,
  existingProductCount: number,
  isEditing: boolean,
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isEditing && existingProductCount >= MAX_PRODUCTS_PER_SESSION) {
    errors.limit = `Maksimal ${MAX_PRODUCTS_PER_SESSION} produk per sesi siaran telah tercapai.`;
  }

  if (!draft.name.trim()) {
    errors.name = 'Nama produk wajib diisi.';
  } else if (draft.name.trim().length < 3) {
    errors.name = 'Nama produk minimal 3 karakter.';
  }

  if (!Number.isFinite(draft.normalPrice) || draft.normalPrice <= 0) {
    errors.normalPrice = 'Harga normal harus lebih dari Rp0.';
  }

  if (!Number.isFinite(draft.promoPrice) || draft.promoPrice <= 0) {
    errors.promoPrice = 'Harga promo harus lebih dari Rp0.';
  } else if (draft.normalPrice > 0 && draft.promoPrice > draft.normalPrice) {
    errors.promoPrice = 'Harga promo tidak boleh melebihi harga normal.';
  }

  if (!Number.isFinite(draft.stock) || draft.stock < 0) {
    errors.stock = 'Stok produk tidak boleh bernilai negatif.';
  }

  if (draft.keywords.length < MIN_KEYWORDS_PER_PRODUCT) {
    errors.keywords = `Masukkan minimal ${MIN_KEYWORDS_PER_PRODUCT} kata kunci pemicu.`;
  } else if (draft.keywords.length > MAX_KEYWORDS_PER_PRODUCT) {
    errors.keywords = `Maksimal ${MAX_KEYWORDS_PER_PRODUCT} kata kunci pemicu per produk.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function computeSessionMetrics(session: BroadcastSession): SessionSummaryMetrics {
  const totalTriggers = session.triggers.length;
  const durationSeconds = Math.max(1, session.durationSeconds);

  const perProductMap = new Map<
    string,
    {
      product: Product;
      triggerCount: number;
      totalScreenSeconds: number;
      latencySum: number;
    }
  >();

  for (const product of session.productsSnapshot) {
    perProductMap.set(product.id, {
      product,
      triggerCount: 0,
      totalScreenSeconds: 0,
      latencySum: 0,
    });
  }

  let totalLatencySum = 0;
  for (const trig of session.triggers) {
    totalLatencySum += trig.latencyMs;
    const entry = perProductMap.get(trig.productId);
    if (entry) {
      entry.triggerCount += 1;
      entry.totalScreenSeconds += trig.displayDurationSec;
      entry.latencySum += trig.latencyMs;
    } else {
      perProductMap.set(trig.productId, {
        product: {
          id: trig.productId,
          name: trig.productName,
          normalPrice: 0,
          promoPrice: 0,
          stock: 0,
          imageUrl: '',
          keywords: [trig.matchedKeyword],
          ctaText: '',
          category: 'Lainnya',
        },
        triggerCount: 1,
        totalScreenSeconds: trig.displayDurationSec,
        latencySum: trig.latencyMs,
      });
    }
  }

  const productBreakdown: ProductPerformanceRow[] = Array.from(perProductMap.values())
    .map((entry) => ({
      productId: entry.product.id,
      productName: entry.product.name,
      keywords: entry.product.keywords,
      normalPrice: entry.product.normalPrice,
      promoPrice: entry.product.promoPrice,
      discountPercent: calculateDiscountPercent(
        entry.product.normalPrice,
        entry.product.promoPrice,
      ),
      stock: entry.product.stock,
      triggerCount: entry.triggerCount,
      totalScreenSeconds: entry.totalScreenSeconds,
      avgLatencyMs:
        entry.triggerCount > 0 ? Math.round(entry.latencySum / entry.triggerCount) : 0,
      sharePercent:
        totalTriggers > 0 ? Math.round((entry.triggerCount / totalTriggers) * 100) : 0,
    }))
    .sort((a, b) => b.triggerCount - a.triggerCount || b.totalScreenSeconds - a.totalScreenSeconds);

  const uniqueProductsShown = productBreakdown.filter((r) => r.triggerCount > 0).length;
  const topProduct =
    productBreakdown.length > 0 && productBreakdown[0].triggerCount > 0
      ? productBreakdown[0]
      : null;

  const averageLatencyMs =
    totalTriggers > 0 ? Math.round(totalLatencySum / totalTriggers) : 0;

  // Divide session duration into 6 even timeline buckets for chart visualization
  const bucketCount = 6;
  const bucketSize = Math.max(10, Math.ceil(durationSeconds / bucketCount));
  const timelineBuckets = Array.from({ length: bucketCount }, (_, idx) => {
    const startSec = idx * bucketSize;
    const endSec = (idx + 1) * bucketSize;
    const count = session.triggers.filter(
      (t) =>
        t.timestampSec >= startSec &&
        (idx === bucketCount - 1 ? t.timestampSec <= Math.max(endSec, durationSeconds) : t.timestampSec < endSec),
    ).length;

    const label =
      durationSeconds >= 360
        ? `${Math.floor(startSec / 60)}m`
        : `${startSec}d`;

    return { label, startSec, endSec, count };
  });

  return {
    durationSeconds,
    totalTriggers,
    uniqueProductsShown,
    totalCatalogProducts: session.productsSnapshot.length,
    averageLatencyMs,
    slaCompliant: averageLatencyMs === 0 || averageLatencyMs <= LATENCY_SLA_MS,
    topProduct,
    productBreakdown,
    timelineBuckets,
  };
}

export function reorderProducts(
  products: Product[],
  index: number,
  direction: 'up' | 'down',
): Product[] {
  const targetIdx = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= products.length || targetIdx < 0 || targetIdx >= products.length) {
    return products;
  }
  const copy = [...products];
  const [moved] = copy.splice(index, 1);
  copy.splice(targetIdx, 0, moved);
  return copy;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildSessionCsv(session: BroadcastSession): string {
  const summary = computeSessionMetrics(session);
  const header = [
    'Judul Sesi',
    'Platform',
    'Nama Produk',
    'Kata Kunci',
    'Harga Normal',
    'Harga Promo',
    'Jumlah Terpicu',
    'Total Tayang (detik)',
    'Porsi (%)',
    'Sisa Stok',
  ];

  const rows = summary.productBreakdown.map((row) => [
    session.title,
    session.platform,
    row.productName,
    row.keywords.join('; '),
    row.normalPrice,
    row.promoPrice,
    row.triggerCount,
    row.totalScreenSeconds,
    row.sharePercent,
    row.stock,
  ]);

  return [header, ...rows]
    .map((cols) => cols.map(escapeCsvCell).join(','))
    .join('\n');
}

export function buildSessionSummaryText(session: BroadcastSession): string {
  const summary = computeSessionMetrics(session);
  const lines = [
    `Ringkasan Siaran KragieCast AI — ${session.hostStoreName}`,
    `Sesi: ${session.title} (${session.platform})`,
    `Durasi: ${formatDuration(summary.durationSeconds)} | Total Pemicu: ${summary.totalTriggers}x | Rata-rata Latensi: ${summary.averageLatencyMs} ms`,
    `Produk Terpopuler: ${summary.topProduct ? `${summary.topProduct.productName} (${summary.topProduct.triggerCount}x)` : '-'}`,
  ];

  if (session.aiRecommendations.length > 0) {
    lines.push('', 'Rekomendasi AI Pasca-Siaran:');
    session.aiRecommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec.title} — ${rec.actionStep}`);
    });
  }

  return lines.join('\n');
}

export function buildCohortCsv(
  members: Array<{
    storeName: string;
    ownerName: string;
    sector: string;
    city: string;
    sessionsThisWeek: number;
    totalTriggersMonth: number;
    avgLatencyMs: number;
    status: string;
    topProduct: string;
  }>,
): string {
  const header = [
    'Nama UMKM',
    'Pemilik',
    'Sektor',
    'Kota',
    'Sesi/Minggu',
    'Pemicu/Bulan',
    'Latensi (ms)',
    'Status',
    'Produk Terpopuler',
  ];

  const rows = members.map((m) => [
    m.storeName,
    m.ownerName,
    m.sector,
    m.city,
    m.sessionsThisWeek,
    m.totalTriggersMonth,
    m.avgLatencyMs,
    m.status,
    m.topProduct,
  ]);

  return [header, ...rows]
    .map((cols) => cols.map(escapeCsvCell).join(','))
    .join('\n');
}

const SCENARIO_MULTIPLIERS: Record<ForecastScenario, number> = {
  konservatif: 0.8,
  moderat: 1.0,
  optimis: 1.25,
};

export interface SalesForecastOptions {
  upcomingSessionsCount?: number;
  plannedDurationMinutes?: number;
  scenario?: ForecastScenario;
}

export function computeSalesForecast(
  sessions: BroadcastSession[],
  options: SalesForecastOptions = {},
): SalesForecastResult {
  const scenario: ForecastScenario = options.scenario ?? 'moderat';
  const upcomingSessionsCount = Math.max(1, Math.min(10, Math.round(options.upcomingSessionsCount ?? 3)));
  const multiplier = SCENARIO_MULTIPLIERS[scenario];

  if (sessions.length === 0) {
    const plannedDurationMinutes = Math.max(10, Math.round(options.plannedDurationMinutes ?? 45));
    return {
      basedOnSessionsCount: 0,
      scenario,
      upcomingSessionsCount,
      plannedDurationMinutes,
      historicalAverageRevenue: 0,
      trendPercentPerSession: 0,
      totalProjectedRevenue: 0,
      totalLowRevenue: 0,
      totalHighRevenue: 0,
      averageProjectedPerSession: 0,
      totalProjectedUnits: 0,
      totalProjectedTriggers: 0,
      deltaVsHistoricalPercent: 0,
      historicalPoints: [],
      projectedPoints: [],
      productForecasts: [],
    };
  }

  // Sort chronologically (oldest -> newest) so trend analysis reflects actual trajectory
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime(),
  );

  // Average known peak viewers across sessions as fallback for newly recorded sessions
  const knownViewers = chronological
    .map((s) => s.peakViewersEstimate)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const fallbackViewers =
    knownViewers.length > 0
      ? knownViewers.reduce((acc, v) => acc + v, 0) / knownViewers.length
      : 95;

  const productAgg = new Map<
    string,
    {
      productId: string;
      productName: string;
      promoPrice: number;
      currentStock: number;
      totalEstimatedUnits: number;
      totalEstimatedRevenue: number;
      totalTriggers: number;
    }
  >();

  const historicalPoints: HistoricalRevenuePoint[] = chronological.map((sess, idx) => {
    const metrics = computeSessionMetrics(sess);
    const durationMinutes = Math.max(1, sess.durationSeconds / 60);
    const viewers = sess.peakViewersEstimate && sess.peakViewersEstimate > 0
      ? sess.peakViewersEstimate
      : fallbackViewers;
    const slaFactor = metrics.slaCompliant ? 1.05 : 0.88;

    let sessionUnits = 0;
    let sessionRevenue = 0;

    for (const row of metrics.productBreakdown) {
      const effectivePrice = row.promoPrice > 0 ? row.promoPrice : row.normalPrice;
      const discountBoost = 1 + (row.discountPercent / 100) * 0.5;
      const rawUnits =
        row.triggerCount > 0
          ? row.triggerCount * (viewers / 80) * discountBoost * slaFactor
          : 0;
      const estUnits =
        row.triggerCount > 0
          ? Math.max(1, Math.min(Math.max(1, row.stock), Math.round(rawUnits)))
          : 0;
      const estRev = estUnits * effectivePrice;

      sessionUnits += estUnits;
      sessionRevenue += estRev;

      const existing = productAgg.get(row.productId);
      if (existing) {
        existing.productName = row.productName;
        if (effectivePrice > 0) existing.promoPrice = effectivePrice;
        existing.currentStock = row.stock;
        existing.totalEstimatedUnits += estUnits;
        existing.totalEstimatedRevenue += estRev;
        existing.totalTriggers += row.triggerCount;
      } else {
        productAgg.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
          promoPrice: effectivePrice,
          currentStock: row.stock,
          totalEstimatedUnits: estUnits,
          totalEstimatedRevenue: estRev,
          totalTriggers: row.triggerCount,
        });
      }
    }

    const d = new Date(sess.endedAt);
    const shortDate = Number.isNaN(d.getTime())
      ? `Sesi ${idx + 1}`
      : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    return {
      sessionId: sess.id,
      label: shortDate,
      title: sess.title,
      durationMinutes: Math.round(durationMinutes),
      triggersCount: metrics.totalTriggers,
      estimatedUnits: sessionUnits,
      estimatedRevenue: Math.round(sessionRevenue),
    };
  });

  // Compute default planned duration from historical average (rounded to nearest 5 min, min 20)
  const avgHistDuration =
    historicalPoints.reduce((acc, p) => acc + p.durationMinutes, 0) / historicalPoints.length;
  const plannedDurationMinutes = Math.max(
    15,
    Math.min(120, Math.round(options.plannedDurationMinutes ?? Math.max(20, Math.round(avgHistDuration / 5) * 5))),
  );

  // Recency-weighted baseline revenue per minute & triggers per minute
  let weightSum = 0;
  let weightedRevPerMin = 0;
  let weightedUnitsPerMin = 0;
  let weightedTriggersPerMin = 0;

  historicalPoints.forEach((pt, idx) => {
    // Only weight sessions with at least 1 minute of meaningful activity normally;
    // very short test sessions (< 5 min) get dampened weight so a 15-sec test doesn't distort hourly rate
    const durationReliability = Math.min(1, pt.durationMinutes / 15);
    const weight = (idx + 1) * Math.max(0.25, durationReliability);
    const effMinutes = Math.max(10, pt.durationMinutes);

    weightSum += weight;
    weightedRevPerMin += (pt.estimatedRevenue / effMinutes) * weight;
    weightedUnitsPerMin += (pt.estimatedUnits / effMinutes) * weight;
    weightedTriggersPerMin += (pt.triggersCount / effMinutes) * weight;
  });

  const baseRevPerMin = weightSum > 0 ? weightedRevPerMin / weightSum : 0;
  const baseUnitsPerMin = weightSum > 0 ? weightedUnitsPerMin / weightSum : 0;
  const baseTriggersPerMin = weightSum > 0 ? weightedTriggersPerMin / weightSum : 0;

  // Estimate per-session revenue trend across meaningful historical sessions (clamped to [-10%, +15%])
  let trendRate = 0.04;
  if (historicalPoints.length >= 2) {
    const first = historicalPoints[0];
    const last = historicalPoints[historicalPoints.length - 1];
    if (first.estimatedRevenue > 0 && last.estimatedRevenue > 0) {
      const steps = historicalPoints.length - 1;
      const rawStepGrowth = (last.estimatedRevenue - first.estimatedRevenue) / first.estimatedRevenue / steps;
      trendRate = Math.max(-0.1, Math.min(0.15, rawStepGrowth * 0.35));
    }
  }

  const projectedPoints: ProjectedSessionPoint[] = Array.from(
    { length: upcomingSessionsCount },
    (_, i) => {
      const step = i + 1;
      const growthFactor = Math.pow(1 + trendRate, step);
      const projectedRevenue = Math.round(
        baseRevPerMin * plannedDurationMinutes * multiplier * growthFactor,
      );
      const projectedUnits = Math.max(
        projectedRevenue > 0 ? 1 : 0,
        Math.round(baseUnitsPerMin * plannedDurationMinutes * multiplier * growthFactor),
      );
      const projectedTriggers = Math.max(
        projectedRevenue > 0 ? 1 : 0,
        Math.round(baseTriggersPerMin * plannedDurationMinutes * multiplier * growthFactor),
      );

      return {
        index: step,
        label: `Sesi +${step}`,
        durationMinutes: plannedDurationMinutes,
        projectedTriggers,
        projectedUnits,
        projectedRevenue,
        lowRevenue: Math.round(projectedRevenue * 0.82),
        highRevenue: Math.round(projectedRevenue * 1.18),
      };
    },
  );

  const totalProjectedRevenue = projectedPoints.reduce((acc, p) => acc + p.projectedRevenue, 0);
  const totalLowRevenue = projectedPoints.reduce((acc, p) => acc + p.lowRevenue, 0);
  const totalHighRevenue = projectedPoints.reduce((acc, p) => acc + p.highRevenue, 0);
  const totalProjectedUnits = projectedPoints.reduce((acc, p) => acc + p.projectedUnits, 0);
  const totalProjectedTriggers = projectedPoints.reduce((acc, p) => acc + p.projectedTriggers, 0);
  const averageProjectedPerSession = Math.round(totalProjectedRevenue / upcomingSessionsCount);

  const historicalAverageRevenue = Math.round(
    historicalPoints.reduce((acc, p) => acc + p.estimatedRevenue, 0) / historicalPoints.length,
  );
  const deltaVsHistoricalPercent =
    historicalAverageRevenue > 0
      ? Math.round(
          ((averageProjectedPerSession - historicalAverageRevenue) / historicalAverageRevenue) *
            100,
        )
      : 0;

  // Allocate projected revenue & units across catalog products using historical revenue share
  const totalHistoricalProductRev = Array.from(productAgg.values()).reduce(
    (acc, p) => acc + p.totalEstimatedRevenue,
    0,
  );

  const productForecasts: ProductForecastRow[] = Array.from(productAgg.values())
    .map((entry) => {
      const share =
        totalHistoricalProductRev > 0
          ? entry.totalEstimatedRevenue / totalHistoricalProductRev
          : 0;
      const projRev = Math.round(totalProjectedRevenue * share);
      const projUnits =
        entry.promoPrice > 0 ? Math.round(projRev / entry.promoPrice) : 0;
      const restockNeeded = Math.max(0, projUnits - entry.currentStock);

      return {
        productId: entry.productId,
        productName: entry.productName,
        promoPrice: entry.promoPrice,
        currentStock: entry.currentStock,
        projectedUnits: projUnits,
        projectedRevenue: projRev,
        revenueSharePercent: Math.round(share * 100),
        restockNeeded,
      };
    })
    .sort((a, b) => b.projectedRevenue - a.projectedRevenue);

  return {
    basedOnSessionsCount: chronological.length,
    scenario,
    upcomingSessionsCount,
    plannedDurationMinutes,
    historicalAverageRevenue,
    trendPercentPerSession: Math.round(trendRate * 100),
    totalProjectedRevenue,
    totalLowRevenue,
    totalHighRevenue,
    averageProjectedPerSession,
    totalProjectedUnits,
    totalProjectedTriggers,
    deltaVsHistoricalPercent,
    historicalPoints,
    projectedPoints,
    productForecasts,
  };
}

