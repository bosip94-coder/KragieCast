import type {
  BroadcastSession,
  HostCharacter,
  OverlayConfig,
  OverlayTemplateId,
  Product,
  RtmpConfig,
  UmkmCohortMember,
} from '../types/kragiecast';

export const STUDIO_HOST_IMAGE_URL = '/src/assets/images/host_studio_live_1795098885476.jpg';

export const HOST_CHARACTERS: HostCharacter[] = [
  {
    id: 'host-rina',
    name: 'Rina Kusuma',
    gender: 'perempuan',
    styleLabel: 'Ramah & Hangat',
    specialty: 'Kuliner & Produk Harian',
    description:
      'Gaya bicara akrab khas penjual UMKM rumahan, cocok untuk demo makanan, bumbu, dan paket hemat keluarga.',
    imageUrl: '/src/assets/images/host_studio_live_1795098885476.jpg',
    sampleGreeting:
      'Halo Kak dan Bunda semua, selamat datang di live sore! Hari ini ada promo paket hemat dan rendang sapi empuk ya.',
  },
  {
    id: 'host-nadia',
    name: 'Nadia Putri',
    gender: 'perempuan',
    styleLabel: 'Elegan & Persuasif',
    specialty: 'Fesyen, Hijab & Hampers',
    description:
      'Pembawaan tenang dan detail saat menjelaskan bahan produk, ideal untuk katalog hampers, busana muslim, dan kriya.',
    imageUrl: '/src/assets/images/host_female_hijab_1795101613683.jpg',
    sampleGreeting:
      'Assalamualaikum Kakak cantik, yuk intip koleksi paket hemat hampers nusantara hari ini sebelum stoknya habis.',
  },
  {
    id: 'host-sinta',
    name: 'Sinta Maharani',
    gender: 'perempuan',
    styleLabel: 'Ceria & Cepat',
    specialty: 'Flash Sale & Camilan',
    description:
      'Tempo tinggi dan penuh antusiasme untuk mendorong checkout cepat di TikTok Live maupun Shopee Live.',
    imageUrl: '/src/assets/images/host_female_flashsale_1795101613152.jpg',
    sampleGreeting:
      'Wajib merapat Kak! Flash sale sambal cumi pedas cuma selama live, langsung gercep klik keranjang kuning sekarang!',
  },
  {
    id: 'host-dimas',
    name: 'Dimas Pratama',
    gender: 'laki-laki',
    styleLabel: 'Modern & Informatif',
    specialty: 'Kopi, Minuman & Kuliner',
    description:
      'Komunikatif dan lugas dalam mengulas cita rasa serta keunggulan kualitas bahan untuk audiens muda.',
    imageUrl: '/src/assets/images/host_male_modern_1795101613641.jpg',
    sampleGreeting:
      'Halo teman-teman! Sore ini kita seduh langsung kopi gayo arabika fresh roast, ada harga promo spesial di etalase.',
  },
  {
    id: 'host-raka',
    name: 'Raka Wijaya',
    gender: 'laki-laki',
    styleLabel: 'Enerjik & Interaktif',
    specialty: 'Promo Kilat & Fesyen Pria',
    description:
      'Santai, responsif menyapa komentar penonton, dan efektif menjaga ritme pemicu kata kunci promo.',
    imageUrl: '/src/assets/images/host_male_energetic_1795101613365.jpg',
    sampleGreeting:
      'Yo gaspol Bro dan Sis! Lagi ada promo hari ini buat paket hemat, stok menipis jadi langsung amankan sekarang.',
  },
  {
    id: 'host-hendra',
    name: 'Hendra Santoso',
    gender: 'laki-laki',
    styleLabel: 'Berwibawa & Edukatif',
    specialty: 'Batik, Kriya & Premium',
    description:
      'Pembawaan meyakinkan dan terpercaya untuk menonjolkan nilai kerajinan lokal, kualitas kemasan, serta keaslian produk.',
    imageUrl: '/src/assets/images/host_male_batik_1795101612941.jpg',
    sampleGreeting:
      'Selamat datang Bapak dan Ibu, hari ini kami hadirkan rendang padang asli dan hampers karya UMKM Nusantara terbaik.',
  },
];

