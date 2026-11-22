import { useCallback, useEffect, useState } from 'react';
import type {
  AiRecommendation,
  BroadcastSession,
  NavSection,
  OverlayConfig,
  Product,
  RtmpConfig,
  UmkmCohortMember,
  UserPersonaRole,
} from './types/kragiecast';
import {
  HOST_CHARACTERS,
  INITIAL_OVERLAY_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_RTMP_CONFIG,
  SEED_SESSIONS,
  UMKM_COHORT_MEMBERS,
} from './lib/seedData';
import { reorderProducts } from './lib/analyticsEngine';
import { AppShell } from './components/AppShell';
import { PreLiveSetup } from './components/PreLiveSetup';
import { VirtualStudio } from './components/VirtualStudio';
import { PostLiveAnalytics } from './components/PostLiveAnalytics';
import { CommunityMonitor } from './components/CommunityMonitor';

const STORAGE_KEYS = {
  products: 'kragiecast_products_v1',
  overlay: 'kragiecast_overlay_v1',
  sessions: 'kragiecast_sessions_v1',
  storeName: 'kragiecast_store_v1',
  cohort: 'kragiecast_cohort_v1',
  hostId: 'kragiecast_host_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return 'studio';
    return 'setup';
  });
  const [personaRole, setPersonaRole] = useState<UserPersonaRole>('host');
  const [storeName, setStoreName] = useState<string>(() =>
    readStorage(STORAGE_KEYS.storeName, 'Sari Rasa Nusantara'),
  );
  const [sessionTitle, setSessionTitle] = useState<string>(
    'Promo Live Sore — Dapur Sari Rasa Nusantara',
  );
  const [products, setProducts] = useState<Product[]>(() =>
    readStorage(STORAGE_KEYS.products, INITIAL_PRODUCTS),
  );
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(() =>
    readStorage(STORAGE_KEYS.overlay, INITIAL_OVERLAY_CONFIG),
  );
  const [rtmpConfig, setRtmpConfig] = useState<RtmpConfig>(INITIAL_RTMP_CONFIG);
  const [sessions, setSessions] = useState<BroadcastSession[]>(() =>
    readStorage(STORAGE_KEYS.sessions, SEED_SESSIONS),
  );
  const [cohortMembers, setCohortMembers] = useState<UmkmCohortMember[]>(() =>
    readStorage(STORAGE_KEYS.cohort, UMKM_COHORT_MEMBERS),
  );
  const [selectedHostId, setSelectedHostId] = useState<string>(() =>
    readStorage(STORAGE_KEYS.hostId, HOST_CHARACTERS[0].id),
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    () => readStorage(STORAGE_KEYS.sessions, SEED_SESSIONS)[0]?.id ?? SEED_SESSIONS[0].id,
  );
  const [isLive, setIsLive] = useState(false);

  // Sync key workspace entities to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
    } catch {
      // Ignore quota errors
    }
  }, [products]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.overlay, JSON.stringify(overlayConfig));
    } catch {
      // Ignore quota errors
    }
  }, [overlayConfig]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
    } catch {
      // Ignore quota errors
    }
  }, [sessions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.storeName, JSON.stringify(storeName));
    } catch {
      // Ignore quota errors
    }
  }, [storeName]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.cohort, JSON.stringify(cohortMembers));
    } catch {
      // Ignore quota errors
    }
  }, [cohortMembers]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.hostId, JSON.stringify(selectedHostId));
    } catch {
      // Ignore quota errors
    }
  }, [selectedHostId]);

  const handleAddProduct = useCallback((product: Product) => {
    setProducts((prev) => [...prev, product]);
  }, []);

  const handleUpdateProduct = useCallback((updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleDeleteProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const handleReorderProduct = useCallback((index: number, direction: 'up' | 'down') => {
    setProducts((prev) => reorderProducts(prev, index, direction));
  }, []);

  const handleAdjustProductStock = useCallback((productId: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p)),
    );
  }, []);

  const handleCompleteBroadcast = useCallback((completed: BroadcastSession) => {
    setSessions((prev) => [completed, ...prev]);
    setSelectedSessionId(completed.id);
    setActiveSection('analytics');
  }, []);

  const handleUpdateSessionRecommendations = useCallback(
    (sessionId: string, recommendations: AiRecommendation[], generatedAt: string) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, aiRecommendations: recommendations, aiGeneratedAt: generatedAt }
            : s,
        ),
      );
    },
    [],
  );

  const handleAddCohortMember = useCallback((member: UmkmCohortMember) => {
    setCohortMembers((prev) => [member, ...prev]);
  }, []);

  const handleUpdateCohortStatus = useCallback(
    (memberId: string, status: UmkmCohortMember['status']) => {
      setCohortMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, status, weeklyRetained: status === 'Aktif' } : m,
        ),
      );
    },
    [],
  );

  return (
    <AppShell
      activeSection={activeSection}
      onNavigate={setActiveSection}
      personaRole={personaRole}
      onChangePersonaRole={setPersonaRole}
      storeName={storeName}
      onChangeStoreName={setStoreName}
      isLive={isLive}
      onOpenStudioPrimary={() => setActiveSection('studio')}
    >
      {activeSection === 'setup' && (
        <PreLiveSetup
          sessionTitle={sessionTitle}
          onChangeSessionTitle={setSessionTitle}
          products={products}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          onReorderProduct={handleReorderProduct}
          overlayConfig={overlayConfig}
          onChangeOverlayConfig={setOverlayConfig}
          storeName={storeName}
          selectedHostId={selectedHostId}
          onSelectHost={setSelectedHostId}
          onProceedToStudio={() => setActiveSection('studio')}
        />
      )}

      {activeSection === 'studio' && (
        <VirtualStudio
          sessionTitle={sessionTitle}
          storeName={storeName}
          selectedHostId={selectedHostId}
          onSelectHost={setSelectedHostId}
          products={products}
          onAdjustProductStock={handleAdjustProductStock}
          overlayConfig={overlayConfig}
          onChangeOverlayConfig={setOverlayConfig}
          rtmpConfig={rtmpConfig}
          onChangeRtmpConfig={setRtmpConfig}
          isLive={isLive}
          onSetIsLive={setIsLive}
          onCompleteBroadcast={handleCompleteBroadcast}
        />
      )}

      {activeSection === 'analytics' && (
        <PostLiveAnalytics
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          onUpdateSessionRecommendations={handleUpdateSessionRecommendations}
          onStartNewSession={() => setActiveSection('studio')}
        />
      )}

      {activeSection === 'community' && (
        <CommunityMonitor
          members={cohortMembers}
          onAddMember={handleAddCohortMember}
          onUpdateMemberStatus={handleUpdateCohortStatus}
        />
      )}
    </AppShell>
  );
}
