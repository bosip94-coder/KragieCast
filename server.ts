import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithFallback(
  ai: GoogleGenAI,
  contents: string,
  baseConfig: Record<string, unknown>,
) {
  const candidates: Array<{ model: string; useLowThinking: boolean }> = [
    { model: 'gemini-4-hydrogen', useLowThinking: true },
    { model: 'gemini-3.1-flash-lite', useLowThinking: false },
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const config = candidate.useLowThinking
          ? { ...baseConfig, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : baseConfig;
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents,
          config,
        });
        return { response, usedModel: candidate.model };
      } catch (err) {
        lastError = err;
        const errText = err instanceof Error ? err.message : String(err);
        const isTransient =
          errText.includes('503') ||
          errText.includes('UNAVAILABLE') ||
          errText.includes('429');
        if (!isTransient) break;
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error('Model AI sedang sibuk.');
}

interface RecommendationRequestBody {
  sessionTitle: string;
  durationSeconds: number;
  totalTriggers: number;
  averageLatencyMs: number;
  overlayDurationSeconds: number;
  products: Array<{
    name: string;
    normalPrice: number;
    promoPrice: number;
    stock: number;
    keywords: string[];
    triggerCount: number;
    screenSeconds: number;
  }>;
  recentTranscripts?: string[];
}

interface KeywordSuggestionBody {
  productName: string;
  category?: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kragiecast-ai' });
  });

  app.post('/api/setup/suggest-keywords', async (req, res) => {
    const body = req.body as KeywordSuggestionBody;
    const productName = (body?.productName ?? '').trim();

    if (productName.length < 3) {
      res.status(400).json({ error: 'Masukkan nama produk minimal 3 karakter terlebih dahulu.' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Layanan saran kata kunci AI belum terhubung. Periksa API key di Settings > Secrets.',
      });
      return;
    }

    try {
      const prompt = `Buat tepat 3 kata kunci pemicu suara Bahasa Indonesia (2-3 kata per frasa, natural diucapkan host UMKM saat live TikTok/Shopee) dan 1 kalimat ajakan bertindak (CTA maksimal 6 kata) untuk produk berikut:
Nama Produk: ${productName}
Kategori: ${body.category || 'UMKM'}`;

      const { response, usedModel } = await generateWithFallback(ai, prompt, {
        systemInstruction:
          'Anda adalah copywriter live commerce UMKM Indonesia. Berikan kata kunci pendek yang mudah diucapkan dan tidak ambigu.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Tepat 3 kata kunci pemicu suara pendek Bahasa Indonesia',
            },
            ctaText: {
              type: Type.STRING,
              description: 'Kalimat CTA singkat maksimal 6 kata untuk overlay',
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        keywords?: string[];
        ctaText?: string;
      };

      const cleanedKeywords = (parsed.keywords ?? [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 3);

      if (cleanedKeywords.length === 0) {
        res.status(502).json({ error: 'Respons saran kata kunci kosong. Silakan coba lagi.' });
        return;
      }

      res.json({
        keywords: cleanedKeywords,
        ctaText: (parsed.ctaText ?? 'Checkout Keranjang Kuning Sekarang').trim(),
        source: usedModel,
      });
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : '';
      const isBusy = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE');
      res.status(isBusy ? 503 : 500).json({
        error: isBusy
          ? 'Server AI sedang padat sementara. Silakan klik ulang beberapa saat lagi.'
          : 'Gagal menyusun saran kata kunci AI.',
      });
    }
  });

  app.post('/api/analytics/recommendations', async (req, res) => {
    const body = req.body as RecommendationRequestBody;

    if (!body || !Array.isArray(body.products)) {
      res.status(400).json({ error: 'Data sesi siaran tidak lengkap untuk dianalisis.' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Layanan analisis AI belum terhubung dengan kunci API. Periksa konfigurasi di panel Settings > Secrets.',
      });
      return;
    }

    try {
      const durationMin = Math.max(1, Math.round(body.durationSeconds / 60));
      const productLines = body.products
        .map(
          (p) =>
            `- ${p.name}: disebut/terpicu ${p.triggerCount}x, total tayang layar ${p.screenSeconds} detik, harga Rp${p.normalPrice.toLocaleString('id-ID')} -> Rp${p.promoPrice.toLocaleString('id-ID')}, stok tersisa ${p.stock} unit, kata kunci [${p.keywords.join(', ')}]`,
        )
        .join('\n');

      const transcriptSample =
        body.recentTranscripts && body.recentTranscripts.length > 0
          ? `\nKutipan transkrip host:\n${body.recentTranscripts.slice(-6).map((t) => `"${t}"`).join('\n')}`
          : '';

      const prompt = `Analisis performa sesi live commerce UMKM Indonesia berikut dan berikan tepat 3 poin rekomendasi konkret yang mudah dipraktikkan oleh solo-host UMKM pada siaran berikutnya.

Judul Sesi: ${body.sessionTitle}
Durasi Siaran: ${body.durationSeconds} detik (~${durationMin} menit)
Total Pemicu Kata Kunci Overlay: ${body.totalTriggers} kali
Rata-rata Latensi Trigger: ${body.averageLatencyMs} ms (target SLA < 1500 ms)
Durasi Tampil Overlay per Trigger: ${body.overlayDurationSeconds} detik

Performa Produk:
${productLines}${transcriptSample}

Aturan output:
- Gunakan Bahasa Indonesia profesional namun ramah UMKM (hindari jargon teknis berlebihan).
- Setiap rekomendasi harus merujuk langsung pada angka nyata dari sesi di atas (nama produk, jumlah sebutan, durasi tampil, atau stok).
- Kembalikan tepat 3 item rekomendasi dengan kategori prioritas ('Tinggi', 'Sedang', atau 'Peluang').`;

      const { response, usedModel } = await generateWithFallback(ai, prompt, {
        systemInstruction:
          'Anda adalah konsultan strategi live commerce & analitik siaran dari PT Kragie Media Indonesia untuk pelaku UMKM. Berikan saran singkat, spesifik, berbasis data sesi, dan langsung dapat dieksekusi.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: 'Judul singkat rekomendasi (maks 8 kata)',
                  },
                  detail: {
                    type: Type.STRING,
                    description: 'Penjelasan konkret berbasis metrik sesi (1-2 kalimat)',
                  },
                  actionStep: {
                    type: Type.STRING,
                    description: 'Langkah praktis untuk sesi live berikutnya (1 kalimat)',
                  },
                  priority: {
                    type: Type.STRING,
                    description: 'Tinggi, Sedang, atau Peluang',
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as {
        recommendations?: Array<{
          title: string;
          detail: string;
          actionStep: string;
          priority: string;
        }>;
      };

      if (!parsed.recommendations || parsed.recommendations.length === 0) {
        res.status(502).json({ error: 'Respons analisis AI kosong. Silakan coba lagi.' });
        return;
      }

      res.json({
        recommendations: parsed.recommendations.slice(0, 3),
        generatedAt: new Date().toISOString(),
        source: usedModel,
      });
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : '';
      const isBusy = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE');
      const friendlyMessage = isBusy
        ? 'Server model AI sedang mengalami lonjakan trafik sementara. Silakan klik "Coba Analisis Kembali" beberapa saat lagi.'
        : 'Gagal menghasilkan rekomendasi AI pada server. Pastikan koneksi dan kunci API di Settings > Secrets aktif.';
      res.status(isBusy ? 503 : 500).json({ error: friendlyMessage });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KragieCast AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KragieCast AI server:', err);
  process.exit(1);
});