export function getHostCharacterById(hostId: string): HostCharacter {
  return HOST_CHARACTERS.find((h) => h.id === hostId) ?? HOST_CHARACTERS[0];
}

export const PRODUCT_IMAGE_PRESETS = [
  {
    label: 'Rendang Sapi Vacum',
    url: '/src/assets/images/product_rendang_vacum_1795098886624.jpg',
  },
  {
    label: 'Sambal Cumi Pedas',
    url: '/src/assets/images/product_sambal_cumi_1795098886079.jpg',
  },
  {
    label: 'Hampers Nusantara',
    url: '/src/assets/images/product_hampers_nusantara_1795098885356.jpg',
  },
  {
    label: 'Kopi Arabika Gayo',
    url: '/src/assets/images/product_kopi_gayo_1795098884993.jpg',
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-rendang',
    name: 'Rendang Sapi Kemasan Vacum 250g',
    normalPrice: 89000,
    promoPrice: 68000,
    stock: 24,
    imageUrl: '/src/assets/images/product_rendang_vacum_1795098886624.jpg',
    keywords: ['rendang sapi', 'rendang padang', 'lauk siap saji'],
    ctaText: 'Checkout Keranjang Kuning Sekarang',
    category: 'Kuliner',
  },
  {
    id: 'prod-sambal',
    name: 'Sambal Cumi Asin Pedas 180g',
    normalPrice: 45000,
    promoPrice: 32500,
    stock: 42,
    imageUrl: '/src/assets/images/product_sambal_cumi_1795098886079.jpg',
    keywords: ['sambal cumi', 'sambal pedas', 'promo sambal'],
    ctaText: 'Beli 2 Gratis Ongkir Hari Ini',
    category: 'Kuliner',
  },
  {
    id: 'prod-hampers',
    name: 'Paket Hemat Hampers Nusantara',
    normalPrice: 215000,
    promoPrice: 169000,
    stock: 9,
    imageUrl: '/src/assets/images/product_hampers_nusantara_1795098885356.jpg',
    keywords: ['paket hemat', 'promo hari ini', 'hampers nusantara'],
    ctaText: 'Stok Terbatas — Klik Etalase 3',
    category: 'Bundling',
  },
  {
    id: 'prod-kopi',
    name: 'Kopi Arabika Gayo Drip Bag 200g',
    normalPrice: 78000,
    promoPrice: 59000,
    stock: 31,
    imageUrl: '/src/assets/images/product_kopi_gayo_1795098884993.jpg',
    keywords: ['kopi gayo', 'kopi arabika', 'teman ngopi'],
    ctaText: 'Pesan Sekarang — Roasted Fresh',
    category: 'Minuman',
  },
];

export const INITIAL_OVERLAY_CONFIG: OverlayConfig = {
  templateId: 'modern',
  durationSeconds: 10,
  defaultCta: 'Checkout Keranjang Kuning Sekarang',
  showStockAlert: true,
};

export const INITIAL_RTMP_CONFIG: RtmpConfig = {
  platform: 'YouTube Live',
  serverUrl: 'rtmp://a.rtmp.youtube.com/live2',
  streamKey: 'kragie-umkm-demo-2026',
  resolution: '1080p 30fps',
  virtualCamEnabled: true,
};

export interface OverlayTemplateMeta {
  id: OverlayTemplateId;
  name: string;
  summary: string;
  bestFor: string;
}

export const OVERLAY_TEMPLATES: OverlayTemplateMeta[] = [
  {
    id: 'modern',
    name: 'Siaran Modern',
    summary: 'Lower-third gelap kontras tinggi dengan harga coret & indikator diskon tegas.',
    bestFor: 'TikTok Live & YouTube Live',
  },
  {
    id: 'flash_sale',
    name: 'Flash Sale UMKM',
    summary: 'Pita promo merah-kuning berenergi tinggi dengan pengingat sisa stok otomatis.',
    bestFor: 'Shopee Live & Flash Promo',
  },
  {
    id: 'minimalis',
    name: 'Minimalis Elegan',
    summary: 'Bingkai terang bersih dengan tipografi editorial untuk produk fesyen & kriya.',
    bestFor: 'Fesyen, Batik & Hampers',
  },
  {
    id: 'berita',
    name: 'Klasik Berita',
    summary: 'Tata letak blok terstruktur ala siaran televisi dengan pita ajakan bertindak.',
    bestFor: 'Demo Produk & Edukasi',
  },
];

