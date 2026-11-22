import { useMemo, useState, type FormEvent } from 'react';
import { Download, Plus, Search, X } from 'lucide-react';
import type { UmkmCohortMember } from '../types/kragiecast';
import { LATENCY_SLA_MS, buildCohortCsv } from '../lib/analyticsEngine';

interface CommunityMonitorProps {
  members: UmkmCohortMember[];
  onAddMember: (member: UmkmCohortMember) => void;
  onUpdateMemberStatus: (memberId: string, status: UmkmCohortMember['status']) => void;
}

type SectorFilter = 'Semua' | 'Kuliner' | 'Fesyen' | 'Kerajinan';

export function CommunityMonitor({
  members,
  onAddMember,
  onUpdateMemberStatus,
}: CommunityMonitorProps) {
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>('Semua');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add UMKM form state
  const [newStoreName, setNewStoreName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newSector, setNewSector] = useState<'Kuliner' | 'Fesyen' | 'Kerajinan'>('Kuliner');
  const [newTopProduct, setNewTopProduct] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (sectorFilter !== 'Semua' && m.sector !== sectorFilter) return false;
      if (!q) return true;
      return (
        m.storeName.toLowerCase().includes(q) ||
        m.ownerName.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q) ||
        m.topProduct.toLowerCase().includes(q)
      );
    });
  }, [members, search, sectorFilter]);

  const retainedCount = members.filter((m) => m.weeklyRetained).length;
  const retentionPercent =
    members.length > 0 ? Math.round((retainedCount / members.length) * 100) : 0;
  const avgCohortLatency =
    members.length > 0
      ? Math.round(members.reduce((sum, m) => sum + m.avgLatencyMs, 0) / members.length)
      : 0;
  const totalSessionsWeek = members.reduce((sum, m) => sum + m.sessionsThisWeek, 0);

  const handleExportCohortCsv = () => {
    const csv = buildCohortCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kohort-umkm-kragiecast-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateMember = (e: FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newOwnerName.trim() || !newCity.trim()) {
      setFormError('Nama UMKM, nama pemilik, dan kota wajib diisi.');
      return;
    }
    const created: UmkmCohortMember = {
      id: `umkm-${Date.now()}`,
      storeName: newStoreName.trim(),
      ownerName: newOwnerName.trim(),
      city: newCity.trim(),
      sector: newSector,
      programBatch: 'Inkubasi Beta Q4 2026',
      sessionsThisWeek: 1,
      weeklyRetained: true,
      avgLatencyMs: 430,
      totalTriggersMonth: 12,
      lastBroadcastDate: '19 Nov 2026',
      topProduct: newTopProduct.trim() || 'Produk Unggulan UMKM',
      status: 'Baru Bergabung',
    };
    onAddMember(created);
    setNewStoreName('');
    setNewOwnerName('');
    setNewCity('');
    setNewTopProduct('');
    setFormError(null);
    setAddModalOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Pantauan Komunitas &amp; Inkubasi UMKM
          </h1>
          <p className="text-sm text-slate-600">
            Dasbor Pendamping / Admin Komunitas untuk memantau retensi mingguan, latensi pemicu
            suara, dan performa siaran digital UMKM binaan dalam program uji coba MVP.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCohortCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Unduh CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah UMKM Binaan
          </button>
        </div>
      </div>

      {/* Cohort KPI Strip aligned with PRD Success Metrics */}
      <section aria-label="Ringkasan Program Inkubasi" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">UMKM Binaan Terpantau</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
            {members.length} UMKM
          </p>
          <p className="text-xs text-slate-500">Target MVP 3 bulan: 100 UMKM aktif</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Retensi Mingguan</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-teal-700">
            {retentionPercent}%
          </p>
          <p className="text-xs text-slate-500">Target retensi mingguan &gt; 40%</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Total Sesi Minggu Ini</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
            {totalSessionsWeek} sesi
          </p>
          <p className="text-xs text-slate-500">
            Rata-rata {(totalSessionsWeek / Math.max(1, members.length)).toFixed(1)} sesi/UMKM
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Rata-Rata Latensi Kohort</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
            {avgCohortLatency} ms
          </p>
          <p className="text-xs text-teal-700 font-medium">
            Di bawah batas SLA {LATENCY_SLA_MS} ms
          </p>
        </div>
      </section>

      {/* Filter & Search Bar + Cohort Table */}
      <section aria-labelledby="cohort-table-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(['Semua', 'Kuliner', 'Fesyen', 'Kerajinan'] as SectorFilter[]).map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => setSectorFilter(sector)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sectorFilter === sector
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sector}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama toko, pemilik, kota..."
              aria-label="Cari UMKM binaan"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            />
          </div>
        </div>

        <h2 id="cohort-table-heading" className="sr-only">
          Daftar Performa UMKM Binaan
        </h2>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-900">
                Tidak ada UMKM yang cocok dengan filter
              </p>
              <p className="text-xs text-slate-500">
                Ubah kata pencarian atau pilih sektor Semua untuk menampilkan seluruh binaan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 pl-5 pr-4">UMKM &amp; Pemilik</th>
                    <th className="py-3 px-4">Sektor · Kota</th>
                    <th className="py-3 px-4 text-right">Sesi / Minggu</th>
                    <th className="py-3 px-4 text-right">Pemicu / Bulan</th>
                    <th className="py-3 px-4 text-right">Latensi</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 pl-4 pr-5 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 pl-5 pr-4">
                        <p className="font-semibold text-slate-900">{m.storeName}</p>
                        <p className="text-xs text-slate-500">
                          {m.ownerName} · Terakhir live {m.lastBroadcastDate}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {m.sector} · {m.city}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {m.sessionsThisWeek}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {m.totalTriggersMonth}x
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {m.avgLatencyMs} ms
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            m.status === 'Aktif'
                              ? 'text-teal-700'
                              : m.status === 'Perlu Pendampingan'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedMemberId(m.id)}
                          aria-label={`Tinjau ${m.storeName}`}
                          className="text-xs font-semibold text-slate-700 hover:text-red-600 underline underline-offset-2"
                        >
                          Tinjau
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Member Inspection & Status Update Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-detail-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 id="member-detail-title" className="text-base font-bold text-slate-900">
                  {selectedMember.storeName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedMember.ownerName} · {selectedMember.sector} · {selectedMember.city}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                aria-label="Tutup detail UMKM"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">Batch Inkubasi</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {selectedMember.programBatch}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Frekuensi Siaran</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                  {selectedMember.sessionsThisWeek} sesi / minggu
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Latensi Rata-rata</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                  {selectedMember.avgLatencyMs} ms
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Pemicu Bulan Ini</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                  {selectedMember.totalTriggersMonth}x
                </dd>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <dt className="text-slate-500">Produk Paling Sering Ditampilkan</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {selectedMember.topProduct}
                </dd>
              </div>
            </dl>

            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <label
                htmlFor="member-status-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Perbarui Status Pendampingan
              </label>
              <select
                id="member-status-select"
                value={selectedMember.status}
                onChange={(e) =>
                  onUpdateMemberStatus(
                    selectedMember.id,
                    e.target.value as UmkmCohortMember['status'],
                  )
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="Aktif">Aktif (Retensi Terjaga)</option>
                <option value="Perlu Pendampingan">Perlu Pendampingan</option>
                <option value="Baru Bergabung">Baru Bergabung</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add UMKM Binaan Modal */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-umkm-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 id="add-umkm-title" className="text-base font-bold text-slate-900">
                Daftarkan UMKM Binaan Baru
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                aria-label="Tutup form UMKM baru"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} noValidate className="p-6 space-y-4">
              {formError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  {formError}
                </p>
              )}

              <div>
                <label htmlFor="umkm-store" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Usaha / Brand UMKM
                </label>
                <input
                  id="umkm-store"
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Contoh: Sambal Roa Manado Ibu Grace"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="umkm-owner" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Pemilik
                  </label>
                  <input
                    id="umkm-owner"
                    type="text"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Grace Kalalo"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="umkm-city" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kota / Kabupaten
                  </label>
                  <input
                    id="umkm-city"
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="Manado"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="umkm-sector" className="block text-xs font-semibold text-slate-700 mb-1">
                    Sektor Usaha
                  </label>
                  <select
                    id="umkm-sector"
                    value={newSector}
                    onChange={(e) =>
                      setNewSector(e.target.value as 'Kuliner' | 'Fesyen' | 'Kerajinan')
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Kuliner">Kuliner</option>
                    <option value="Fesyen">Fesyen</option>
                    <option value="Kerajinan">Kerajinan</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="umkm-top-prod" className="block text-xs font-semibold text-slate-700 mb-1">
                    Produk Unggulan
                  </label>
                  <input
                    id="umkm-top-prod"
                    type="text"
                    value={newTopProduct}
                    onChange={(e) => setNewTopProduct(e.target.value)}
                    placeholder="Sambal Roa 200g"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Daftarkan UMKM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
