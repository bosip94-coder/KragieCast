import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Pencil,
  Plus,
  Radio,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  HostGender,
  OverlayConfig,
  OverlayTemplateId,
  Product,
} from '../types/kragiecast';
import {
  MAX_PRODUCTS_PER_SESSION,
  calculateDiscountPercent,
  formatRupiah,
} from '../lib/analyticsEngine';
import { matchProductKeyword } from '../lib/keywordEngine';
import {
  HOST_CHARACTERS,
  OVERLAY_TEMPLATES,
  getHostCharacterById,
} from '../lib/seedData';
import { renderBroadcastFrame } from '../lib/canvasOverlayRenderer';
import { ResilientImage } from './ResilientImage';
import { ProductModal } from './ProductModal';

interface PreLiveSetupProps {
  sessionTitle: string;
  onChangeSessionTitle: (title: string) => void;
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onReorderProduct: (index: number, direction: 'up' | 'down') => void;
  overlayConfig: OverlayConfig;
  onChangeOverlayConfig: (config: OverlayConfig) => void;
  storeName: string;
  selectedHostId: string;
  onSelectHost: (hostId: string) => void;
  onProceedToStudio: () => void;
}

export function PreLiveSetup({
  sessionTitle,
  onChangeSessionTitle,
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onReorderProduct,
  overlayConfig,
  onChangeOverlayConfig,
  storeName,
  selectedHostId,
  onSelectHost,
  onProceedToStudio,
}: PreLiveSetupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hostGenderFilter, setHostGenderFilter] = useState<'semua' | HostGender>('semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [previewProductId, setPreviewProductId] = useState<string>(products[0]?.id ?? '');
  const [keywordTestInput, setKeywordTestInput] = useState('');
  const [keywordTestResult, setKeywordTestResult] = useState<{
    matched: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const productImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const selectedHost = getHostCharacterById(selectedHostId);
  const visibleHosts = HOST_CHARACTERS.filter(
    (h) => hostGenderFilter === 'semua' || h.gender === hostGenderFilter,
  );
  const femaleCount = HOST_CHARACTERS.filter((h) => h.gender === 'perempuan').length;
  const maleCount = HOST_CHARACTERS.filter((h) => h.gender === 'laki-laki').length;

  const activePreviewProduct =
    products.find((p) => p.id === previewProductId) ?? products[0] ?? null;
  const activePreviewEtalaseNumber = activePreviewProduct
    ? products.findIndex((p) => p.id === activePreviewProduct.id) + 1
    : 1;

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  // Render live HTML5 Canvas preview whenever template, config, host character, or selected product changes
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const hostImg = hostImgCacheRef.current.get(selectedHost.imageUrl) ?? null;
      const prodImg = activePreviewProduct
        ? productImgCacheRef.current.get(activePreviewProduct.imageUrl) ?? null
        : null;

      renderBroadcastFrame(
        ctx,
        canvas.width,
        canvas.height,
        hostImg,
        {
          zoom: 1.05,
          autoFraming: true,
          showFaceGuide: false,
          driftPhase: 0,
        },
        activePreviewProduct
          ? {
              product: activePreviewProduct,
              etalaseNumber: activePreviewEtalaseNumber,
              templateId: overlayConfig.templateId,
              ctaText: activePreviewProduct.ctaText || overlayConfig.defaultCta,
              showStockAlert: overlayConfig.showStockAlert,
              progress: 0.72,
              remainingSec: Math.round(overlayConfig.durationSeconds * 0.72),
              enterProgress: 1,
            }
          : null,
        prodImg,
        {
          isLive: false,
          elapsedLabel: '00:00:00',
          storeName,
        },
      );
    };

    if (!hostImgCacheRef.current.has(selectedHost.imageUrl)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        hostImgCacheRef.current.set(selectedHost.imageUrl, img);
        draw();
      };
      img.src = selectedHost.imageUrl;
    }

    if (activePreviewProduct && activePreviewProduct.imageUrl) {
      const cached = productImgCacheRef.current.get(activePreviewProduct.imageUrl);
      if (!cached) {
        const pImg = new Image();
        pImg.crossOrigin = 'anonymous';
        pImg.onload = () => {
          productImgCacheRef.current.set(activePreviewProduct.imageUrl, pImg);
          draw();
        };
        pImg.src = activePreviewProduct.imageUrl;
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [activePreviewProduct, activePreviewEtalaseNumber, overlayConfig, selectedHost, storeName]);

  const handleRunKeywordTest = () => {
    const phrase = keywordTestInput.trim();
    if (!phrase) {
      setKeywordTestResult({
        matched: false,
        message: 'Ketik kalimat ucapan host untuk menguji deteksi kata kunci.',
      });
      return;
    }
    const res = matchProductKeyword(phrase, products);
    if (res) {
      setPreviewProductId(res.product.id);
      setKeywordTestResult({
        matched: true,
        message: `Terdeteksi kata kunci "${res.matchedKeyword}" → Memicu overlay "${res.product.name}"`,
        latencyMs: res.latencyMs,
      });
    } else {
      setKeywordTestResult({
        matched: false,
        message: 'Belum ada kata kunci katalog yang cocok dengan kalimat tersebut.',
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header & Session Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Persiapan Siaran Live Commerce
          </h1>
          <p className="text-sm text-slate-600">
            Atur katalog hingga 10 produk, tentukan 1–3 kata kunci pemicu suara, dan pilih desain
            overlay profesional sebelum membuka Virtual Studio.
          </p>
        </div>

        <div className="w-full md:w-80">
          <label
            htmlFor="session-title-input"
            className="block text-xs font-medium text-slate-500 mb-1"
          >
            Judul Sesi Siaran Berikutnya
          </label>
          <input
            id="session-title-input"
            type="text"
            value={sessionTitle}
            onChange={(e) => onChangeSessionTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
          />
        </div>
      </div>

      {/* FR-01 & FR-02: Product Catalog & Keyword Trigger Configuration */}
      <section aria-labelledby="catalog-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="catalog-heading" className="font-display text-lg font-bold text-slate-900">
              01. Katalog Produk &amp; Kata Kunci Pemicu
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {products.length} / {MAX_PRODUCTS_PER_SESSION} Produk Terdaftar · Setiap produk
              memiliki 1–3 kata kunci pemicu otomatis
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-56">
              <Search
                className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk atau kata kunci..."
                aria-label="Cari produk atau kata kunci"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <button
              type="button"
              disabled={products.length >= MAX_PRODUCTS_PER_SESSION}
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah Produk
            </button>
          </div>
        </div>

        {/* High-density Catalog Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredProducts.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                {products.length === 0
                  ? 'Belum ada produk pada sesi ini'
                  : 'Tidak ada produk yang cocok dengan pencarian'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {products.length === 0
                  ? 'Tambahkan produk pertama beserta kata kunci pemicu suara agar overlay tampil otomatis saat Anda berbicara.'
                  : 'Coba kata kunci lain atau hapus filter pencarian.'}
              </p>
              {products.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setModalOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Tambah Produk Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 pl-5 pr-2 w-20">Etalase</th>
                    <th className="py-3 px-4">Produk</th>
                    <th className="py-3 px-4">Kata Kunci Pemicu (Suara)</th>
                    <th className="py-3 px-4 text-right">Harga Normal</th>
                    <th className="py-3 px-4 text-right">Harga Promo</th>
                    <th className="py-3 px-4 text-right">Stok</th>
                    <th className="py-3 pl-4 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map((product) => {
                    const discount = calculateDiscountPercent(
                      product.normalPrice,
                      product.promoPrice,
                    );
                    const isSelectedPreview = activePreviewProduct?.id === product.id;
                    const globalIdx = products.findIndex((p) => p.id === product.id);
                    const etalaseNum = globalIdx + 1;

                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          isSelectedPreview ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-3.5 pl-5 pr-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono tabular-nums text-xs font-bold text-slate-700 w-6">
                              #{etalaseNum}
                            </span>
                            {!searchQuery.trim() && (
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  disabled={globalIdx === 0}
                                  onClick={() => onReorderProduct(globalIdx, 'up')}
                                  aria-label={`Naikkan urutan ${product.name}`}
                                  className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={globalIdx === products.length - 1}
                                  onClick={() => onReorderProduct(globalIdx, 'down')}
                                  aria-label={`Turunkan urutan ${product.name}`}
                                  className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3 min-w-[210px]">
                            <ResilientImage
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-11 w-11 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setPreviewProductId(product.id)}
                                className="font-semibold text-slate-900 hover:text-red-600 text-left truncate block max-w-[230px]"
                              >
                                {product.name}
                              </button>
                              <p className="text-xs text-slate-500">
                                {product.category} · {product.ctaText}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-xs font-mono text-slate-700 leading-relaxed">
                            {product.keywords.map((kw, i) => (
                              <span key={kw}>
                                &ldquo;{kw}&rdquo;
                                {i < product.keywords.length - 1 ? '  ·  ' : ''}
                              </span>
                            ))}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-500 line-through whitespace-nowrap">
                          {formatRupiah(product.normalPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            {formatRupiah(product.promoPrice)}
                          </span>
                          {discount > 0 && (
                            <span className="block text-[11px] font-mono tabular-nums text-red-600 font-medium">
                              Hemat {discount}%
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={
                              product.stock <= 10
                                ? 'text-amber-700 font-semibold'
                                : 'text-slate-700'
                            }
                          >
                            {product.stock} unit
                          </span>
                        </td>
                        <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewProductId(product.id)}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                isSelectedPreview
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              {isSelectedPreview ? 'Dipratinjau' : 'Pratinjau'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(product);
                                setModalOpen(true);
                              }}
                              aria-label={`Edit ${product.name}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteProduct(product.id)}
                              aria-label={`Hapus ${product.name}`}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick Keyword Trigger Tester Strip */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row md:items-center gap-3">
            <label
              htmlFor="quick-keyword-test"
              className="text-xs font-semibold text-slate-700 whitespace-nowrap"
            >
              Uji Kata Kunci Cepat:
            </label>
            <div className="flex flex-1 items-center gap-2">
              <input
                id="quick-keyword-test"
                type="text"
                value={keywordTestInput}
                onChange={(e) => setKeywordTestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRunKeywordTest();
                  }
                }}
                placeholder='Coba ketik: "Halo kak, ada paket hemat buat hari ini nih!"'
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              <button
                type="button"
                onClick={handleRunKeywordTest}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg whitespace-nowrap shrink-0"
              >
                Uji Deteksi
              </button>
            </div>
            {keywordTestResult && (
              <p
                className={`text-xs font-medium ${
                  keywordTestResult.matched ? 'text-teal-700' : 'text-amber-700'
                }`}
              >
                {keywordTestResult.message}
                {keywordTestResult.latencyMs !== undefined && (
                  <span className="font-mono tabular-nums ml-1.5">
                    ({keywordTestResult.latencyMs} ms)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Host Character Selection by Gender */}
      <section aria-labelledby="host-character-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 id="host-character-heading" className="font-display text-lg font-bold text-slate-900">
              02. Karakter Host Simulasi (Perempuan &amp; Laki-laki)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih karakter pembawa acara sesuai target audiens usaha Anda untuk pratinjau dan
              simulasi Virtual Studio.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter karakter host berdasarkan jenis kelamin"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto"
          >
            {(
              [
                { id: 'semua', label: `Semua (${HOST_CHARACTERS.length})` },
                { id: 'perempuan', label: `Perempuan (${femaleCount})` },
                { id: 'laki-laki', label: `Laki-laki (${maleCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={hostGenderFilter === tab.id}
                onClick={() => setHostGenderFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  hostGenderFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="radiogroup"
          aria-label="Pilih Karakter Host Siaran"
        >
          {visibleHosts.map((host) => {
            const isSelected = host.id === selectedHost.id;
            const genderLabel = host.gender === 'perempuan' ? 'Perempuan' : 'Laki-laki';

            return (
              <button
                key={host.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectHost(host.id)}
                className={`group text-left bg-white rounded-xl border overflow-hidden transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  isSelected
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="relative aspect-video w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                  <ResilientImage
                    src={host.imageUrl}
                    alt={`Karakter host ${host.name} (${genderLabel})`}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{host.name}</h3>
                    {isSelected && (
                      <CheckCircle2
                        className="h-4 w-4 text-teal-700 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {genderLabel} · {host.styleLabel} · {host.specialty}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 pt-0.5">
                    {host.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* FR-03: Overlay Graphic Templates & Real-Time Canvas Preview */}
      <section aria-labelledby="template-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 id="template-heading" className="font-display text-lg font-bold text-slate-900">
              03. Template Grafis Overlay &amp; Pengaturan Tayang
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih desain lower-third profesional yang otomatis menampilkan nama produk, harga
              coret, stok, dan ajakan bertindak.
            </p>
          </div>
          <button
            type="button"
            onClick={onProceedToStudio}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Radio className="h-4 w-4" aria-hidden="true" />
            Lanjut ke Virtual Studio
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Template Selector & Duration Settings */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="space-y-2.5" role="radiogroup" aria-label="Pilih Template Overlay">
              {OVERLAY_TEMPLATES.map((tpl) => {
                const selected = overlayConfig.templateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      onChangeOverlayConfig({
                        ...overlayConfig,
                        templateId: tpl.id as OverlayTemplateId,
                      })
                    }
                    className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                      selected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{tpl.name}</span>
                      {selected && (
                        <CheckCircle2
                          className="h-4 w-4 text-teal-700 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{tpl.summary}</p>
                    <p className="text-[11px] text-slate-400 mt-1.5">Cocok untuk: {tpl.bestFor}</p>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="overlay-duration-range"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Durasi Tampil Overlay Otomatis
                  </label>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                    {overlayConfig.durationSeconds} detik
                  </span>
                </div>
                <input
                  id="overlay-duration-range"
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={overlayConfig.durationSeconds}
                  onChange={(e) =>
                    onChangeOverlayConfig({
                      ...overlayConfig,
                      durationSeconds: Number(e.target.value),
                    })
                  }
                  className="w-full accent-slate-900"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                  <span>5d (Cepat)</span>
                  <span>10d (Standar)</span>
                  <span>20d (Demo Detail)</span>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-medium text-slate-700">
                  Tampilkan indikator sisa stok pada grafis
                </span>
                <input
                  type="checkbox"
                  checked={overlayConfig.showStockAlert}
                  onChange={(e) =>
                    onChangeOverlayConfig({
                      ...overlayConfig,
                      showStockAlert: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-slate-900 rounded"
                />
              </label>
            </div>
          </div>

          {/* Live 16:9 Canvas Preview */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-600 truncate">
                Pratinjau Langsung:{' '}
                <span className="font-semibold text-slate-900">
                  {OVERLAY_TEMPLATES.find((t) => t.id === overlayConfig.templateId)?.name}
                </span>
                <span className="text-slate-400"> · Host {selectedHost.name}</span>
                {activePreviewProduct && (
                  <span className="text-slate-400"> · {activePreviewProduct.name}</span>
                )}
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
                1280×720 · 16:9
              </span>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-950 border border-slate-800">
              <canvas
                ref={previewCanvasRef}
                width={1280}
                height={720}
                data-testid="setup-overlay-preview-canvas"
                className="w-full h-full object-contain block"
              />
            </div>

            <p className="text-xs text-slate-500">
              Klik nama produk di tabel katalog di atas untuk meninjau tampilan harga coret dan
              foto produknya pada template terpilih.
            </p>
          </div>
        </div>
      </section>

      {modalOpen && (
        <ProductModal
          initialProduct={editingProduct}
          existingCount={products.length}
          onSave={(saved) => {
            if (editingProduct) {
              onUpdateProduct(saved);
            } else {
              onAddProduct(saved);
            }
            setPreviewProductId(saved.id);
            setModalOpen(false);
            setEditingProduct(null);
          }}
          onClose={() => {
            setModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}
