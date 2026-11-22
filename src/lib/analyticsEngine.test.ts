import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCohortCsv,
  buildSessionCsv,
  buildSessionSummaryText,
  calculateDiscountPercent,
  computeSalesForecast,
  computeSessionMetrics,
  formatCompactRupiah,
  formatDuration,
  formatRupiah,
  parseKeywordsInput,
  reorderProducts,
  validateProductDraft,
} from './analyticsEngine';
import { computeCameraCrop } from './canvasOverlayRenderer';
import { INITIAL_PRODUCTS, SEED_SESSIONS, UMKM_COHORT_MEMBERS } from './seedData';

test('validateProductDraft enforces PRD FR-01 max 10 products and FR-02 1-3 keywords', () => {
  const emptyRes = validateProductDraft(
    {
      name: '',
      normalPrice: 0,
      promoPrice: 0,
      stock: -1,
      keywords: [],
      ctaText: '',
      category: 'Kuliner',
      imageUrl: '',
    },
    4,
    false,
  );
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.name);
  assert.ok(emptyRes.errors.normalPrice);
  assert.ok(emptyRes.errors.promoPrice);
  assert.ok(emptyRes.errors.stock);
  assert.ok(emptyRes.errors.keywords);

  const tooManyKeywords = validateProductDraft(
    {
      name: 'Keripik Tempe',
      normalPrice: 30000,
      promoPrice: 25000,
      stock: 15,
      keywords: ['satu', 'dua', 'tiga', 'empat'],
      ctaText: 'Beli',
      category: 'Kuliner',
      imageUrl: '',
    },
    4,
    false,
  );
  assert.equal(tooManyKeywords.valid, false);
  assert.ok(tooManyKeywords.errors.keywords);

  const atLimit = validateProductDraft(
    {
      name: 'Keripik Tempe',
      normalPrice: 30000,
      promoPrice: 25000,
      stock: 15,
      keywords: ['keripik tempe'],
      ctaText: 'Beli',
      category: 'Kuliner',
      imageUrl: '',
    },
    10,
    false,
  );
  assert.equal(atLimit.valid, false);
  assert.ok(atLimit.errors.limit);

  const valid = validateProductDraft(
    {
      name: 'Keripik Tempe Bandung',
      normalPrice: 35000,
      promoPrice: 24000,
      stock: 45,
      keywords: ['keripik tempe', 'cemilan renyah'],
      ctaText: 'Checkout',
      category: 'Kuliner',
      imageUrl: '',
    },
    4,
    false,
  );
  assert.equal(valid.valid, true);
});

test('computeSessionMetrics accurately aggregates FR-08 session performance and SLA compliance', () => {
  const summary = computeSessionMetrics(SEED_SESSIONS[0]);
  assert.equal(summary.totalTriggers, 10);
  assert.equal(summary.uniqueProductsShown, 4);
  assert.equal(summary.topProduct?.productId, 'prod-rendang');
  assert.equal(summary.topProduct?.triggerCount, 4);
  assert.equal(summary.slaCompliant, true);
  assert.ok(summary.averageLatencyMs > 0 && summary.averageLatencyMs < 1500);
  assert.equal(summary.timelineBuckets.length, 6);
});

test('formatting helpers, portrait 9:16 crop math, reorder, and CSV builders work accurately', () => {
  assert.equal(calculateDiscountPercent(100000, 75000), 25);
  assert.equal(formatRupiah(68000), 'Rp68.000');
  assert.equal(formatDuration(2538), '42m 18d');
  assert.deepEqual(parseKeywordsInput('paket hemat, promo hari ini, Paket Hemat'), [
    'paket hemat',
    'promo hari ini',
  ]);

  const cropLandscape = computeCameraCrop(1920, 1080, 16 / 9, 1.5, true, 1.2);
  assert.ok(cropLandscape.sx >= 0 && cropLandscape.sy >= 0);
  assert.equal(Math.round(cropLandscape.sw), 1280);

  const cropPortrait = computeCameraCrop(1920, 1080, 9 / 16, 1.2, true, 0.5);
  assert.ok(cropPortrait.sx >= 0 && cropPortrait.sy >= 0);
  assert.ok(cropPortrait.sx + cropPortrait.sw <= 1920.01);
  assert.ok(cropPortrait.sy + cropPortrait.sh <= 1080.01);

  const reordered = reorderProducts(INITIAL_PRODUCTS, 0, 'down');
  assert.equal(reordered[0].id, INITIAL_PRODUCTS[1].id);
  assert.equal(reordered[1].id, INITIAL_PRODUCTS[0].id);

  const sessionCsv = buildSessionCsv(SEED_SESSIONS[0]);
  assert.ok(sessionCsv.includes('Rendang Sapi Kemasan Vacum 250g'));
  assert.ok(sessionCsv.split('\n').length === 5);

  const waText = buildSessionSummaryText(SEED_SESSIONS[0]);
  assert.ok(waText.includes('Ringkasan Siaran KragieCast AI'));
  assert.ok(waText.includes('Rekomendasi AI Pasca-Siaran:'));

  const cohortCsv = buildCohortCsv(UMKM_COHORT_MEMBERS);
  assert.ok(cohortCsv.includes('Sari Rasa Nusantara'));
  assert.equal(cohortCsv.split('\n').length, UMKM_COHORT_MEMBERS.length + 1);
});

test('computeSalesForecast projects upcoming revenue accurately from historical broadcast sessions', () => {
  const empty = computeSalesForecast([]);
  assert.equal(empty.basedOnSessionsCount, 0);
  assert.equal(empty.totalProjectedRevenue, 0);
  assert.equal(empty.projectedPoints.length, 0);

  const conservative = computeSalesForecast(SEED_SESSIONS, {
    upcomingSessionsCount: 3,
    plannedDurationMinutes: 45,
    scenario: 'konservatif',
  });
  const moderate = computeSalesForecast(SEED_SESSIONS, {
    upcomingSessionsCount: 3,
    plannedDurationMinutes: 45,
    scenario: 'moderat',
  });
  const optimistic = computeSalesForecast(SEED_SESSIONS, {
    upcomingSessionsCount: 3,
    plannedDurationMinutes: 45,
    scenario: 'optimis',
  });

  assert.equal(moderate.basedOnSessionsCount, SEED_SESSIONS.length);
  assert.equal(moderate.historicalPoints.length, SEED_SESSIONS.length);
  assert.equal(moderate.projectedPoints.length, 3);
  assert.ok(conservative.totalProjectedRevenue > 0);
  assert.ok(conservative.totalProjectedRevenue < moderate.totalProjectedRevenue);
  assert.ok(moderate.totalProjectedRevenue < optimistic.totalProjectedRevenue);
  assert.ok(moderate.totalLowRevenue < moderate.totalProjectedRevenue);
  assert.ok(moderate.totalHighRevenue > moderate.totalProjectedRevenue);
  assert.equal(moderate.productForecasts.length, INITIAL_PRODUCTS.length);

  // Longer duration must scale projected revenue upward
  const longer = computeSalesForecast(SEED_SESSIONS, {
    upcomingSessionsCount: 3,
    plannedDurationMinutes: 60,
    scenario: 'moderat',
  });
  assert.ok(longer.totalProjectedRevenue > moderate.totalProjectedRevenue);

  // Compact rupiah formatting checks
  assert.equal(formatCompactRupiah(1500000), 'Rp1,5 jt');
  assert.equal(formatCompactRupiah(450000), 'Rp450 rb');
});

