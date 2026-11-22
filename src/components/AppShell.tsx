import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Layers,
  Menu,
  Radio,
  Users,
  X,
  LogOut,
  Check,
} from 'lucide-react';
import type { NavSection, UserPersonaRole } from '../types/kragiecast';

interface AppShellProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  personaRole: UserPersonaRole;
  onChangePersonaRole: (role: UserPersonaRole) => void;
  storeName: string;
  onChangeStoreName: (name: string) => void;
  isLive: boolean;
  onOpenStudioPrimary: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  breadcrumb: string;
  icon: typeof Layers;
}> = [
  {
    id: 'setup',
    label: 'Persiapan Siaran',
    breadcrumb: 'Persiapan Siaran',
    icon: Layers,
  },
  {
    id: 'studio',
    label: 'Virtual Studio',
    breadcrumb: 'Virtual Studio',
    icon: Radio,
  },
  {
    id: 'analytics',
    label: 'Analitik Pasca-Siaran',
    breadcrumb: 'Analitik Pasca-Siaran',
    icon: BarChart3,
  },
  {
    id: 'community',
    label: 'Pantauan Komunitas',
    breadcrumb: 'Pantauan Komunitas',
    icon: Users,
  },
];

export function AppShell({
  activeSection,
  onNavigate,
  personaRole,
  onChangePersonaRole,
  storeName,
  onChangeStoreName,
  isLive,
  onOpenStudioPrimary,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [storeInput, setStoreInput] = useState(storeName);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];

  const handleSaveAccount = () => {
    const trimmed = storeInput.trim();
    if (trimmed.length >= 2) {
      onChangeStoreName(trimmed);
    }
    setAccountModalOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        {/* Brand lockup — single clean display element */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              onNavigate('setup');
              setMobileMenuOpen(false);
            }}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 rounded"
          >
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
              KragieCast AI
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Tutup navigasi"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav aria-label="Navigasi Utama" className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                {item.id === 'studio' && isLive && (
                  <span className="ml-auto font-mono text-[11px] font-semibold text-red-300">
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Workspace Role Switch */}
        <div className="mx-3 mt-4 pt-4 border-t border-slate-200 px-3">
          <p className="text-xs font-medium text-slate-500 mb-2">Mode Peran Pengguna</p>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                onChangePersonaRole('host');
                if (activeSection === 'community') onNavigate('setup');
              }}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                personaRole === 'host'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Host UMKM
            </button>
            <button
              type="button"
              onClick={() => {
                onChangePersonaRole('admin');
                onNavigate('community');
              }}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                personaRole === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendamping
            </button>
          </div>
        </div>
      </div>

      {/* Account footer */}
      <div className="p-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => {
            setStoreInput(storeName);
            setAccountModalOpen(true);
          }}
          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <p className="text-sm font-semibold text-slate-900 truncate">{storeName}</p>
          <p className="text-xs text-slate-500 truncate">
            {personaRole === 'host' ? 'UMKM Solo-Host' : 'Admin Inkubator UMKM'} · Google OAuth
          </p>
        </button>
        <p className="px-2.5 pt-2 text-[11px] text-slate-400">
          PT Kragie Media Indonesia
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 Primary Action on right */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                {storeName}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {currentNav.breadcrumb}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeSection !== 'studio' ? (
              <button
                type="button"
                onClick={onOpenStudioPrimary}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {isLive ? 'Kembali ke Studio Live' : 'Buka Virtual Studio'}
              </button>
            ) : (
              <span className="text-xs font-mono font-medium text-slate-600 whitespace-nowrap shrink-0">
                {isLive ? 'STATUS: SEDANG SIARAN' : 'STATUS: PRATINJAU STUDIO'}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Account & Workspace Modal */}
      {accountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-modal-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 id="account-modal-title" className="text-base font-bold text-slate-900">
                Profil Akun &amp; Toko UMKM
              </h2>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                aria-label="Tutup pengaturan akun"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-5 space-y-4">
              <div>
                <label
                  htmlFor="store-name-input"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Nama Toko / Brand UMKM
                </label>
                <input
                  id="store-name-input"
                  type="text"
                  value={storeInput}
                  onChange={(e) => setStoreInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-700">Keamanan &amp; Autentikasi Sesi</p>
                <p>Akun terverifikasi melalui Google OAuth · Penyimpanan katalog lokal terenkripsi per sesi.</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSaveAccount}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Simpan Profil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