export const SAMPLE_SPEECH_SCRIPTS: Array<{
  label: string;
  phrase: string;
  type: 'product' | 'command';
}> = [
  {
    label: 'Sebut Paket Hemat',
    phrase: 'Halo Kak, mumpung masih ada nih paket hemat buat stok di rumah langsung cekout ya!',
    type: 'product',
  },
  {
    label: 'Sebut Rendang Sapi',
    phrase: 'Yang baru gabung, kita lagi promo rendang sapi empuk tahan lama di etalase satu.',
    type: 'product',
  },
  {
    label: 'Sebut Sambal Cumi',
    phrase: 'Ini dia favorit bunda-bunda, sambal cumi pedas gurih fresh dimasak pagi ini.',
    type: 'product',
  },
  {
    label: 'Sebut Kopi Gayo',
    phrase: 'Buat pecinta ngopi pagi, ada kopi gayo single origin aroma wangi banget.',
    type: 'product',
  },
  {
    label: 'Perintah: Zoom Produk 1.5x',
    phrase: 'Coba kita zoom detail supaya kelihatan tekstur bumbunya ya Kak.',
    type: 'command',
  },
  {
    label: 'Perintah: Kamera Normal',
    phrase: 'Oke kita kembali ke kamera normal lagi ya.',
    type: 'command',
  },
];

