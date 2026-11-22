import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Focus,
  Mic,
  MicOff,
  Minus,
  Monitor,
  MonitorPlay,
  Pin,
  Radio,
  Send,
  Sliders,
  Smartphone,
  Square,
  Volume2,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  BroadcastSession,
  CameraZoomPreset,
  HostGender,
  NoiseCancellationLevel,
  OverlayConfig,
  Product,
  RtmpConfig,
  SpeechTriggerEvent,
  TranscriptLogEntry,
} from '../types/kragiecast';
import {
  LATENCY_SLA_MS,
  formatClockTimer,
  formatRupiah,
} from '../lib/analyticsEngine';
import { detectVoiceCommand, matchProductKeyword } from '../lib/keywordEngine';
import {
  HOST_CHARACTERS,
  OVERLAY_TEMPLATES,
  SAMPLE_SPEECH_SCRIPTS,
  getHostCharacterById,
} from '../lib/seedData';
import {
  type ActiveOverlayRenderState,
  renderBroadcastFrame,
} from '../lib/canvasOverlayRenderer';
import {
  BroadcastAudioProcessor,
  type AudioMeterReadings,
} from '../lib/audioProcessor';
import { ResilientImage } from './ResilientImage';

interface VirtualStudioProps {
  sessionTitle: string;
  storeName: string;
  selectedHostId: string;
  onSelectHost: (hostId: string) => void;
  products: Product[];
  overlayConfig: OverlayConfig;
  onChangeOverlayConfig: (config: OverlayConfig) => void;
  rtmpConfig: RtmpConfig;
  onChangeRtmpConfig: (config: RtmpConfig) => void;
  isLive: boolean;
  onSetIsLive: (live: boolean) => void;
  onCompleteBroadcast: (session: BroadcastSession) => void;
  onAdjustProductStock: (productId: string, delta: number) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function VirtualStudio({
  sessionTitle,
  storeName,
  selectedHostId,
  onSelectHost,
  products,
  overlayConfig,
  onChangeOverlayConfig,
  rtmpConfig,
  onChangeRtmpConfig,
  isLive,
  onSetIsLive,
  onCompleteBroadcast,
  onAdjustProductStock,
}: VirtualStudioProps) {
  // Broadcast session telemetry state
  const [elapsedSec, setElapsedSec] = useState(0);
  const [triggers, setTriggers] = useState<SpeechTriggerEvent[]>([]);
  const [transcriptLogs, setTranscriptLogs] = useState<TranscriptLogEntry[]>([]);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeRemainingSec, setActiveRemainingSec] = useState(0);
  const [overlayPinned, setOverlayPinned] = useState(false);

  // AI Camera & Vision controls (FR-05)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [hostGenderFilter, setHostGenderFilter] = useState<'semua' | HostGender>('semua');
  const [cameraMode, setCameraMode] = useState<'simulated' | 'webcam'>('simulated');
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [autoFraming, setAutoFraming] = useState(true);
  const [showFaceGuide, setShowFaceGuide] = useState(true);
  const [targetZoom, setTargetZoom] = useState<CameraZoomPreset>(1.0);

  // AI Speech & Audio controls (FR-04 & FR-06)
  const [micListening, setMicListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [noiseLevel, setNoiseLevel] = useState<NoiseCancellationLevel>('standar');
  const [audioMeter, setAudioMeter] = useState<AudioMeterReadings>({
    rawLevel: 38,
    cleanLevel: 14,
    noiseReductionDb: 16,
    isRealMic: false,
  });
  const [manualSpeechInput, setManualSpeechInput] = useState('');

  // RTMP / Virtual Camera Output controls (FR-07)
  const [rtmpModalOpen, setRtmpModalOpen] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [cleanFeedMode, setCleanFeedMode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [recordingWebm, setRecordingWebm] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);

  // Refs for stable 30fps Canvas & Audio processing without React re-renders
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanFeedVideoRef = useRef<HTMLVideoElement | null>(null);
  const hostImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const prodImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const audioProcessorRef = useRef<BroadcastAudioProcessor | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const selectedHost = getHostCharacterById(selectedHostId);
  const visibleHosts = HOST_CHARACTERS.filter(
    (h) => hostGenderFilter === 'semua' || h.gender === hostGenderFilter,
  );

  // Mutable animation refs
  const currentZoomRef = useRef<number>(1.0);
  const targetZoomRef = useRef<number>(1.0);
  const autoFramingRef = useRef<boolean>(true);
  const showFaceGuideRef = useRef<boolean>(true);
  const cameraModeRef = useRef<'simulated' | 'webcam'>('simulated');
  const isLiveRef = useRef<boolean>(isLive);
  const elapsedSecRef = useRef<number>(0);
  const storeNameRef = useRef<string>(storeName);
  const selectedHostUrlRef = useRef<string>(selectedHost.imageUrl);
  const sessionStartIsoRef = useRef<string>(new Date().toISOString());

  const activeOverlayRef = useRef<{
    product: Product;
    etalaseNumber: number;
    startedAtMs: number;
    durationMs: number;
    pausedRemainingMs?: number;
    matchedKeyword?: string;
  } | null>(null);
  const overlayConfigRef = useRef<OverlayConfig>(overlayConfig);
  const overlayPinnedRef = useRef<boolean>(false);
  const productsRef = useRef<Product[]>(products);

  useEffect(() => {
    targetZoomRef.current = targetZoom;
  }, [targetZoom]);

  useEffect(() => {
    autoFramingRef.current = autoFraming;
  }, [autoFraming]);

  useEffect(() => {
    showFaceGuideRef.current = showFaceGuide;
  }, [showFaceGuide]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    elapsedSecRef.current = elapsedSec;
  }, [elapsedSec]);

