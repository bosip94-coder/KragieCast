import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectVoiceCommand,
  matchProductKeyword,
  normalizeIndonesianSpeech,
} from './keywordEngine';
import { INITIAL_PRODUCTS } from './seedData';

test('normalizeIndonesianSpeech strips punctuation and expands UMKM slang', () => {
  const normalized = normalizeIndonesianSpeech('Yuk Kak!! Cekout PKT HMT hari ini ya!');
  assert.equal(normalized, 'yuk kak checkout paket hemat hari ini ya');
});

test('matchProductKeyword detects Indonesian casual selling keywords accurately', () => {
  const match = matchProductKeyword(
    'Halo bun, buat yang mau paket hemat langsung cekout keranjang kuning ya!',
    INITIAL_PRODUCTS,
  );
  assert.ok(match, 'Should match Paket Hemat Hampers Nusantara');
  assert.equal(match.product.id, 'prod-hampers');
  assert.equal(match.matchedKeyword, 'paket hemat');
  assert.ok(match.latencyMs < 1500, 'Latency must be well below 1500ms SLA');
});

test('matchProductKeyword returns null when no product keyword is spoken', () => {
  const match = matchProductKeyword(
    'Halo selamat sore semuanya, apa kabar kota Bandung hari ini?',
    INITIAL_PRODUCTS,
  );
  assert.equal(match, null);
});

test('detectVoiceCommand recognizes zoom detail and camera reset voice commands', () => {
  const zoomIn = detectVoiceCommand('Coba kita zoom detail supaya kelihatan bumbunya');
  assert.ok(zoomIn);
  assert.equal(zoomIn.command, 'zoom_in');

  const zoomReset = detectVoiceCommand('Oke kita kembali ke kamera normal lagi ya');
  assert.ok(zoomReset);
  assert.equal(zoomReset.command, 'zoom_reset');

  const hide = detectVoiceCommand('Tolong tutup overlay sekarang');
  assert.ok(hide);
  assert.equal(hide.command, 'hide_overlay');
});
