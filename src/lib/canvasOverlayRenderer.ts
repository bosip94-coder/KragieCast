import type { OverlayTemplateId, Product } from '../types/kragiecast';
import { calculateDiscountPercent, formatRupiah } from './analyticsEngine';

export interface CameraFrameState {
  zoom: number;
  autoFraming: boolean;
  showFaceGuide: boolean;
  driftPhase: number;
}

export interface ActiveOverlayRenderState {
  product: Product;
  etalaseNumber?: number;
  isPinned?: boolean;
  templateId: OverlayTemplateId;
  ctaText: string;
  showStockAlert: boolean;
  progress: number; // 0..1 remaining time ratio
  remainingSec: number;
  enterProgress: number; // 0..1 smooth slide-in
  matchedKeyword?: string;
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Pure camera framing math for AI Auto-Framing (face centering) & smooth 1.0x-1.5x digital zoom.
 */
export function computeCameraCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  zoom: number,
  autoFraming: boolean,
  driftPhase: number,
): CropRect {
  const safeZoom = Math.max(1, Math.min(2.0, zoom));
  const srcAspect = sourceWidth / Math.max(1, sourceHeight);

  let baseSw = sourceWidth;
  let baseSh = sourceHeight;

  if (srcAspect > targetAspect) {
    baseSw = sourceHeight * targetAspect;
  } else {
    baseSh = sourceWidth / targetAspect;
  }

  const sw = baseSw / safeZoom;
  const sh = baseSh / safeZoom;

  // Target focal point: host face in our studio frame sits around (0.53, 0.36)
  // When Auto-Framing is OFF, simulate subtle off-center drift; when ON, lock smoothly onto host face.
  const driftX = autoFraming ? Math.sin(driftPhase * 0.4) * 0.004 : Math.sin(driftPhase * 0.65) * 0.032 + 0.025;
  const driftY = autoFraming ? Math.cos(driftPhase * 0.35) * 0.003 : Math.cos(driftPhase * 0.5) * 0.02;

  const focusX = (autoFraming ? 0.525 : 0.5) + driftX;
  const focusY = (autoFraming ? 0.39 : 0.46) + driftY;

  const rawSx = focusX * sourceWidth - sw / 2;
  const rawSy = focusY * sourceHeight - sh / 2;

  const sx = Math.max(0, Math.min(sourceWidth - sw, rawSx));
  const sy = Math.max(0, Math.min(sourceHeight - sh, rawSy));

  return { sx, sy, sw, sh };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 3 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

export function renderBroadcastFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mediaSource: HTMLVideoElement | HTMLImageElement | null,
  frameState: CameraFrameState,
  overlay: ActiveOverlayRenderState | null,
  productImage: HTMLImageElement | null,
  liveBadge: { isLive: boolean; elapsedLabel: string; storeName: string },
) {
  // 1. Background Base
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, width, height);

  // 2. Camera / Simulated Host Feed with Auto-Framing + Smooth Zoom
  if (mediaSource) {
    const srcW =
      mediaSource instanceof HTMLVideoElement
        ? mediaSource.videoWidth
        : mediaSource.naturalWidth;
    const srcH =
      mediaSource instanceof HTMLVideoElement
        ? mediaSource.videoHeight
        : mediaSource.naturalHeight;

    if (srcW > 0 && srcH > 0) {
      const crop = computeCameraCrop(
        srcW,
        srcH,
        width / height,
        frameState.zoom,
        frameState.autoFraming,
        frameState.driftPhase,
      );
      ctx.drawImage(mediaSource, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Memuat Umpan Kamera Studio KragieCast AI...', width / 2, height / 2);
    ctx.textAlign = 'left';
  }

  // Subtle bottom contrast scrim when overlay is visible
  if (overlay) {
    const scrim = ctx.createLinearGradient(0, height * 0.58, 0, height);
    scrim.addColorStop(0, 'rgba(15, 23, 42, 0)');
    scrim.addColorStop(1, 'rgba(15, 23, 42, 0.52)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, height * 0.58, width, height * 0.42);
  }

  // 3. Optional Calibration Face Tracking Guide (only when user enables guide toggle)
  if (frameState.autoFraming && frameState.showFaceGuide) {
    const boxSize = Math.round(height * 0.28 * Math.min(1.25, frameState.zoom));
    const cx = width * 0.5;
    const cy = height * 0.34;
    const x = cx - boxSize / 2;
    const y = cy - boxSize / 2;
    const corner = 22;

    ctx.save();
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.9)';
    ctx.lineWidth = 2.5;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + corner, y);
    // Top-right
    ctx.moveTo(x + boxSize - corner, y);
    ctx.lineTo(x + boxSize, y);
    ctx.lineTo(x + boxSize, y + corner);
    // Bottom-right
    ctx.moveTo(x + boxSize, y + boxSize - corner);
    ctx.lineTo(x + boxSize, y + boxSize);
    ctx.lineTo(x + boxSize - corner, y + boxSize);
    // Bottom-left
    ctx.moveTo(x + corner, y + boxSize);
    ctx.lineTo(x, y + boxSize);
    ctx.lineTo(x, y + boxSize - corner);
    ctx.stroke();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    drawRoundedRect(ctx, x, y - 30, 184, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#5eead4';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText(`AUTO-FRAME · ${frameState.zoom.toFixed(1)}x`, x + 10, y - 14);
    ctx.restore();
  }

  // 4. Broadcast Top-Left On-Air Strip (clean, crisp broadcast telemetry)
  ctx.save();
  const topY = 24;
  const leftX = 28;
  ctx.fillStyle = liveBadge.isLive ? '#dc2626' : 'rgba(15, 23, 42, 0.82)';
  drawRoundedRect(ctx, leftX, topY, liveBadge.isLive ? 106 : 118, 32, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(liveBadge.isLive ? 'LIVE ON AIR' : 'PRATINJAU', leftX + 14, topY + 21);

  const infoX = leftX + (liveBadge.isLive ? 114 : 126);
  ctx.font = '500 13px "JetBrains Mono", monospace';
  const labelText = liveBadge.isLive
    ? `${liveBadge.elapsedLabel}  ·  ${liveBadge.storeName}`
    : `${liveBadge.storeName}`;
  const measuredW = Math.ceil(ctx.measureText(labelText).width);
  const infoBoxW = Math.min(440, Math.max(220, measuredW + 26));

  ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
  drawRoundedRect(ctx, infoX, topY, infoBoxW, 32, 6);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.fillText(truncateText(ctx, labelText, infoBoxW - 24), infoX + 12, topY + 21);
  ctx.restore();

  // 5. Lower-Third Product Overlay (FR-03 & FR-04)
  if (overlay) {
    drawProductOverlay(ctx, width, height, overlay, productImage);
  }
}

function drawProductOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: ActiveOverlayRenderState,
  productImage: HTMLImageElement | null,
) {
  const {
    product,
    etalaseNumber,
    isPinned,
    templateId,
    ctaText,
    showStockAlert,
    progress,
    remainingSec,
    enterProgress,
  } = overlay;
  const discount = calculateDiscountPercent(product.normalPrice, product.promoPrice);
  const eased = 1 - Math.pow(1 - Math.max(0, Math.min(1, enterProgress)), 3);
  const slideOffsetY = (1 - eased) * 48;
  const isPortrait = height > width;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, eased * 1.15));
  ctx.translate(0, slideOffsetY);

  const marginX = isPortrait ? 24 : 36;
  const barH = 148;
  const barW = Math.min(820, width - marginX * 2);
  const x = marginX;
  const y = height - barH - (isPortrait ? 44 : 32);

  const etalasePrefix = etalaseNumber ? `ETALASE #${etalaseNumber} · ` : '';
  const timerLabel = isPinned ? 'DITAHAN' : `${Math.ceil(remainingSec)}d`;

  if (templateId === 'modern') {
    // Template 1: Siaran Modern (Obsidian studio slate + crimson promo accent)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    drawRoundedRect(ctx, x, y, barW, barH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawProductThumb(ctx, x + 16, y + 16, 116, 116, 8, productImage, '#1e293b');

    const tx = x + 150;
    const maxTextW = barW - 176;

    // Kicker row
    ctx.fillStyle = '#f87171';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    const kicker =
      discount > 0
        ? `${etalasePrefix}PROMO LIVE · HEMAT ${discount}%${showStockAlert ? ` · SISA ${product.stock}` : ''}`
        : `${etalasePrefix}PRODUK UNGGULAN${showStockAlert ? ` · STOK ${product.stock}` : ''}`;
    ctx.fillText(truncateText(ctx, kicker, maxTextW), tx, y + 34);

    // Product title
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${isPortrait ? 20 : 24}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(truncateText(ctx, product.name, maxTextW), tx, y + 66);

    // Price row
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 ${isPortrait ? 23 : 26}px "JetBrains Mono", monospace`;
    const promoStr = formatRupiah(product.promoPrice);
    ctx.fillText(promoStr, tx, y + 104);
    const promoW = ctx.measureText(promoStr).width;

    if (product.normalPrice > product.promoPrice) {
      const normalStr = formatRupiah(product.normalPrice);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px "JetBrains Mono", monospace';
      const nx = tx + promoW + 12;
      if (nx + 70 < x + barW - 16) {
        ctx.fillText(normalStr, nx, y + 102);
        const nw = ctx.measureText(normalStr).width;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(nx, y + 97);
        ctx.lineTo(nx + nw, y + 97);
        ctx.stroke();
      }
    }

    // CTA Footer
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 14px "DM Sans", sans-serif';
    ctx.fillText(truncateText(ctx, ctaText || product.ctaText, maxTextW - 76), tx, y + 129);

    // Countdown / Pin label
    ctx.fillStyle = isPinned ? '#5eead4' : '#94a3b8';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timerLabel, x + barW - 18, y + 129);
    ctx.textAlign = 'left';

    // Progress bar at bottom
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 12, y + barH - 5, barW - 24, 4);
    ctx.fillStyle = isPinned ? '#14b8a6' : '#dc2626';
    ctx.fillRect(x + 12, y + barH - 5, (barW - 24) * Math.max(0, Math.min(1, progress)), 4);
  } else if (templateId === 'flash_sale') {
    // Template 2: Flash Sale UMKM (High-converting Crimson + Amber)
    ctx.fillStyle = '#991b1b';
    drawRoundedRect(ctx, x, y, barW, barH, 12);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    drawRoundedRect(ctx, x, y, barW, 40, 12);
    ctx.fill();
    ctx.fillRect(x, y + 20, barW, 20);

    // Header strip
    ctx.fillStyle = '#fef08a';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      truncateText(
        ctx,
        `${etalasePrefix}FLASH SALE${discount > 0 ? ` — DISKON ${discount}%` : ''}`,
        barW * 0.58,
      ),
      x + 18,
      y + 25,
    );

    if (showStockAlert) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`STOK ${product.stock} · ${timerLabel}`, x + barW - 18, y + 25);
      ctx.textAlign = 'left';
    }

    drawProductThumb(ctx, x + 16, y + 50, 84, 84, 8, productImage, '#7f1d1d');

    const tx = x + 116;
    const maxTextW = barW - 138;

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${isPortrait ? 19 : 22}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(truncateText(ctx, product.name, maxTextW), tx, y + 76);

    ctx.fillStyle = '#fde047';
    ctx.font = `700 ${isPortrait ? 23 : 26}px "JetBrains Mono", monospace`;
    const promoStr = formatRupiah(product.promoPrice);
    ctx.fillText(promoStr, tx, y + 109);
    const promoW = ctx.measureText(promoStr).width;

    if (product.normalPrice > product.promoPrice) {
      const normalStr = formatRupiah(product.normalPrice);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '500 14px "JetBrains Mono", monospace';
      const nx = tx + promoW + 12;
      if (nx + 70 < x + barW - 16) {
        ctx.fillText(normalStr, nx, y + 107);
        const nw = ctx.measureText(normalStr).width;
        ctx.strokeStyle = 'rgba(255,255,255,0.72)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(nx, y + 102);
        ctx.lineTo(nx + nw, y + 102);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#fee2e2';
    ctx.font = '600 14px "DM Sans", sans-serif';
    ctx.fillText(truncateText(ctx, ctaText || product.ctaText, maxTextW), tx, y + 132);

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y + barH - 5, barW, 5);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(x, y + barH - 5, barW * Math.max(0, Math.min(1, progress)), 5);
  } else if (templateId === 'minimalis') {
    // Template 3: Minimalis Elegan (Crisp off-white editorial lower-third)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    drawRoundedRect(ctx, x, y, barW, barH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawProductThumb(ctx, x + 16, y + 16, 116, 116, 6, productImage, '#f1f5f9');

    const tx = x + 150;
    const maxTextW = barW - 176;

    ctx.fillStyle = '#0f766e';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      truncateText(
        ctx,
        `${etalasePrefix}${product.category.toUpperCase()}${discount > 0 ? ` · HEMAT ${discount}%` : ''}${showStockAlert ? ` · STOK ${product.stock}` : ''}`,
        maxTextW,
      ),
      tx,
      y + 34,
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${isPortrait ? 19 : 23}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(truncateText(ctx, product.name, maxTextW), tx, y + 66);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${isPortrait ? 22 : 25}px "JetBrains Mono", monospace`;
    const promoStr = formatRupiah(product.promoPrice);
    ctx.fillText(promoStr, tx, y + 102);
    const promoW = ctx.measureText(promoStr).width;

    if (product.normalPrice > product.promoPrice) {
      const normalStr = formatRupiah(product.normalPrice);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 15px "JetBrains Mono", monospace';
      const nx = tx + promoW + 12;
      if (nx + 70 < x + barW - 16) {
        ctx.fillText(normalStr, nx, y + 100);
        const nw = ctx.measureText(normalStr).width;
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nx, y + 95);
        ctx.lineTo(nx + nw, y + 95);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#475569';
    ctx.font = '500 14px "DM Sans", sans-serif';
    ctx.fillText(truncateText(ctx, ctaText || product.ctaText, maxTextW - 68), tx, y + 128);

    ctx.fillStyle = isPinned ? '#0f766e' : '#64748b';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timerLabel, x + barW - 18, y + 128);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x, y + barH - 4, barW, 4);
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(x, y + barH - 4, barW * Math.max(0, Math.min(1, progress)), 4);
  } else {
    // Template 4: Klasik Berita (Broadcast TV structured lower-third + CTA ticker band)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, barW, barH - 34);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, y + barH - 34, barW, 34);

    drawProductThumb(ctx, x + 12, y + 12, 90, 90, 4, productImage, '#e2e8f0');

    const tx = x + 118;
    const maxTextW = barW - 140;

    ctx.fillStyle = '#dc2626';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      truncateText(
        ctx,
        `${etalasePrefix}LIVE PROMO${discount > 0 ? ` · HEMAT ${discount}%` : ''}`,
        maxTextW,
      ),
      tx,
      y + 30,
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(truncateText(ctx, product.name, maxTextW), tx, y + 60);

    ctx.fillStyle = '#dc2626';
    ctx.font = '700 24px "JetBrains Mono", monospace';
    const promoStr = formatRupiah(product.promoPrice);
    ctx.fillText(promoStr, tx, y + 94);
    const promoW = ctx.measureText(promoStr).width;

    if (product.normalPrice > product.promoPrice) {
      const normalStr = formatRupiah(product.normalPrice);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 15px "JetBrains Mono", monospace';
      const nx = tx + promoW + 12;
      ctx.fillText(normalStr, nx, y + 92);
      const nw = ctx.measureText(normalStr).width;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nx, y + 87);
      ctx.lineTo(nx + nw, y + 87);
      ctx.stroke();
    }

    // Bottom ticker band
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 14px "DM Sans", sans-serif';
    const tickerText = `${ctaText || product.ctaText}${showStockAlert ? ` · Tersedia ${product.stock} unit` : ''}`;
    ctx.fillText(truncateText(ctx, tickerText, barW - 90), x + 16, y + barH - 12);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(remainingSec)}d`, x + barW - 16, y + barH - 12);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x, y + barH - 4, barW * Math.max(0, Math.min(1, progress)), 4);
  }

  ctx.restore();
}

function drawProductThumb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  img: HTMLImageElement | null,
  fallbackColor: string,
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRODUK', x + w / 2, y + h / 2 + 4);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}
