import { useState, type ChangeEvent, type FormEvent } from 'react';
import { RefreshCw, Upload, X } from 'lucide-react';
import type { Product } from '../types/kragiecast';
import {
  MAX_KEYWORDS_PER_PRODUCT,
  MAX_PRODUCTS_PER_SESSION,
  parseKeywordsInput,
  validateProductDraft,
} from '../lib/analyticsEngine';
import { PRODUCT_IMAGE_PRESETS } from '../lib/seedData';
import { ResilientImage } from './ResilientImage';

interface ProductModalProps {
  initialProduct: Product | null;
  existingCount: number;
  onSave: (product: Product) => void;
  onClose: () => void;
}

export function ProductModal({
  initialProduct,
  existingCount,
  onSave,
  onClose,
}: ProductModalProps) {
  const isEditing = Boolean(initialProduct);

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [normalPrice, setNormalPrice] = useState(
    initialProduct ? String(initialProduct.normalPrice) : '',
  );
  const [promoPrice, setPromoPrice] = useState(
    initialProduct ? String(initialProduct.promoPrice) : '',
  );
  const [stock, setStock] = useState(initialProduct ? String(initialProduct.stock) : '');
  const [keywordsInput, setKeywordsInput] = useState(
    initialProduct ? initialProduct.keywords.join(', ') : '',
  );
  const [ctaText, setCtaText] = useState(
    initialProduct?.ctaText ?? 'Checkout Keranjang Kuning Sekarang',
  );
  const [category, setCategory] = useState(initialProduct?.category ?? 'Kuliner');
  const [imageUrl, setImageUrl] = useState(
    initialProduct?.imageUrl ?? PRODUCT_IMAGE_PRESETS[0].url,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestingAi, setSuggestingAi] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const parsedKeywords = parseKeywordsInput(keywordsInput);

  const handleSuggestKeywords = async () => {
    setSuggestError(null);
    if (name.trim().length < 3) {
      setSuggestError('Isi Nama Produk minimal 3 karakter sebelum meminta saran AI.');
      return;
    }
    setSuggestingAi(true);
    try {
      const res = await fetch('/api/setup/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name.trim(), category }),
      });
      const data = (await res.json()) as {
        keywords?: string[];
        ctaText?: string;
        error?: string;
      };
      if (!res.ok || !data.keywords) {
        throw new Error(data.error || 'Gagal memuat saran kata kunci AI.');
      }
      setKeywordsInput(data.keywords.join(', '));
      if (data.ctaText) {
        setCtaText(data.ctaText);
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Gagal menghubungi layanan AI.');
    } finally {
      setSuggestingAi(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const draft = {
      name: name.trim(),
      normalPrice: Number(normalPrice),
      promoPrice: Number(promoPrice),
      stock: Number(stock),
      keywords: parsedKeywords,
      ctaText: ctaText.trim() || 'Checkout Keranjang Kuning Sekarang',
      category,
      imageUrl,
    };

    const result = validateProductDraft(draft, existingCount, isEditing);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    onSave({
      id: initialProduct?.id ?? `prod-${Date.now()}`,
      ...draft,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="product-modal-title" className="text-base font-bold text-slate-900">
              {isEditing ? 'Edit Produk Katalog' : 'Tambah Produk ke Sesi Siaran'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kuota sesi: {existingCount}/{MAX_PRODUCTS_PER_SESSION} produk · 1–{MAX_KEYWORDS_PER_PRODUCT} kata kunci pemicu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form produk"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {errors.limit && (
            <div
              role="alert"
              className="px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {errors.limit}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="prod-name"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Nama Produk
              </label>
              <input
                id="prod-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Keripik Tempe Bandung 200g"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label
                htmlFor="prod-category"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Kategori
              </label>
              <select
                id="prod-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                <option value="Kuliner">Kuliner</option>
                <option value="Bundling">Bundling</option>
                <option value="Minuman">Minuman</option>
                <option value="Fesyen">Fesyen</option>
                <option value="Kerajinan">Kerajinan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="prod-normal-price"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Harga Normal (Rp)
              </label>
              <input
                id="prod-normal-price"
                type="number"
                min={0}
                value={normalPrice}
                onChange={(e) => setNormalPrice(e.target.value)}
                placeholder="89000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              {errors.normalPrice && (
                <p className="text-xs text-red-600 mt-1">{errors.normalPrice}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="prod-promo-price"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Harga Promo Live (Rp)
              </label>
              <input
                id="prod-promo-price"
                type="number"
                min={0}
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="68000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              {errors.promoPrice && (
                <p className="text-xs text-red-600 mt-1">{errors.promoPrice}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="prod-stock"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Stok Tersedia
              </label>
              <input
                id="prod-stock"
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="25"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              {errors.stock && <p className="text-xs text-red-600 mt-1">{errors.stock}</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label
                htmlFor="prod-keywords"
                className="block text-sm font-medium text-slate-700"
              >
                Kata Kunci Pemicu Suara (1–3 frasa, pisahkan koma)
              </label>
              <button
                type="button"
                disabled={suggestingAi}
                onClick={() => void handleSuggestKeywords()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw
                  className={`h-3 w-3 ${suggestingAi ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {suggestingAi ? 'Menyusun saran...' : 'Sarankan Kata Kunci AI'}
              </button>
            </div>
            <input
              id="prod-keywords"
              type="text"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="Contoh: paket hemat, promo hari ini, keripik tempe"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            />
            {suggestError && <p className="text-xs text-amber-700 mt-1">{suggestError}</p>}
            <div className="flex items-center justify-between mt-1">
              {errors.keywords ? (
                <p className="text-xs text-red-600">{errors.keywords}</p>
              ) : (
                <p className="text-xs text-slate-500">
                  Terbaca:{' '}
                  {parsedKeywords.length > 0 ? parsedKeywords.join(' · ') : 'Belum ada kata kunci'}
                </p>
              )}
              <span
                className={`text-xs font-mono tabular-nums ${
                  parsedKeywords.length > MAX_KEYWORDS_PER_PRODUCT
                    ? 'text-red-600 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                {parsedKeywords.length}/{MAX_KEYWORDS_PER_PRODUCT}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="prod-cta" className="block text-sm font-medium text-slate-700 mb-1">
              Teks Ajakan Bertindak (CTA Overlay)
            </label>
            <input
              id="prod-cta"
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Checkout Keranjang Kuning Sekarang"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            />
          </div>

          {/* Product image selection */}
          <div className="pt-2 border-t border-slate-200">
            <span className="block text-sm font-medium text-slate-700 mb-2">
              Gambar Produk Overlay
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <ResilientImage
                src={imageUrl}
                alt={name || 'Pratinjau gambar produk'}
                className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-[200px] space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {PRODUCT_IMAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setImageUrl(preset.url)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                        imageUrl === preset.url
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Unggah foto dari perangkat</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isEditing ? 'Simpan Perubahan' : 'Tambahkan Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