  useEffect(() => {
    storeNameRef.current = storeName;
  }, [storeName]);

  useEffect(() => {
    selectedHostUrlRef.current = selectedHost.imageUrl;
  }, [selectedHost.imageUrl]);

  useEffect(() => {
    overlayConfigRef.current = overlayConfig;
  }, [overlayConfig]);

  useEffect(() => {
    overlayPinnedRef.current = overlayPinned;
  }, [overlayPinned]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Preload all host studio character images & product images into cache
  useEffect(() => {
    for (const host of HOST_CHARACTERS) {
      if (!hostImgCacheRef.current.has(host.imageUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          hostImgCacheRef.current.set(host.imageUrl, img);
        };
        img.src = host.imageUrl;
      }
    }

    for (const p of products) {
      if (p.imageUrl && !prodImgCacheRef.current.has(p.imageUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          prodImgCacheRef.current.set(p.imageUrl, img);
        };
        img.src = p.imageUrl;
      }
    }
  }, [products]);

  // Initialize Audio Processor
  useEffect(() => {
    const proc = new BroadcastAudioProcessor();
    audioProcessorRef.current = proc;
    return () => {
      proc.detach();
    };
  }, []);

  useEffect(() => {
    audioProcessorRef.current?.setLevel(noiseLevel);
  }, [noiseLevel]);

  // Live broadcast clock timer
  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLive]);

  // Throttled UI sync for Audio Meters & Overlay Countdown (4 Hz)
  useEffect(() => {
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 0.25;
      if (audioProcessorRef.current) {
        setAudioMeter(audioProcessorRef.current.getReadings(tick));
      }
      const ov = activeOverlayRef.current;
      if (ov) {
        if (overlayPinnedRef.current) {
          const pausedRem = ov.pausedRemainingMs ?? ov.durationMs;
          setActiveRemainingSec(Math.max(1, Math.ceil(pausedRem / 1000)));
        } else {
          const rem = Math.max(0, (ov.startedAtMs + ov.durationMs - performance.now()) / 1000);
          if (rem <= 0) {
            activeOverlayRef.current = null;
            setActiveProductId(null);
            setActiveRemainingSec(0);
            setOverlayPinned(false);
          } else {
            setActiveRemainingSec(Math.ceil(rem));
          }
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // Main Canvas Compositor Loop (mount once, reads refs)
  useEffect(() => {
    let rafId = 0;
    let lastDrawMs = 0;
    let phase = 0;

    const loop = (now: number) => {
      rafId = window.requestAnimationFrame(loop);
      // Cap at ~30fps for smooth CPU performance on standard 8GB UMKM laptops
      if (now - lastDrawMs < 32) return;
      const dt = Math.min(0.1, (now - lastDrawMs) / 1000);
      lastDrawMs = now;
      phase += dt;

      // Smooth eased interpolation for Virtual Multi-Cam Digital Zoom
      const dz = targetZoomRef.current - currentZoomRef.current;
      if (Math.abs(dz) > 0.002) {
        currentZoomRef.current += dz * Math.min(1, dt * 8);
      } else {
        currentZoomRef.current = targetZoomRef.current;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const activeHostImg =
        hostImgCacheRef.current.get(selectedHostUrlRef.current) ??
        hostImgCacheRef.current.values().next().value ??
        null;

      const mediaSource =
        cameraModeRef.current === 'webcam' &&
        videoRef.current &&
        videoRef.current.readyState >= 2
          ? videoRef.current
          : activeHostImg;

      let overlayRender: ActiveOverlayRenderState | null = null;
      let prodImg: HTMLImageElement | null = null;

      const ov = activeOverlayRef.current;
      if (ov) {
        const isPinned = overlayPinnedRef.current;
        const elapsedMs = now - ov.startedAtMs;
        const remainingMs = isPinned
          ? (ov.pausedRemainingMs ?? ov.durationMs)
          : ov.durationMs - elapsedMs;

        if (!isPinned && remainingMs <= 0) {
          activeOverlayRef.current = null;
        } else {
          const cfg = overlayConfigRef.current;
          const liveIdx = productsRef.current.findIndex((p) => p.id === ov.product.id);
          const liveProduct = liveIdx >= 0 ? productsRef.current[liveIdx] : ov.product;
          const etalaseNumber = liveIdx >= 0 ? liveIdx + 1 : ov.etalaseNumber;
          const enterProgress = Math.min(1, Math.max(0, elapsedMs) / 280);
          overlayRender = {
            product: liveProduct,
            etalaseNumber,
            isPinned,
            templateId: cfg.templateId,
            ctaText: liveProduct.ctaText || cfg.defaultCta,
            showStockAlert: cfg.showStockAlert,
            progress: Math.max(0, Math.min(1, remainingMs / ov.durationMs)),
            remainingSec: Math.max(0, remainingMs / 1000),
            enterProgress,
            matchedKeyword: ov.matchedKeyword,
          };
          prodImg = prodImgCacheRef.current.get(liveProduct.imageUrl) ?? null;
        }
      }

      renderBroadcastFrame(
        ctx,
        canvas.width,
        canvas.height,
        mediaSource,
        {
          zoom: currentZoomRef.current,
          autoFraming: autoFramingRef.current,
          showFaceGuide: showFaceGuideRef.current,
          driftPhase: phase,
        },
        overlayRender,
        prodImg,
        {
          isLive: isLiveRef.current,
          elapsedLabel: formatClockTimer(elapsedSecRef.current),
          storeName: storeNameRef.current,
        },
      );
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const dismissActiveOverlay = useCallback(() => {
    activeOverlayRef.current = null;
    overlayPinnedRef.current = false;
    setOverlayPinned(false);
    setActiveProductId(null);
    setActiveRemainingSec(0);
  }, []);

  const togglePinOverlay = useCallback(() => {
    const ov = activeOverlayRef.current;
    if (!ov) return;
    if (!overlayPinnedRef.current) {
      const rem = Math.max(1000, ov.startedAtMs + ov.durationMs - performance.now());
      ov.pausedRemainingMs = rem;
      overlayPinnedRef.current = true;
      setOverlayPinned(true);
    } else {
      const rem = ov.pausedRemainingMs ?? ov.durationMs;
      ov.startedAtMs = performance.now() - (ov.durationMs - rem);
      ov.pausedRemainingMs = undefined;
      overlayPinnedRef.current = false;
      setOverlayPinned(false);
    }
  }, []);

  // Trigger overlay manually or from speech engine
  const triggerProductOverlay = useCallback(
    (product: Product, matchedKeyword: string, transcript: string, latencyMs: number) => {
      const durationSec = overlayConfigRef.current.durationSeconds;
      const idx = productsRef.current.findIndex((p) => p.id === product.id);
      const etalaseNumber = idx >= 0 ? idx + 1 : 1;
      overlayPinnedRef.current = false;
      setOverlayPinned(false);
      activeOverlayRef.current = {
        product,
        etalaseNumber,
        startedAtMs: performance.now(),
        durationMs: durationSec * 1000,
        matchedKeyword,
      };
      setActiveProductId(product.id);
      setActiveRemainingSec(durationSec);

      const event: SpeechTriggerEvent = {
        id: `trig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestampSec: elapsedSecRef.current,
        recordedAt: new Date().toISOString(),
        transcript,
        matchedKeyword,
        productId: product.id,
        productName: product.name,
        latencyMs,
        displayDurationSec: durationSec,
      };

      setTriggers((prev) => [...prev, event]);
    },
    [],
  );

  // Keyboard shortcuts: Z (1.5x Zoom), P (Pin Overlay), Esc (Dismiss Overlay), 1-9 (Trigger Etalase #1-#9)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'z') {
        setTargetZoom((prev) => (prev === 1.5 ? 1.0 : 1.5));
      } else if (key === 'p' && activeOverlayRef.current) {
        togglePinOverlay();
      } else if (e.key === 'Escape' && activeOverlayRef.current) {
        dismissActiveOverlay();
      } else if (/^[1-9]$/.test(e.key)) {
        const index = Number(e.key) - 1;
        const prod = productsRef.current[index];
        if (prod) {
          triggerProductOverlay(
            prod,
            prod.keywords[0] ?? prod.name,
            `[Pintasan #${index + 1}] ${prod.name}`,
            6,
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissActiveOverlay, togglePinOverlay, triggerProductOverlay]);

  // Process any spoken or simulated Indonesian phrase through the NLP Keyword + Voice Command Engine
  const processIndonesianUtterance = useCallback(
    (phrase: string) => {
      const cleaned = phrase.trim();
      if (!cleaned) return;
      const t0 = performance.now();

      const timeLabel = formatClockTimer(elapsedSecRef.current);
      const voiceCmd = detectVoiceCommand(cleaned, t0);

      if (voiceCmd) {
        let cmdLabel = '';
        if (voiceCmd.command === 'zoom_in') {
          setTargetZoom(1.5);
          cmdLabel = 'Zoom Detail 1.5x';
        } else if (voiceCmd.command === 'zoom_reset') {
          setTargetZoom(1.0);
          cmdLabel = 'Kamera Normal 1.0x';
        } else if (voiceCmd.command === 'hide_overlay') {
          activeOverlayRef.current = null;
          setActiveProductId(null);
          setActiveRemainingSec(0);
          cmdLabel = 'Tutup Overlay';
        }

        setTranscriptLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timeLabel,
            text: cleaned,
            voiceCommand: cmdLabel,
            latencyMs: voiceCmd.latencyMs,
          },
          ...prev.slice(0, 29),
        ]);
        return;
      }

      const match = matchProductKeyword(cleaned, products, t0);
      if (match) {
        triggerProductOverlay(match.product, match.matchedKeyword, cleaned, match.latencyMs);
        setTranscriptLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timeLabel,
            text: cleaned,
            matchedProductName: match.product.name,
            matchedKeyword: match.matchedKeyword,
            latencyMs: match.latencyMs,
          },
          ...prev.slice(0, 29),
        ]);
      } else {
        setTranscriptLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timeLabel,
            text: cleaned,
          },
          ...prev.slice(0, 29),
        ]);
      }
    },
    [products, triggerProductOverlay],
  );

  // Toggle Real Webcam via WebRTC getUserMedia
  const handleToggleCameraSource = async () => {
    setWebcamError(null);
    if (cameraMode === 'webcam') {
      mediaStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
      setCameraMode('simulated');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setWebcamError('Peramban tidak mendukung akses kamera. Tetap menggunakan Studio Simulasi.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await audioProcessorRef.current?.attachMicrophone(stream, noiseLevel);
      setCameraMode('webcam');
    } catch {
      setWebcamError(
        'Kamera tidak ditemukan atau izin ditolak. Studio Simulasi Host tetap aktif untuk pratinjau.',
      );
      setCameraMode('simulated');
    }
  };

  // Toggle Real-Time Web Speech API (id-ID)
  const handleToggleSpeechRecognition = () => {
    setSpeechNotice(null);

    if (micListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setMicListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechNotice(
        'Web Speech API tidak tersedia di peramban ini. Gunakan kolom Simulasi Suara Host di bawah untuk menguji deteksi kata kunci.',
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'id-ID';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal && result[0]?.transcript) {
            processIndonesianUtterance(result[0].transcript);
          }
        }
      };

      recognition.onerror = (event: { error: string }) => {
        setSpeechNotice(
          `Mikrofon berhenti (${event.error}). Anda tetap dapat menggunakan Simulasi Suara Host.`,
        );
        setMicListening(false);
      };

      recognition.onend = () => {
        setMicListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setMicListening(true);
    } catch {
      setSpeechNotice(
        'Tidak dapat mengakses mikrofon. Gunakan Simulasi Suara Host untuk pengujian langsung.',
      );
      setMicListening(false);
    }
  };

  // Cleanup media streams on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Virtual Camera / Local WebM Stream Recording via canvas.captureStream(30)
  const handleToggleWebmRecord = () => {
    if (recordingWebm && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingWebm(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      setSpeechNotice('Perekaman stream Virtual Cam tidak didukung oleh peramban ini.');
      return;
    }
    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordedBlobUrl(null);
      setRecordingWebm(true);
    } catch {
      setSpeechNotice('Gagal memulai perekaman Canvas stream.');
    }
  };

  // Go Live & End Broadcast lifecycle
  const handleStartLive = () => {
    sessionStartIsoRef.current = new Date().toISOString();
    setElapsedSec(0);
    setTriggers([]);
    setTranscriptLogs([]);
    onSetIsLive(true);
  };

  const handleEndBroadcast = () => {
    onSetIsLive(false);
    if (micListening) {
      recognitionRef.current?.stop();
      setMicListening(false);
    }
    if (recordingWebm && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingWebm(false);
    }

    const completedSession: BroadcastSession = {
      id: `sess-${Date.now()}`,
      title: sessionTitle.trim() || `Sesi Siaran ${storeName}`,
      hostStoreName: storeName,
      platform: rtmpConfig.virtualCamEnabled
        ? `${rtmpConfig.platform} + Virtual Cam`
        : rtmpConfig.platform,
      startedAt: sessionStartIsoRef.current,
      endedAt: new Date().toISOString(),
      durationSeconds: Math.max(15, elapsedSec),
      overlayTemplateId: overlayConfig.templateId,
      overlayDurationSeconds: overlayConfig.durationSeconds,
      productsSnapshot: products,
      triggers,
      transcripts: transcriptLogs.map((l) => l.text).reverse(),
      aiRecommendations: [],
    };

    onCompleteBroadcast(completedSession);
  };

  const avgLatency =
    triggers.length > 0
      ? Math.round(triggers.reduce((acc, t) => acc + t.latencyMs, 0) / triggers.length)
      : 0;

  return (
    <div className="space-y-6" data-state={isLive ? 'live' : 'standby'}>
      {/* Studio Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 truncate">
            {sessionTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {rtmpConfig.platform} · {rtmpConfig.resolution} · Host {selectedHost.name} (
            {selectedHost.gender === 'perempuan' ? 'Perempuan' : 'Laki-laki'}) ·{' '}
            {triggers.length} Pemicu Overlay
            {avgLatency > 0 ? ` · Latensi Rata-rata ${avgLatency} ms` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setRtmpModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Sliders className="h-4 w-4" aria-hidden="true" />
            Output RTMP / Virtual Cam
          </button>

          {!isLive ? (
            <button
              type="button"
              onClick={handleStartLive}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Radio className="h-4 w-4" aria-hidden="true" />
              Mulai Siaran
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEndBroadcast}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              Akhiri Siaran &amp; Lihat Analitik
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Grid: Broadcast Monitor (Left 8 cols) + Live Controls & Transcript (Right 4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: 16:9 Live Broadcast Monitor + Camera/Audio Control Strip */}
        <div className="xl:col-span-8 space-y-4">
          {/* Dark Cinema Monitor Enclosure */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            {/* Aspect Ratio & Broadcast Format Top Bar */}
            <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-md">
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  aria-pressed={aspectRatio === '16:9'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    aspectRatio === '16:9'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                  16:9 YouTube / OBS
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  aria-pressed={aspectRatio === '9:16'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    aspectRatio === '9:16'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  9:16 TikTok / Shopee
                </button>
              </div>

              <div className="flex items-center gap-2">
                {activeProductId && (
                  <>
                    <button
                      type="button"
                      onClick={togglePinOverlay}
                      aria-pressed={overlayPinned}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        overlayPinned
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Pin className="h-3 w-3" aria-hidden="true" />
                      {overlayPinned ? 'Overlay Ditahan (P)' : 'Tahan Overlay (P)'}
                    </button>
                    <button
                      type="button"
                      onClick={dismissActiveOverlay}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Tutup (Esc)
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              className={
                aspectRatio === '16:9'
                  ? 'relative aspect-video w-full bg-slate-950'
                  : 'relative w-full py-3 bg-slate-950 flex justify-center'
              }
            >
              <canvas
                ref={canvasRef}
                width={aspectRatio === '16:9' ? 1280 : 720}
                height={aspectRatio === '16:9' ? 720 : 1280}
                data-testid="studio-broadcast-canvas"
                data-aspect={aspectRatio}
                className={
                  aspectRatio === '16:9'
                    ? 'w-full h-full object-contain block'
                    : 'h-[480px] sm:h-[540px] aspect-[9/16] object-contain block rounded-md border border-slate-800'
                }
              />
              {/* Hidden webcam video element fed into canvas */}
              <video ref={videoRef} muted playsInline className="hidden" />
            </div>

            {/* Clean Broadcast Control Dock under Canvas */}
            <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleCameraSource}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    cameraMode === 'webcam'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {cameraMode === 'webcam' ? (
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {cameraMode === 'webcam' ? 'Kamera Asli Aktif' : 'Gunakan Webcam Asli'}
                </button>

                <button
                  type="button"
                  onClick={() => setAutoFraming((v) => !v)}
                  aria-pressed={autoFraming}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    autoFraming
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Focus className="h-3.5 w-3.5" aria-hidden="true" />
                  AI Auto-Framing: {autoFraming ? 'Aktif' : 'Mati'}
                </button>

                <button
                  type="button"
                  onClick={() => setTargetZoom((prev) => (prev === 1.5 ? 1.0 : 1.5))}
                  aria-pressed={targetZoom === 1.5}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    targetZoom === 1.5
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Zoom Detail 1.5x (Z)
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
                <span>{formatClockTimer(elapsedSec)}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setCleanFeedMode((v) => !v)}
                  className="text-slate-300 hover:text-white underline underline-offset-2 whitespace-nowrap"
                >
                  {cleanFeedMode ? 'Tutup Clean Feed' : 'Clean Feed OBS'}
                </button>
              </div>
            </div>
          </div>

          {webcamError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2">
              {webcamError}
            </p>
          )}

          {/* Virtual Multi-Cam Angle Presets + Real-Time Noise Cancellation Row (FR-05 & FR-06) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* FR-05: Virtual Multi-Cam & Framing Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  AI Auto-Framing &amp; Virtual Multi-Cam
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {targetZoom.toFixed(1)}x
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                {([1.0, 1.2, 1.5] as CameraZoomPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTargetZoom(preset)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      targetZoom === preset
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset === 1.0
                      ? 'Wide 1.0x'
                      : preset === 1.2
                        ? 'Host 1.2x'
                        : 'Detail 1.5x'}
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between text-xs text-slate-600 cursor-pointer pt-1">
                <span>Tampilkan panduan kotak pelacakan wajah</span>
                <input
                  type="checkbox"
                  checked={showFaceGuide}
                  onChange={(e) => setShowFaceGuide(e.target.checked)}
                  className="h-4 w-4 accent-slate-900 rounded"
                />
              </label>

              <p className="text-xs text-slate-500 leading-relaxed">
                Tekan tombol <span className="font-mono font-semibold text-slate-700">Z</span> atau
                ucapkan &ldquo;zoom detail&rdquo; untuk perbesaran halus ke produk.
              </p>
            </div>

            {/* FR-06: Real-Time Noise Cancellation Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-slate-900">Peredam Bising Real-Time</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-teal-700 font-semibold">
                  {noiseLevel === 'off' ? '0 dB' : `-${audioMeter.noiseReductionDb} dB`}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'off', label: 'Mati' },
                    { id: 'ringan', label: 'Ringan' },
                    { id: 'standar', label: 'Toko' },
                    { id: 'agresif', label: 'Dapur' },
                  ] as Array<{ id: NoiseCancellationLevel; label: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNoiseLevel(item.id)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      noiseLevel === item.id
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Dual Audio Level Meters */}
              <div className="space-y-2 pt-0.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>Sinyal Latar Asli</span>
                    <span>{audioMeter.rawLevel}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 transition-transform duration-150 origin-left"
                      style={{ transform: `scaleX(${audioMeter.rawLevel / 100})` }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600 font-mono tabular-nums">
                    <span>Output Vokal Bersih (Web Audio)</span>
                    <span>{audioMeter.cleanLevel}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 transition-transform duration-150 origin-left"
                      style={{ transform: `scaleX(${audioMeter.cleanLevel / 100})` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Catalog Trigger Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Pemicu Etalase Cepat &amp; Kontrol Stok Live
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Pintasan keyboard: 1–{Math.min(9, products.length)} Etalase · Z Zoom · P Tahan ·
                  Esc Tutup
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="studio-template-select" className="text-xs text-slate-500">
                  Template:
                </label>
                <select
                  id="studio-template-select"
                  value={overlayConfig.templateId}
                  onChange={(e) =>
                    onChangeOverlayConfig({
                      ...overlayConfig,
                      templateId: e.target.value as OverlayConfig['templateId'],
                    })
                  }
                  className="text-xs font-medium bg-white border border-slate-200 rounded-md px-2 py-1"
                >
                  {OVERLAY_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {products.map((prod, idx) => {
                const isShowing = activeProductId === prod.id;
                const etalaseNo = idx + 1;
                return (
                  <div
                    key={prod.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                      isShowing
                        ? 'border-red-600 bg-red-50/40'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        triggerProductOverlay(
                          prod,
                          prod.keywords[0] ?? prod.name,
                          `[Pemicu Etalase #${etalaseNo}] ${prod.name}`,
                          8,
                        )
                      }
                      className="flex-1 min-w-0 flex items-center justify-between gap-2.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          <span className="font-mono text-slate-500 mr-1.5">#{etalaseNo}</span>
                          {prod.name}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                          {formatRupiah(prod.promoPrice)} · Stok{' '}
                          <span
                            data-testid={`studio-stock-${prod.id}`}
                            className={
                              prod.stock <= 10 ? 'text-amber-700 font-semibold' : 'text-slate-700'
                            }
                          >
                            {prod.stock}
                          </span>
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-700 whitespace-nowrap shrink-0">
                        {isShowing
                          ? overlayPinned
                            ? 'Ditahan'
                            : `Tayang ${activeRemainingSec}d`
                          : 'Tampilkan'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={prod.stock <= 0}
                      onClick={() => onAdjustProductStock(prod.id, -1)}
                      aria-label={`Kurangi 1 stok ${prod.name}`}
                      title="Kurangi 1 stok saat checkout masuk"
                      className="inline-flex items-center gap-0.5 px-2 py-1.5 text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-md shrink-0 whitespace-nowrap"
                    >
                      <Minus className="h-3 w-3" aria-hidden="true" />1
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Studio Host Character Switcher by Gender */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Karakter Host Simulasi (Perempuan &amp; Laki-laki)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Host aktif: <span className="font-semibold text-slate-800">{selectedHost.name}</span>{' '}
                  · {selectedHost.gender === 'perempuan' ? 'Perempuan' : 'Laki-laki'} ·{' '}
                  {selectedHost.styleLabel}
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Filter jenis kelamin host di studio"
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {(
                  [
                    { id: 'semua', label: 'Semua' },
                    { id: 'perempuan', label: 'Perempuan' },
                    { id: 'laki-laki', label: 'Laki-laki' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={hostGenderFilter === tab.id}
                    onClick={() => setHostGenderFilter(tab.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {visibleHosts.map((host) => {
                const active = host.id === selectedHost.id;
                const genderLabel = host.gender === 'perempuan' ? 'Perempuan' : 'Laki-laki';
                return (
                  <button
                    key={host.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onSelectHost(host.id);
                      if (cameraMode === 'webcam') {
                        mediaStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
                        setCameraMode('simulated');
                      }
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <ResilientImage
                      src={host.imageUrl}
                      alt={host.name}
                      className="h-11 w-14 rounded-md object-cover object-top border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{host.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {genderLabel} · {host.styleLabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: FR-04 Real-Time Speech Recognition & Transcript Engine */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Deteksi Suara &amp; Auto-Overlay
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Target &lt; {LATENCY_SLA_MS} ms
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleSpeechRecognition}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                micListening
                  ? 'bg-teal-700 hover:bg-teal-800 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {micListening ? (
                <>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  Mendengarkan Bahasa Indonesia (Aktif)
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                  Aktifkan Mikrofon Speech-to-Overlay
                </>
              )}
            </button>

            {speechNotice && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {speechNotice}
              </p>
            )}
          </div>

          {/* Speech Simulation / Live Utterance Input (works seamlessly without hardware mic) */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
            <label
              htmlFor="simulate-speech-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Simulasi Ucapan Host (Bahasa Indonesia)
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processIndonesianUtterance(manualSpeechInput);
                setManualSpeechInput('');
              }}
              className="flex items-center gap-2"
            >
              <input
                id="simulate-speech-input"
                type="text"
                value={manualSpeechInput}
                onChange={(e) => setManualSpeechInput(e.target.value)}
                placeholder='Contoh: "Halo Kak, paket hemat lagi promo!"'
                className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              <button
                type="submit"
                aria-label="Kirim simulasi ucapan"
                className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shrink-0"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500">
                Uji cepat kalimat jualan &amp; perintah suara:
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => processIndonesianUtterance(selectedHost.sampleGreeting)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md transition-colors whitespace-nowrap"
                >
                  Sapaan {selectedHost.name.split(' ')[0]}
                </button>
                {SAMPLE_SPEECH_SCRIPTS.map((script) => (
                  <button
                    key={script.label}
                    type="button"
                    onClick={() => processIndonesianUtterance(script.phrase)}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-400 hover:text-slate-900 rounded-md transition-colors whitespace-nowrap"
                  >
                    {script.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Transcript & Trigger Log */}
          <div className="p-4 flex-1 min-h-[260px] max-h-[380px] overflow-y-auto space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">
                Transkrip &amp; Riwayat Pemicu Sesi
              </p>
              <span
                data-testid="studio-trigger-count"
                className="text-xs font-mono tabular-nums text-slate-500"
              >
                {triggers.length} terpicu
              </span>
            </div>

            {transcriptLogs.length === 0 ? (
              <div className="py-10 text-center space-y-1.5">
                <p className="text-xs font-medium text-slate-600">
                  Belum ada ucapan terdeteksi
                </p>
                <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
                  Aktifkan mikrofon atau klik salah satu tombol simulasi ucapan di atas untuk
                  melihat overlay muncul otomatis.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {transcriptLogs.map((entry) => (
                  <li key={entry.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                      <span>{entry.timeLabel}</span>
                      {entry.latencyMs !== undefined && (
                        <span className="text-teal-700 font-semibold">{entry.latencyMs} ms</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed">
                      &ldquo;{entry.text}&rdquo;
                    </p>
                    {entry.matchedProductName && (
                      <p className="text-[11px] font-medium text-red-700">
                        Overlay Aktif: {entry.matchedProductName} · Kata kunci &ldquo;
                        {entry.matchedKeyword}&rdquo;
                      </p>
                    )}
                    {entry.voiceCommand && (
                      <p className="text-[11px] font-medium text-teal-700">
                        Perintah Kamera: {entry.voiceCommand}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* FR-07: Clean Feed / Virtual Camera Preview Modal for OBS & TikTok Live Studio */}
      {cleanFeedMode && (
        <div
          className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 gap-3"
          role="dialog"
          aria-modal="true"
          aria-label="Clean Feed Virtual Camera"
        >
          <div className="w-full max-w-5xl flex items-center justify-between text-slate-300">
            <span className="text-xs font-mono">
              VIRTUAL CAMERA CLEAN FEED · {aspectRatio === '16:9' ? '1280×720' : '720×1280'} 30FPS ·
              OBS / TIKTOK LIVE STUDIO
            </span>
            <button
              type="button"
              onClick={() => setCleanFeedMode(false)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-md"
            >
              Keluar Clean Feed
            </button>
          </div>
          <div
            className={
              aspectRatio === '16:9'
                ? 'w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden border border-slate-800'
                : 'h-[80vh] aspect-[9/16] bg-black rounded-lg overflow-hidden border border-slate-800'
            }
          >
            <video
              ref={(el) => {
                cleanFeedVideoRef.current = el;
                if (el && canvasRef.current && typeof canvasRef.current.captureStream === 'function') {
                  el.srcObject = canvasRef.current.captureStream(30);
                  void el.play();
                }
              }}
              muted
              playsInline
              autoPlay
              className="w-full h-full object-contain block"
            />
          </div>
          <p className="text-xs text-slate-400">
            Gunakan Window Capture di OBS Studio atau TikTok Live Studio pada jendela ini untuk
            output siaran bersih tanpa bilah kontrol.
          </p>
        </div>
      )}

      {/* FR-07: RTMP & Virtual Camera Configuration Modal */}
      {rtmpModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rtmp-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <MonitorPlay className="h-4 w-4 text-slate-700" aria-hidden="true" />
                <h2 id="rtmp-modal-title" className="text-base font-bold text-slate-900">
                  Konfigurasi Output RTMP &amp; Virtual Camera
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRtmpModalOpen(false)}
                aria-label="Tutup konfigurasi RTMP"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="rtmp-platform"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Platform Tujuan Siaran
                  </label>
                  <select
                    id="rtmp-platform"
                    value={rtmpConfig.platform}
                    onChange={(e) => {
                      const platform = e.target.value as RtmpConfig['platform'];
                      const defaultUrls: Record<RtmpConfig['platform'], string> = {
                        'YouTube Live': 'rtmp://a.rtmp.youtube.com/live2',
                        'TikTok Live': 'rtmp://push-rtmp-f5.tiktokcdn.com/stage',
                        'Shopee Live': 'rtmp://push-live.shopee.co.id/live',
                        'Custom RTMP': rtmpConfig.serverUrl,
                      };
                      onChangeRtmpConfig({
                        ...rtmpConfig,
                        platform,
                        serverUrl: defaultUrls[platform],
                      });
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="YouTube Live">YouTube Live</option>
                    <option value="TikTok Live">TikTok Live</option>
                    <option value="Shopee Live">Shopee Live</option>
                    <option value="Custom RTMP">Custom RTMP Server</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="rtmp-resolution"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Resolusi &amp; Frame Rate
                  </label>
                  <select
                    id="rtmp-resolution"
                    value={rtmpConfig.resolution}
                    onChange={(e) =>
                      onChangeRtmpConfig({
                        ...rtmpConfig,
                        resolution: e.target.value as RtmpConfig['resolution'],
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="720p 30fps">720p · 30fps (Hemat Kuota)</option>
                    <option value="1080p 30fps">1080p · 30fps (Full HD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="rtmp-server-url"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Server URL RTMP
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="rtmp-server-url"
                    type="text"
                    value={rtmpConfig.serverUrl}
                    onChange={(e) =>
                      onChangeRtmpConfig({ ...rtmpConfig, serverUrl: e.target.value })
                    }
                    className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(rtmpConfig.serverUrl);
                      setCopiedUrl(true);
                      window.setTimeout(() => setCopiedUrl(false), 1800);
                    }}
                    aria-label="Salin URL RTMP"
                    className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900"
                  >
                    {copiedUrl ? <Check className="h-4 w-4 text-teal-700" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="rtmp-stream-key"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Stream Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="rtmp-stream-key"
                    type={showStreamKey ? 'text' : 'password'}
                    value={rtmpConfig.streamKey}
                    onChange={(e) =>
                      onChangeRtmpConfig({ ...rtmpConfig, streamKey: e.target.value })
                    }
                    className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStreamKey((v) => !v)}
                    aria-label={showStreamKey ? 'Sembunyikan stream key' : 'Tampilkan stream key'}
                    className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900"
                  >
                    {showStreamKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Bridge Virtual Camera (OBS / TikTok Live Studio)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Ekspor sinyal HTML5 Canvas 30fps untuk dihubungkan ke perangkat lunak siaran.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={rtmpConfig.virtualCamEnabled}
                    onChange={(e) =>
                      onChangeRtmpConfig({
                        ...rtmpConfig,
                        virtualCamEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-slate-900 rounded"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleWebmRecord}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      recordingWebm
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {recordingWebm ? 'Hentikan Rekam Stream (.webm)' : 'Rekam Uji Stream Virtual Cam'}
                  </button>

                  {recordedBlobUrl && (
                    <a
                      href={recordedBlobUrl}
                      download={`kragiecast-stream-${Date.now()}.webm`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Unduh Hasil Rekaman
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setRtmpModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Simpan &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