export const SEED_SESSIONS: BroadcastSession[] = [
  {
    id: 'sess-2026-11-18',
    title: 'Flash Sale Siang — Dapur Sari Rasa Nusantara',
    hostStoreName: 'Sari Rasa Nusantara',
    platform: 'TikTok Live Studio (Virtual Cam)',
    startedAt: '2026-11-18T05:00:00.000Z',
    endedAt: '2026-11-18T05:42:18.000Z',
    durationSeconds: 2538,
    overlayTemplateId: 'flash_sale',
    overlayDurationSeconds: 10,
    productsSnapshot: INITIAL_PRODUCTS,
    triggers: [
      {
        id: 'tr-1',
        timestampSec: 120,
        recordedAt: '2026-11-18T05:02:00.000Z',
        transcript: 'Selamat siang Kak, hari ini kita buka dengan promo hari ini paket hemat ya!',
        matchedKeyword: 'paket hemat',
        productId: 'prod-hampers',
        productName: 'Paket Hemat Hampers Nusantara',
        latencyMs: 380,
        displayDurationSec: 10,
      },
      {
        id: 'tr-2',
        timestampSec: 340,
        recordedAt: '2026-11-18T05:05:40.000Z',
        transcript: 'Nih rendang sapi kemasan vacum cocok banget buat stok anak kos.',
        matchedKeyword: 'rendang sapi',
        productId: 'prod-rendang',
        productName: 'Rendang Sapi Kemasan Vacum 250g',
        latencyMs: 410,
        displayDurationSec: 10,
      },
      {
        id: 'tr-3',
        timestampSec: 610,
        recordedAt: '2026-11-18T05:10:10.000Z',
        transcript: 'Banyak yang nanya sambal cumi, yuk langsung klik etalase dua.',
        matchedKeyword: 'sambal cumi',
        productId: 'prod-sambal',
        productName: 'Sambal Cumi Asin Pedas 180g',
        latencyMs: 365,
        displayDurationSec: 10,
      },
      {
        id: 'tr-4',
        timestampSec: 890,
        recordedAt: '2026-11-18T05:14:50.000Z',
        transcript: 'Rendang sapi lagi diskon 24 persen cuma selama live berlangsung.',
        matchedKeyword: 'rendang sapi',
        productId: 'prod-rendang',
        productName: 'Rendang Sapi Kemasan Vacum 250g',
        latencyMs: 440,
        displayDurationSec: 10,
      },
      {
        id: 'tr-5',
        timestampSec: 1120,
        recordedAt: '2026-11-18T05:18:40.000Z',
        transcript: 'Untuk yang cari kado, paket hemat hampers nusantara tinggal sembilan kotak.',
        matchedKeyword: 'paket hemat',
        productId: 'prod-hampers',
        productName: 'Paket Hemat Hampers Nusantara',
        latencyMs: 395,
        displayDurationSec: 10,
      },
      {
        id: 'tr-6',
        timestampSec: 1450,
        recordedAt: '2026-11-18T05:24:10.000Z',
        transcript: 'Sambal cumi pedasnya nampol banget buat makan pakai nasi hangat.',
        matchedKeyword: 'sambal cumi',
        productId: 'prod-sambal',
        productName: 'Sambal Cumi Asin Pedas 180g',
        latencyMs: 420,
        displayDurationSec: 10,
      },
      {
        id: 'tr-7',
        timestampSec: 1710,
        recordedAt: '2026-11-18T05:28:30.000Z',
        transcript: 'Rendang padang ini dimasak enam jam tanpa pengawet ya bunda.',
        matchedKeyword: 'rendang padang',
        productId: 'prod-rendang',
        productName: 'Rendang Sapi Kemasan Vacum 250g',
        latencyMs: 460,
        displayDurationSec: 10,
      },
      {
        id: 'tr-8',
        timestampSec: 1990,
        recordedAt: '2026-11-18T05:33:10.000Z',
        transcript: 'Sekali lagi promo sambal cumi beli dua langsung bebas ongkir.',
        matchedKeyword: 'sambal cumi',
        productId: 'prod-sambal',
        productName: 'Sambal Cumi Asin Pedas 180g',
        latencyMs: 350,
        displayDurationSec: 10,
      },
      {
        id: 'tr-9',
        timestampSec: 2180,
        recordedAt: '2026-11-18T05:36:20.000Z',
        transcript: 'Terakhir ada kopi gayo arabika buat temen kerja sore nanti.',
        matchedKeyword: 'kopi gayo',
        productId: 'prod-kopi',
        productName: 'Kopi Arabika Gayo Drip Bag 200g',
        latencyMs: 430,
        displayDurationSec: 10,
      },
      {
        id: 'tr-10',
        timestampSec: 2390,
        recordedAt: '2026-11-18T05:39:50.000Z',
        transcript: 'Sebelum live ditutup, jangan lupa checkout rendang sapi ya Kak!',
        matchedKeyword: 'rendang sapi',
        productId: 'prod-rendang',
        productName: 'Rendang Sapi Kemasan Vacum 250g',
        latencyMs: 375,
        displayDurationSec: 10,
      },
    ],
    transcripts: [
      'Selamat siang Kak, hari ini kita buka dengan promo hari ini paket hemat ya!',
      'Nih rendang sapi kemasan vacum cocok banget buat stok anak kos.',
      'Banyak yang nanya sambal cumi, yuk langsung klik etalase dua.',
      'Terakhir ada kopi gayo arabika buat temen kerja sore nanti.',
    ],
    aiRecommendations: [
      {
        title: 'Perpanjang Durasi Tampil Rendang Sapi',
        detail:
          'Rendang Sapi Kemasan Vacum 250g disebut 4 kali namun total tayang layar hanya 40 detik (durasi 10 detik per pemicu), terlalu singkat saat penonton membaca detail harga promo.',
        actionStep:
          'Naikkan durasi overlay menjadi 14 detik dan aktifkan Zoom Detail 1.5x saat membuka kemasan.',
        priority: 'Tinggi',
      },
      {
        title: 'Tingkatkan Eksposur Kopi Arabika Gayo',
        detail:
          'Kopi Arabika Gayo baru muncul 1 kali di menit ke-36 padahal stok masih 31 unit, sehingga belum sempat menangkap audiens puncak di 15 menit pertama.',
        actionStep:
          'Sisipkan penyebutan "kopi gayo" sebagai paket pendamping di menit ke-10 dan ke-25.',
        priority: 'Sedang',
      },
      {
        title: 'Manfaatkan Urgensi Stok Paket Hemat',
        detail:
          'Paket Hemat Hampers Nusantara tersisa 9 unit dan selalu memicu interaksi cepat saat disebut di awal sesi.',
        actionStep:
          'Gunakan template Flash Sale UMKM dan sebutkan sisa stok secara berkala tiap 12 menit.',
        priority: 'Peluang',
      },
    ],
    aiGeneratedAt: '2026-11-18T05:43:00.000Z',
    peakViewersEstimate: 148,
  },
  {
    id: 'sess-2026-11-15',
    title: 'Live Akhir Pekan — Promo Bundling Keluarga',
    hostStoreName: 'Sari Rasa Nusantara',
    platform: 'YouTube Live (RTMP)',
    startedAt: '2026-11-15T12:00:00.000Z',
    endedAt: '2026-11-15T12:28:10.000Z',
    durationSeconds: 1690,
    overlayTemplateId: 'modern',
    overlayDurationSeconds: 12,
    productsSnapshot: INITIAL_PRODUCTS,
    triggers: [
      {
        id: 'tr-p1',
        timestampSec: 180,
        recordedAt: '2026-11-15T12:03:00.000Z',
        transcript: 'Malam minggu santai sambil cek promo hari ini di etalase kita.',
        matchedKeyword: 'promo hari ini',
        productId: 'prod-hampers',
        productName: 'Paket Hemat Hampers Nusantara',
        latencyMs: 490,
        displayDurationSec: 12,
      },
      {
        id: 'tr-p2',
        timestampSec: 520,
        recordedAt: '2026-11-15T12:08:40.000Z',
        transcript: 'Yang suka pedas wajib coba sambal cumi stok baru matang.',
        matchedKeyword: 'sambal cumi',
        productId: 'prod-sambal',
        productName: 'Sambal Cumi Asin Pedas 180g',
        latencyMs: 410,
        displayDurationSec: 12,
      },
      {
        id: 'tr-p3',
        timestampSec: 960,
        recordedAt: '2026-11-15T12:16:00.000Z',
        transcript: 'Kopi arabika gayo pas banget buat seduhan pagi besok.',
        matchedKeyword: 'kopi arabika',
        productId: 'prod-kopi',
        productName: 'Kopi Arabika Gayo Drip Bag 200g',
        latencyMs: 455,
        displayDurationSec: 12,
      },
      {
        id: 'tr-p4',
        timestampSec: 1310,
        recordedAt: '2026-11-15T12:21:50.000Z',
        transcript: 'Jangan kelewatan paket hemat akhir pekan khusus malam ini.',
        matchedKeyword: 'paket hemat',
        productId: 'prod-hampers',
        productName: 'Paket Hemat Hampers Nusantara',
        latencyMs: 390,
        displayDurationSec: 12,
      },
    ],
    transcripts: [
      'Malam minggu santai sambil cek promo hari ini di etalase kita.',
      'Yang suka pedas wajib coba sambal cumi stok baru matang.',
    ],
    aiRecommendations: [
      {
        title: 'Tambah Variasi Penyebutan Rendang Sapi',
        detail:
          'Rendang Sapi Kemasan Vacum 250g tidak sekali pun terpicu dalam sesi 28 menit ini padahal memiliki margin promo menarik.',
        actionStep:
          'Tambahkan kata kunci percakapan kasual seperti "rendang empuk" agar lebih natural disebut.',
        priority: 'Tinggi',
      },
      {
        title: 'Jaga Ritme Pemicu di 10 Menit Pertama',
        detail:
          'Rata-rata jeda antar overlay adalah 7 menit; penonton baru yang masuk di tengah sesi berisiko tidak melihat penawaran harga.',
        actionStep:
          'Targetkan minimal 1 penyebutan kata kunci produk setiap 3–4 menit.',
        priority: 'Sedang',
      },
      {
        title: 'Latensi Trigger Sudah Sangat Optimal',
        detail:
          'Rata-rata respons suara ke overlay tercatat 436 ms, jauh di bawah ambang batas 1.500 ms.',
        actionStep:
          'Pertahankan posisi mikrofon 20 cm dan aktifkan mode peredam bising Standar Toko.',
        priority: 'Peluang',
      },
    ],
    aiGeneratedAt: '2026-11-15T12:29:00.000Z',
    peakViewersEstimate: 92,
  },
];

