import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { FONTES_CERTIFICADOS, getFontesCertificadosHeadHtml, getFontesReadyPrintScript } from '../src/lib/certificados-fontes';

test('FONTES_CERTIFICADOS inclui Great Vibes e Allura preservando fontes existentes', () => {
  assert.ok(FONTES_CERTIFICADOS.includes('Great Vibes'), 'Deve conter Great Vibes');
  assert.ok(FONTES_CERTIFICADOS.includes('Allura'), 'Deve conter Allura');
  assert.ok(FONTES_CERTIFICADOS.includes('Arial'), 'Deve preservar Arial');
  assert.ok(FONTES_CERTIFICADOS.includes('Times New Roman'), 'Deve preservar Times New Roman');
  assert.ok(FONTES_CERTIFICADOS.includes('Comic Sans MS'), 'Deve preservar Comic Sans MS');
  assert.ok(FONTES_CERTIFICADOS.length >= 16);
});

test('Arquivos WOFF2 locais existem no diretório public/fonts', () => {
  const greatVibesPath = path.join(process.cwd(), 'public', 'fonts', 'GreatVibes-Regular.woff2');
  const alluraPath = path.join(process.cwd(), 'public', 'fonts', 'Allura-Regular.woff2');

  assert.ok(fs.existsSync(greatVibesPath), 'Arquivo GreatVibes-Regular.woff2 deve existir');
  assert.ok(fs.existsSync(alluraPath), 'Arquivo Allura-Regular.woff2 deve existir');

  const gvSize = fs.statSync(greatVibesPath).size;
  const alluraSize = fs.statSync(alluraPath).size;

  assert.ok(gvSize > 20000, `Great Vibes deve ter tamanho válido (>20KB), obteve: ${gvSize}`);
  assert.ok(alluraSize > 20000, `Allura deve ter tamanho válido (>20KB), obteve: ${alluraSize}`);
});

test('getFontesCertificadosHeadHtml inclui @font-face local e fallback do Google Fonts', () => {
  const html = getFontesCertificadosHeadHtml();
  assert.ok(html.includes("font-family: 'Great Vibes'"), 'Deve conter font-family Great Vibes');
  assert.ok(html.includes("font-family: 'Allura'"), 'Deve conter font-family Allura');
  assert.ok(html.includes('/fonts/GreatVibes-Regular.woff2'), 'Deve apontar para woff2 de Great Vibes');
  assert.ok(html.includes('/fonts/Allura-Regular.woff2'), 'Deve apontar para woff2 de Allura');
  assert.ok(html.includes('fonts.googleapis.com'), 'Deve conter fallback Google Fonts');
});

test('getFontesReadyPrintScript aguarda document.fonts.ready antes de disparar window.print', () => {
  const script = getFontesReadyPrintScript();
  assert.ok(script.includes('document.fonts.ready'), 'Deve verificar document.fonts.ready');
  assert.ok(script.includes('window.print()'), 'Deve disparar window.print()');
});
