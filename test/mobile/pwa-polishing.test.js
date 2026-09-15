import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

/**
 * Testes Automatizados para PWA, Manifest, Service Worker e Polimento Mobile (FASE E.2.6)
 */
describe('FASE E.2.6 — Polimento do MVP + PWA do App Mobile', () => {
  it('A. Manifest do Next.js App Router existe e contém configurações válidas', () => {
    const manifestPath = path.resolve('src/app/manifest.ts');
    assert.ok(fs.existsSync(manifestPath), 'src/app/manifest.ts deve existir');

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    assert.ok(manifestContent.includes("name: 'Gestão Eklésia — App do Membro'"));
    assert.ok(manifestContent.includes("short_name: 'Eklésia'"));
    assert.ok(manifestContent.includes("start_url: '/app/inicio'"));
    assert.ok(manifestContent.includes("display: 'standalone'"));
    assert.ok(manifestContent.includes("background_color: '#0f172a'"));
    assert.ok(manifestContent.includes("theme_color: '#0f172a'"));
  });

  it('B. Ícones PWA obrigatórios estão presentes em public/icons/', () => {
    const icons = [
      'public/icons/icon-192x192.png',
      'public/icons/icon-512x512.png',
      'public/icons/icon-maskable-192x192.png',
      'public/icons/icon-maskable-512x512.png',
      'public/icons/apple-touch-icon.png',
    ];

    for (const iconPath of icons) {
      const fullPath = path.resolve(iconPath);
      assert.ok(fs.existsSync(fullPath), `Ícone obrigatório não encontrado: ${iconPath}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 0, `Ícone não pode estar vazio: ${iconPath}`);
    }
  });

  it('C. start_url e scope estão restritos e apontam para o app do membro', () => {
    const manifestContent = fs.readFileSync(path.resolve('src/app/manifest.ts'), 'utf8');
    assert.ok(manifestContent.includes("start_url: '/app/inicio'"));
    assert.ok(manifestContent.includes("scope: '/app'"));
  });

  it('D. Layout mobile exporta Viewport e Apple Web App metadata corretos', () => {
    const layoutPath = path.resolve('src/app/app/layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    assert.ok(layoutContent.includes('export const viewport: Viewport'));
    assert.ok(layoutContent.includes("capable: true"));
    assert.ok(layoutContent.includes("statusBarStyle: 'black-translucent'"));
    assert.ok(layoutContent.includes("apple-touch-icon.png"));
  });

  it('E. Service Worker existe e não cacheia requisições de /api/ ou autenticação', () => {
    const swPath = path.resolve('public/sw.js');
    assert.ok(fs.existsSync(swPath), 'public/sw.js deve existir');

    const swContent = fs.readFileSync(swPath, 'utf8');
    // Verifica regra de network-only para APIs e dados dinâmicos
    assert.ok(swContent.includes("url.pathname.startsWith('/api/')"));
    assert.ok(swContent.includes("request.headers.has('Authorization')"));
    assert.ok(swContent.includes('offline: true'));
  });

  it('F. Estratégia de cache do Service Worker protege dados privados contra vazamento multi-usuário', () => {
    const swContent = fs.readFileSync(path.resolve('public/sw.js'), 'utf8');
    // Apenas assets estáticos imutáveis entram em cache de longo prazo
    assert.ok(swContent.includes("url.pathname.startsWith('/_next/static/')"));
    assert.ok(swContent.includes("url.pathname.startsWith('/icons/')"));
    assert.ok(swContent.includes("url.pathname.startsWith('/brand/')"));
  });

  it('G. Componente de alerta offline (OfflineBanner) está integrado ao MobileShell', () => {
    const shellContent = fs.readFileSync(path.resolve('src/components/mobile/MobileShell.tsx'), 'utf8');
    assert.ok(shellContent.includes('<OfflineBanner />'));
    assert.ok(shellContent.includes('<PwaInstaller />'));
  });

  it('H. Instalador PWA (PwaInstaller) oferece experiência dispensável e não intrusiva', () => {
    const installerContent = fs.readFileSync(path.resolve('src/components/mobile/PwaInstaller.tsx'), 'utf8');
    assert.ok(installerContent.includes('beforeinstallprompt'));
    assert.ok(installerContent.includes('sessionStorage.getItem'));
    assert.ok(installerContent.includes('sessionStorage.setItem'));
  });

  it('I. MobileBottomNav mantém exatamente 5 abas integradas (Início, Eventos, Contribuir, Carteirinha, Perfil)', () => {
    const navContent = fs.readFileSync(path.resolve('src/components/mobile/MobileBottomNav.tsx'), 'utf8');
    assert.ok(navContent.includes("href: '/app/inicio', label: 'Início'"));
    assert.ok(navContent.includes("href: '/app/eventos', label: 'Eventos'"));
    assert.ok(navContent.includes("href: '/app/contribuir', label: 'Contribuir'"));
    assert.ok(navContent.includes("href: '/app/carteirinha', label: 'Carteirinha'"));
    assert.ok(navContent.includes("href: '/app/perfil', label: 'Perfil'"));
  });

  it('J. Home (/app/inicio) possui atalhos ativos para todas as áreas principais do MVP', () => {
    const inicioContent = fs.readFileSync(path.resolve('src/app/app/inicio/page.tsx'), 'utf8');
    assert.ok(inicioContent.includes("href: '/app/perfil'"));
    assert.ok(inicioContent.includes("href: '/app/carteirinha'"));
    assert.ok(inicioContent.includes("href: '/app/contribuir'"));
    assert.ok(inicioContent.includes("href: '/app/eventos'"));
  });
});
