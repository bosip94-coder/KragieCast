import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Download, Radio, RefreshCw, TrendingUp } from 'lucide-react';
import type {
  AiRecommendation,
  BroadcastSession,
  ForecastScenario,
} from '../types/kragiecast';
import {
  LATENCY_SLA_MS,
  buildSessionCsv,
  buildSessionSummaryText,
  computeSalesForecast,
  computeSessionMetrics,
  formatClockTimer,
  formatCompactRupiah,
  formatDuration,
  formatRupiah,
} from '../lib/analyticsEngine';

interface PostLiveAnalyticsProps {
  sessions: BroadcastSession[];
  selectedSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onUpdateSessionRecommendations: (
    sessionId: string,
    recommendations: AiRecommendation[],
    generatedAt: string,
  ) => void;
  onStartNewSession: () => void;
}

export function PostLiveAnalytics({
  sessions,
  selectedSessionId,
  onSelectSession,
  onUpdateSessionRecommendations,
  onStartNewSession,
}: PostLiveAnalyticsProps) {
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [forecastScenario, setForecastScenario] = useState<ForecastScenario>('moderat');
  const [upcomingSessionsCount, setUpcomingSessionsCount] = useState<number>(3);
  const [plannedDurationMinutes, setPlannedDurationMinutes] = useState<number>(45);
  const autoRequestedRef = useRef<Set<string>>(new Set());

  const activeSession =
    sessions.find((s) => s.id === selectedSessionId) ?? sessions[0] ?? null;

  const metrics = useMemo(
    () => (activeSession ? computeSessionMetrics(activeSession) : null),
    [activeSession],
  );

  const salesForecast = useMemo(
    () =>
      computeSalesForecast(sessions, {
        scenario: forecastScenario,
        upcomingSessionsCount,
        plannedDurationMinutes,
      }),
    [sessions, forecastScenario, upcomingSessionsCount, plannedDurationMinutes],
  );

  const requestAiRecommendations = useCallback(
    async (session: BroadcastSession) => {
      const summary = computeSessionMetrics(session);
      setLoadingAi(true);
      setAiError(null);

      try {
        const response = await fetch('/api/analytics/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionTitle: session.title,
            durationSeconds: session.durationSeconds,
            totalTriggers: summary.totalTriggers,
            averageLatencyMs: summary.averageLatencyMs,
            overlayDurationSeconds: session.overlayDurationSeconds,
            products: summary.productBreakdown.map((p) => ({
              name: p.productName,
              normalPrice: p.normalPrice,
              promoPrice: p.promoPrice,
              stock: p.stock,
              keywords: p.keywords,
              triggerCount: p.triggerCount,
              screenSeconds: p.totalScreenSeconds,
            })),
            recentTranscripts: session.transcripts.slice(-6),
          }),
        });

        const data = (await response.json()) as {
          recommendations?: AiRecommendation[];
          generatedAt?: string;
          error?: string;
        };

        if (!response.ok || !data.recommendations) {
          throw new Error(data.error || 'Gagal memuat rekomendasi AI pasca-siaran.');
        }

        onUpdateSessionRecommendations(
          session.id,
          data.recommendations,
          data.generatedAt ?? new Date().toISOString(),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Terjadi kendala koneksi saat analisis AI.';
        setAiError(msg);
      } finally {
        setLoadingAi(false);
      }
    },
    [onUpdateSessionRecommendations],
  );

  // Automatically generate FR-09 AI recommendations when viewing a newly ended session without insights yet
  useEffect(() => {
    if (
      activeSession &&
      activeSession.aiRecommendations.length === 0 &&
      !autoRequestedRef.current.has(activeSession.id)
    ) {
      autoRequestedRef.current.add(activeSession.id);
      void requestAiRecommendations(activeSession);
    }
  }, [activeSession, requestAiRecommendations]);

  if (!activeSession || !metrics) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
        <h1 className="font-display text-xl font-bold text-slate-900">
          Belum Ada Riwayat Siaran
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Mulai sesi siaran pertama di Virtual Studio untuk mendapatkan ringkasan performa Big
          Data dan 3 poin rekomendasi AI secara otomatis.
        </p>
        <button
          type="button"
          onClick={onStartNewSession}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
        >
          <Radio className="h-4 w-4" aria-hidden="true" />
          Mulai Siaran Pertama
        </button>
      </div>
    );
  }

  const maxBucket = Math.max(2, ...metrics.timelineBuckets.map((b) => b.count));

  const handleDownloadCsv = () => {
    const csv = buildSessionCsv(activeSession);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-siaran-${activeSession.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = async () => {
    const summaryText = buildSessionSummaryText(activeSession);
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2200);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Session Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1 min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Analitik Pasca-Siaran
          </h1>
          <p className="text-sm text-slate-600">
            {activeSession.title} · {activeSession.platform} ·{' '}
            {new Date(activeSession.endedAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2.5 w-full lg:w-auto">
          <div className="w-full sm:w-72">
            <label
              htmlFor="session-history-select"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Pilih Sesi Siaran ({sessions.length} tersimpan)
            </label>
            <select
              id="session-history-select"
              value={activeSession.id}
              onChange={(e) => {
                setAiError(null);
                onSelectSession(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            >
              {sessions.map((sess) => (
                <option key={sess.id} value={sess.id}>
                  {sess.title} ({formatDuration(sess.durationSeconds)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {copiedSummary ? (
                <Check className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copiedSummary ? 'Ringkasan Disalin' : 'Salin Ringkasan'}
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Unduh CSV
            </button>
          </div>
        </div>
      </div>

      {/* FR-08: 4-Column KPI Summary Strip (Tabular Numerals, Single-Elevation Flat Borders) */}
      <section aria-label="Ringkasan Metrik Sesi" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Durasi Siaran</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
            {formatDuration(metrics.durationSeconds)}
          </p>
          <p className="text-xs text-slate-500">
            Overlay {activeSession.overlayDurationSeconds}d per pemicu
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Total Kata Kunci Terpicu</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
            {metrics.totalTriggers}x
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {metrics.uniqueProductsShown} dari {metrics.totalCatalogProducts} produk katalog tampil
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Produk Paling Sering Tampil</p>
          <p className="font-display text-base font-bold text-slate-900 truncate" title={metrics.topProduct?.productName}>
            {metrics.topProduct ? metrics.topProduct.productName : 'Belum ada produk terpicu'}
          </p>
          <p className="text-xs font-mono tabular-nums text-slate-500">
            {metrics.topProduct
              ? `${metrics.topProduct.triggerCount}x tayang · ${metrics.topProduct.totalScreenSeconds} detik layar`
              : '0x tayang'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Rata-Rata Latensi Trigger</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
            {metrics.averageLatencyMs > 0 ? `${metrics.averageLatencyMs} ms` : '—'}
          </p>
          <p
            className={`text-xs font-medium ${
              metrics.slaCompliant ? 'text-teal-700' : 'text-amber-700'
            }`}
          >
            {metrics.averageLatencyMs === 0
              ? `Target SLA < ${LATENCY_SLA_MS} ms`
              : metrics.slaCompliant
                ? `Memenuhi target < ${LATENCY_SLA_MS} ms`
                : `Melebihi batas ${LATENCY_SLA_MS} ms`}
          </p>
        </div>
      </section>

      {/* FR-09: 3 Poin Rekomendasi AI + Timeline Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: FR-09 Rekomendasi AI Sederhana */}
        <section
          aria-labelledby="ai-recs-heading"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h2 id="ai-recs-heading" className="font-display text-lg font-bold text-slate-900">
                Rekomendasi AI Pasca-Siaran
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                3 saran strategis berbasis data penyebutan kata kunci, durasi layar, dan stok sesi
              </p>
            </div>
            <button
              type="button"
              disabled={loadingAi}
              onClick={() => void requestAiRecommendations(activeSession)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingAi ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {loadingAi ? 'Menganalisis...' : 'Analisis Ulang AI'}
            </button>
          </div>

          {loadingAi ? (
            <div className="space-y-4" aria-busy="true" aria-label="Memuat rekomendasi AI">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="space-y-2 py-2 animate-pulse">
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                  <div className="h-3 w-full bg-slate-100 rounded" />
                  <div className="h-3 w-5/6 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : aiError ? (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Analisis AI tidak dapat diselesaikan</span>
              </div>
              <p className="text-xs text-red-700 leading-relaxed">{aiError}</p>
              <button
                type="button"
                onClick={() => void requestAiRecommendations(activeSession)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Coba Analisis Kembali
              </button>
            </div>
          ) : activeSession.aiRecommendations.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Rekomendasi AI belum dibuat untuk sesi ini.
              </p>
              <button
                type="button"
                onClick={() => void requestAiRecommendations(activeSession)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Buat 3 Rekomendasi AI Sekarang
              </button>
            </div>
          ) : (
            <ol className="divide-y divide-slate-200">
              {activeSession.aiRecommendations.map((rec, index) => (
                <li key={`${rec.title}-${index}`} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      0{index + 1}. {rec.title}
                    </h3>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        rec.priority === 'Tinggi'
                          ? 'text-red-700'
                          : rec.priority === 'Sedang'
                            ? 'text-amber-700'
                            : 'text-teal-700'
                      }`}
                    >
                      Prioritas {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{rec.detail}</p>
                  <p className="text-xs font-medium text-slate-800 pt-0.5">
                    Langkah berikutnya: <span className="font-normal text-slate-600">{rec.actionStep}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Right 5 cols: Trigger Timeline SVG Chart */}
        <section
          aria-labelledby="timeline-heading"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div>
            <h2 id="timeline-heading" className="font-display text-lg font-bold text-slate-900">
              Distribusi Pemicu Kata Kunci
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Frekuensi kemunculan overlay produk sepanjang durasi siaran
            </p>
          </div>

          <div className="pt-2">
            <svg
              viewBox="0 0 360 190"
              role="img"
              aria-label="Grafik batang frekuensi pemicu overlay sepanjang sesi siaran"
              className="w-full h-auto"
            >
              {/* Subtle horizontal grid lines */}
              {[0, 0.5, 1].map((ratio) => {
                const y = 20 + (1 - ratio) * 130;
                return (
                  <g key={ratio}>
                    <line
                      x1="24"
                      y1={y}
                      x2="348"
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                    <text
                      x="18"
                      y={y + 4}
                      textAnchor="end"
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {Math.round(maxBucket * ratio)}
                    </text>
                  </g>
                );
              })}

              {metrics.timelineBuckets.map((bucket, idx) => {
                const slotW = 316 / metrics.timelineBuckets.length;
                const barW = Math.min(34, slotW - 14);
                const x = 32 + idx * slotW + (slotW - barW) / 2;
                const barH = Math.max(4, (bucket.count / maxBucket) * 130);
                const y = 150 - barH;

                return (
                  <g key={bucket.label}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="4"
                      fill={bucket.count > 0 ? '#0f172a' : '#e2e8f0'}
                    />
                    {bucket.count > 0 && (
                      <text
                        x={x + barW / 2}
                        y={y - 5}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {bucket.count}
                      </text>
                    )}
                    <text
                      x={x + barW / 2}
                      y="172"
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {bucket.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            Jeda antar penyebutan kata kunci yang merata menjaga penonton baru tetap melihat promo
            saat bergabung di tengah siaran.
          </p>
        </section>
      </div>

      {/* Sales Forecast (Proyeksi Penjualan) Section */}
      {(() => {
        const recentHistory = salesForecast.historicalPoints.slice(-4);
        const chartBars = [
          ...recentHistory.map((pt) => ({
            key: `hist-${pt.sessionId}`,
            label: pt.label,
            revenue: pt.estimatedRevenue,
            lowRevenue: pt.estimatedRevenue,
            highRevenue: pt.estimatedRevenue,
            isProjected: false,
          })),
          ...salesForecast.projectedPoints.map((pt) => ({
            key: `proj-${pt.index}`,
            label: pt.label,
            revenue: pt.projectedRevenue,
            lowRevenue: pt.lowRevenue,
            highRevenue: pt.highRevenue,
            isProjected: true,
          })),
        ];

        const maxForecastRev = Math.max(
          200_000,
          ...chartBars.map((b) => Math.max(b.revenue, b.highRevenue)),
        );
        // Round chart ceiling cleanly to nearest 200k or 500k
        const stepUnit = maxForecastRev >= 2_000_000 ? 500_000 : 200_000;
        const chartMax = Math.ceil(maxForecastRev / stepUnit) * stepUnit;
        const chartLeft = 64;
        const chartRight = 544;
        const chartTop = 24;
        const chartBottom = 176;
        const chartHeight = chartBottom - chartTop;
        const plotWidth = chartRight - chartLeft;
        const slotWidth = chartBars.length > 0 ? plotWidth / chartBars.length : plotWidth;
        const barWidth = Math.min(44, Math.max(20, slotWidth - 16));
        const dividerX =
          recentHistory.length > 0 && salesForecast.projectedPoints.length > 0
            ? chartLeft + recentHistory.length * slotWidth
            : null;

        return (
          <section
            aria-labelledby="sales-forecast-heading"
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            {/* Section Header + Interactive Forecast Controls */}
            <div className="p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-end justify-between gap-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-700 shrink-0" aria-hidden="true" />
                  <h2
                    id="sales-forecast-heading"
                    className="font-display text-lg font-bold text-slate-900"
                  >
                    Proyeksi Penjualan (Sales Forecast)
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Estimasi potensi omzet untuk {upcomingSessionsCount} sesi mendatang berdasarkan
                  pola pemicu, harga promo, dan performa {salesForecast.basedOnSessionsCount} sesi
                  historis
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                {/* Scenario Switcher */}
                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-500">
                    Skenario Proyeksi
                  </span>
                  <div
                    role="tablist"
                    aria-label="Pilih skenario proyeksi penjualan"
                    className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                  >
                    {(
                      [
                        { id: 'konservatif', label: 'Konservatif' },
                        { id: 'moderat', label: 'Moderat' },
                        { id: 'optimis', label: 'Optimis' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="tab"
                        aria-selected={forecastScenario === opt.id}
                        onClick={() => setForecastScenario(opt.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          forecastScenario === opt.id
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horizon Switcher */}
                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-500">
                    Horizon Jadwal
                  </span>
                  <div
                    role="tablist"
                    aria-label="Pilih jumlah sesi proyeksi mendatang"
                    className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                  >
                    {[1, 3, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        role="tab"
                        aria-selected={upcomingSessionsCount === count}
                        onClick={() => setUpcomingSessionsCount(count)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          upcomingSessionsCount === count
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {count} Sesi
                      </button>
                    ))}
                  </div>
                </div>

                {/* Planned Session Duration Slider */}
                <div className="w-44 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <label htmlFor="forecast-duration-slider" className="font-medium text-slate-500">
                      Target Durasi
                    </label>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {plannedDurationMinutes} menit
                    </span>
                  </div>
                  <input
                    id="forecast-duration-slider"
                    type="range"
                    min={20}
                    max={90}
                    step={5}
                    value={plannedDurationMinutes}
                    onChange={(e) => setPlannedDurationMinutes(Number(e.target.value))}
                    className="w-full accent-teal-700"
                  />
                </div>
              </div>
            </div>

            {/* 3-Column Hairline-Divided Forecast KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/40">
              <div className="p-5 space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  Total Proyeksi Omzet ({upcomingSessionsCount} Sesi)
                </p>
                <p
                  data-testid="forecast-total-revenue"
                  className="font-mono tabular-nums text-2xl font-bold text-slate-900"
                >
                  {formatRupiah(salesForecast.totalProjectedRevenue)}
                </p>
                <p className="text-xs font-mono tabular-nums text-slate-500">
                  Rentang {formatCompactRupiah(salesForecast.totalLowRevenue)} –{' '}
                  {formatCompactRupiah(salesForecast.totalHighRevenue)}
                </p>
              </div>

              <div className="p-5 space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  Proyeksi Rata-Rata Per Sesi
                </p>
                <p
                  data-testid="forecast-avg-session"
                  className="font-mono tabular-nums text-2xl font-bold text-slate-900"
                >
                  {formatRupiah(salesForecast.averageProjectedPerSession)}
                </p>
                <p
                  className={`text-xs font-medium tabular-nums ${
                    salesForecast.deltaVsHistoricalPercent >= 0
                      ? 'text-teal-700'
                      : 'text-amber-700'
                  }`}
                >
                  {salesForecast.deltaVsHistoricalPercent >= 0 ? '+' : ''}
                  {salesForecast.deltaVsHistoricalPercent}% dibanding rata-rata historis (
                  {formatCompactRupiah(salesForecast.historicalAverageRevenue)})
                </p>
              </div>

              <div className="p-5 space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  Estimasi Volume &amp; Aktivitas Overlay
                </p>
                <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                  {salesForecast.totalProjectedUnits} unit
                </p>
                <p className="text-xs font-mono tabular-nums text-slate-500">
                  ~{salesForecast.totalProjectedTriggers} pemicu kata kunci ·{' '}
                  {plannedDurationMinutes} mnt/sesi
                </p>
              </div>
            </div>

            {/* Chart + Product Contribution Breakdown */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 Cols: Historical vs Projected Bar Chart */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Tren Omzet Historis &amp; Proyeksi Sesi Mendatang
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-xs bg-slate-900 inline-block"
                        aria-hidden="true"
                      />
                      Historis
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-xs bg-teal-700 inline-block"
                        aria-hidden="true"
                      />
                      Proyeksi ({forecastScenario})
                    </span>
                  </div>
                </div>

                <svg
                  viewBox="0 0 560 212"
                  role="img"
                  aria-label="Grafik batang perbandingan estimasi omzet sesi historis dan proyeksi sesi mendatang"
                  className="w-full h-auto"
                >
                  {[0, 0.5, 1].map((ratio) => {
                    const y = chartTop + (1 - ratio) * chartHeight;
                    return (
                      <g key={ratio}>
                        <line
                          x1={chartLeft}
                          y1={y}
                          x2={chartRight}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />
                        <text
                          x={chartLeft - 8}
                          y={y + 4}
                          textAnchor="end"
                          fill="#94a3b8"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {ratio === 0 ? 'Rp0' : formatCompactRupiah(chartMax * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {dividerX !== null && (
                    <g>
                      <line
                        x1={dividerX}
                        y1={chartTop - 6}
                        x2={dividerX}
                        y2={chartBottom}
                        stroke="#94a3b8"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={dividerX + 6}
                        y={chartTop - 8}
                        fill="#0f766e"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        PROYEKSI
                      </text>
                    </g>
                  )}

                  {chartBars.map((bar, idx) => {
                    const x = chartLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
                    const barH = Math.max(4, (bar.revenue / chartMax) * chartHeight);
                    const y = chartBottom - barH;
                    const highY = chartBottom - (bar.highRevenue / chartMax) * chartHeight;
                    const lowY = chartBottom - (bar.lowRevenue / chartMax) * chartHeight;
                    const centerX = x + barWidth / 2;

                    return (
                      <g key={bar.key}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barH}
                          rx="4"
                          fill={bar.isProjected ? '#0f766e' : '#0f172a'}
                          fillOpacity={bar.isProjected ? 0.9 : 1}
                        />
                        {bar.isProjected && bar.highRevenue > bar.lowRevenue && (
                          <g stroke="#0f766e" strokeWidth="1.25" opacity="0.65">
                            <line x1={centerX} y1={highY} x2={centerX} y2={lowY} />
                            <line x1={centerX - 5} y1={highY} x2={centerX + 5} y2={highY} />
                            <line x1={centerX - 5} y1={lowY} x2={centerX + 5} y2={lowY} />
                          </g>
                        )}
                        <text
                          x={centerX}
                          y={(bar.isProjected ? highY : y) - 5}
                          textAnchor="middle"
                          fill={bar.isProjected ? '#0f766e' : '#0f172a'}
                          fontSize="10"
                          fontWeight="600"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {formatCompactRupiah(bar.revenue)}
                        </text>
                        <text
                          x={centerX}
                          y={chartBottom + 18}
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {bar.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Garis tipis pada batang proyeksi menunjukkan rentang kepercayaan ±18% yang
                  dihitung dari kecepatan pemicu per menit, harga promo katalog, serta tren
                  pertumbuhan antar sesi historis.
                </p>
              </div>

              {/* Right 5 Cols: Per-Product Forecast & Restock Readiness */}
              <div className="lg:col-span-5 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Kontribusi Produk &amp; Kesiapan Stok
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kebutuhan stok untuk memenuhi proyeksi {upcomingSessionsCount} sesi berikutnya
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 pl-3.5 pr-2">Produk</th>
                          <th className="py-2.5 px-2 text-right">Est. Unit</th>
                          <th className="py-2.5 px-2 text-right">Omzet</th>
                          <th className="py-2.5 pl-2 pr-3.5 text-right">Stok</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {salesForecast.productForecasts.map((item) => (
                          <tr key={item.productId} className="hover:bg-slate-50/60">
                            <td className="py-2.5 pl-3.5 pr-2">
                              <p className="font-semibold text-slate-900 truncate max-w-[150px]" title={item.productName}>
                                {item.productName}
                              </p>
                              <p className="text-[11px] font-mono tabular-nums text-slate-500">
                                {item.revenueSharePercent}% kontribusi
                              </p>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {item.projectedUnits} unit
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                              {formatCompactRupiah(item.projectedRevenue)}
                            </td>
                            <td className="py-2.5 pl-2 pr-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                              {item.restockNeeded > 0 ? (
                                <span className="text-amber-700 font-semibold">
                                  Restok +{item.restockNeeded}
                                </span>
                              ) : (
                                <span className="text-teal-700 font-medium">Aman</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Detailed Per-Product Performance Table */}
      <section aria-labelledby="product-perf-heading" className="space-y-3">
        <div>
          <h2 id="product-perf-heading" className="font-display text-lg font-bold text-slate-900">
            Rincian Performa Katalog Produk
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Perbandingan jumlah penyebutan kata kunci, durasi tampil di layar, dan sisa stok akhir
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 pl-5 pr-4">Produk</th>
                  <th className="py-3 px-4 text-right">Harga Promo</th>
                  <th className="py-3 px-4 text-right">Kata Kunci Terpicu</th>
                  <th className="py-3 px-4 text-right">Total Tayang Layar</th>
                  <th className="py-3 px-4 text-right">Porsi Siaran</th>
                  <th className="py-3 pl-4 pr-5 text-right">Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {metrics.productBreakdown.map((row) => (
                  <tr key={row.productId} className="hover:bg-slate-50/60">
                    <td className="py-3.5 pl-5 pr-4">
                      <p className="font-semibold text-slate-900">{row.productName}</p>
                      <p className="text-xs font-mono text-slate-500">
                        {row.keywords.join(' · ')}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {row.promoPrice > 0 ? formatRupiah(row.promoPrice) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {row.triggerCount}x
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {row.totalScreenSeconds} detik
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {row.sharePercent}%
                    </td>
                    <td className="py-3.5 pl-4 pr-5 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          row.stock <= 10 ? 'text-amber-700 font-semibold' : 'text-slate-700'
                        }
                      >
                        {row.stock} unit
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Timestamped Keyword Trigger Inspector Table */}
      <section aria-labelledby="trigger-log-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 id="trigger-log-heading" className="font-display text-lg font-bold text-slate-900">
              Log Momen Pemicu Kata Kunci
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Jejak kronologis ucapan host yang memicu tampilan overlay beserta waktu respons sistem
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {activeSession.triggers.length} momen tercatat
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {activeSession.triggers.length === 0 ? (
            <div className="py-10 px-6 text-center space-y-1">
              <p className="text-sm font-medium text-slate-700">
                Belum ada momen pemicu kata kunci pada sesi ini
              </p>
              <p className="text-xs text-slate-500">
                Saat host menyebut kata kunci produk di Virtual Studio, riwayat waktu dan latensi
                otomatis tercatat di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 pl-5 pr-4">Waktu</th>
                    <th className="py-3 px-4">Kata Kunci</th>
                    <th className="py-3 px-4">Produk Ditampilkan</th>
                    <th className="py-3 px-4">Transkrip Ucapan</th>
                    <th className="py-3 pl-4 pr-5 text-right">Latensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeSession.triggers.map((trig) => (
                    <tr key={trig.id} className="hover:bg-slate-50/60">
                      <td className="py-3 pl-5 pr-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {formatClockTimer(trig.timestampSec)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        &ldquo;{trig.matchedKeyword}&rdquo;
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {trig.productName}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-md">
                        <span className="line-clamp-2">&ldquo;{trig.transcript}&rdquo;</span>
                      </td>
                      <td className="py-3 pl-4 pr-5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                        <span
                          className={
                            trig.latencyMs <= LATENCY_SLA_MS
                              ? 'text-teal-700 font-semibold'
                              : 'text-amber-700 font-semibold'
                          }
                        >
                          {trig.latencyMs} ms
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