export const UMKM_COHORT_MEMBERS: UmkmCohortMember[] = [
  {
    id: 'umkm-01',
    storeName: 'Sari Rasa Nusantara',
    ownerName: 'Rina Kusuma',
    city: 'Bandung',
    sector: 'Kuliner',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 4,
    weeklyRetained: true,
    avgLatencyMs: 402,
    totalTriggersMonth: 128,
    lastBroadcastDate: '18 Nov 2026',
    topProduct: 'Rendang Sapi Kemasan Vacum 250g',
    status: 'Aktif',
  },
  {
    id: 'umkm-02',
    storeName: 'Batik Sekar Laras',
    ownerName: 'Budi Santoso',
    city: 'Solo',
    sector: 'Fesyen',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 3,
    weeklyRetained: true,
    avgLatencyMs: 465,
    totalTriggersMonth: 94,
    lastBroadcastDate: '18 Nov 2026',
    topProduct: 'Outer Batik Cap Viscose',
    status: 'Aktif',
  },
  {
    id: 'umkm-03',
    storeName: 'Kriya Rotan Kalimas',
    ownerName: 'Dewi Anggraini',
    city: 'Cirebon',
    sector: 'Kerajinan',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 2,
    weeklyRetained: true,
    avgLatencyMs: 518,
    totalTriggersMonth: 61,
    lastBroadcastDate: '17 Nov 2026',
    topProduct: 'Keranjang Hampers Anyaman Rotan',
    status: 'Aktif',
  },
  {
    id: 'umkm-04',
    storeName: 'Dapur Pempek Cek Ani',
    ownerName: 'Ani Rahmawati',
    city: 'Palembang',
    sector: 'Kuliner',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 5,
    weeklyRetained: true,
    avgLatencyMs: 388,
    totalTriggersMonth: 152,
    lastBroadcastDate: '19 Nov 2026',
    topProduct: 'Paket Pempek Kapal Selam Frozen',
    status: 'Aktif',
  },
  {
    id: 'umkm-05',
    storeName: 'Tenun Ikat Flobamora',
    ownerName: 'Yohanes Mau',
    city: 'Kupang',
    sector: 'Fesyen',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 1,
    weeklyRetained: false,
    avgLatencyMs: 710,
    totalTriggersMonth: 22,
    lastBroadcastDate: '12 Nov 2026',
    topProduct: 'Selendang Tenun Motif Tradisional',
    status: 'Perlu Pendampingan',
  },
  {
    id: 'umkm-06',
    storeName: 'Kopi Lereng Ijen',
    ownerName: 'Hendra Wijaya',
    city: 'Banyuwangi',
    sector: 'Kuliner',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 3,
    weeklyRetained: true,
    avgLatencyMs: 425,
    totalTriggersMonth: 87,
    lastBroadcastDate: '18 Nov 2026',
    topProduct: 'Biji Kopi Arabika Ijen 500g',
    status: 'Aktif',
  },
  {
    id: 'umkm-07',
    storeName: 'Kulit Garut Heritage',
    ownerName: 'Asep Kurniawan',
    city: 'Garut',
    sector: 'Kerajinan',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 1,
    weeklyRetained: false,
    avgLatencyMs: 640,
    totalTriggersMonth: 19,
    lastBroadcastDate: '14 Nov 2026',
    topProduct: 'Dompet Kulit Sapi Pull-Up',
    status: 'Perlu Pendampingan',
  },
  {
    id: 'umkm-08',
    storeName: 'Hijab Voal Nirmala',
    ownerName: 'Siti Nurhaliza',
    city: 'Yogyakarta',
    sector: 'Fesyen',
    programBatch: 'Inkubasi Beta Q4 2026',
    sessionsThisWeek: 2,
    weeklyRetained: true,
    avgLatencyMs: 448,
    totalTriggersMonth: 45,
    lastBroadcastDate: '19 Nov 2026',
    topProduct: 'Voal Ultrafine Motif Monogram',
    status: 'Baru Bergabung',
  },
];
