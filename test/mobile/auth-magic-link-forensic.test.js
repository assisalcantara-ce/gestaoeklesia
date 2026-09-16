import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PROMPT 31 — Auditoria e Correção Forense do Login do Portal do Membro', () => {
  // A — login gera Magic Link com redirect correto
  it('A — login gera Magic Link com redirectTo apontando para /app/auth/callback', () => {
    const loginContent = fs.readFileSync(path.resolve('src/app/app/login/page.tsx'), 'utf8');
    assert.ok(
      loginContent.includes('/app/auth/callback'),
      'O login deve configurar emailRedirectTo para a rota /app/auth/callback'
    );
    assert.ok(
      loginContent.includes('signInWithOtp'),
      'Deve utilizar Supabase auth.signInWithOtp oficial'
    );
    assert.ok(
      loginContent.includes('shouldCreateUser: true'),
      'Deve permitir criação segura de usuário para novos membros'
    );
  });

  // B — callback estabelece sessão
  it('B — callback oficial (/app/auth/callback) troca código PKCE por sessão e grava cookies', () => {
    const callbackPath = path.resolve('src/app/app/auth/callback/route.ts');
    assert.ok(fs.existsSync(callbackPath), 'A rota /app/auth/callback/route.ts deve existir');
    const callbackContent = fs.readFileSync(callbackPath, 'utf8');
    assert.ok(
      callbackContent.includes('exchangeCodeForSession'),
      'Callback deve invocar exchangeCodeForSession(code)'
    );
    assert.ok(
      callbackContent.includes('@supabase/ssr'),
      'Callback deve utilizar createServerClient do @supabase/ssr para persistência de cookies'
    );
  });

  // C — callback não retorna para login após sucesso
  it('C — callback NÃO retorna para login após troca de sessão com sucesso', () => {
    const callbackContent = fs.readFileSync(path.resolve('src/app/app/auth/callback/route.ts'), 'utf8');
    assert.ok(
      callbackContent.includes('/app/inicio') && callbackContent.includes('/app/vincular'),
      'Sucesso deve direcionar para /app/inicio ou /app/vincular, nunca /app/login'
    );
  });

  // D — membro vinculado vai para /app/inicio
  it('D — membro vinculado a auth_user_id é encaminhado para /app/inicio', () => {
    const callbackContent = fs.readFileSync(path.resolve('src/app/app/auth/callback/route.ts'), 'utf8');
    assert.ok(
      callbackContent.includes("eq('auth_user_id', data.user.id)"),
      'Callback deve consultar members WHERE auth_user_id = user.id'
    );
    assert.ok(
      callbackContent.includes('/app/inicio'),
      'Membro vinculado deve ser redirecionado para /app/inicio'
    );
  });

  // E — membro não vinculado vai para /app/vincular
  it('E — usuário autenticado sem vínculo vai para /app/vincular', () => {
    const callbackContent = fs.readFileSync(path.resolve('src/app/app/auth/callback/route.ts'), 'utf8');
    assert.ok(
      callbackContent.includes('/app/vincular'),
      'Usuário sem vínculo deve ser redirecionado para /app/vincular'
    );
  });

  // F — erro retorna para login com mensagem clara
  it('F — erro de código ausente ou inválido retorna para /app/login com query error', () => {
    const callbackContent = fs.readFileSync(path.resolve('src/app/app/auth/callback/route.ts'), 'utf8');
    assert.ok(
      callbackContent.includes('/app/login?error='),
      'Falha na troca de código deve redirecionar para /app/login?error=...'
    );

    const loginContent = fs.readFileSync(path.resolve('src/app/app/login/page.tsx'), 'utf8');
    assert.ok(
      loginContent.includes('searchParams') || loginContent.includes('URLSearchParams'),
      'Login deve ler parâmetro error e exibir ao usuário'
    );
  });

  // G — logout encerra sessão
  it('G — logout desconecta e MobileMemberProvider redireciona para login', () => {
    const providerContent = fs.readFileSync(path.resolve('src/providers/MobileMemberProvider.tsx'), 'utf8');
    assert.ok(
      providerContent.includes('!user'),
      'MobileMemberProvider deve detectar ausência de user'
    );
    assert.ok(
      providerContent.includes("router.replace('/app/login')"),
      'Usuário não autenticado em rota privada deve ser levado a /app/login'
    );
  });

  // H — reload mantém sessão
  it('H — reload mantém sessão via AuthProvider e MobileMemberProvider sem resetar estado', () => {
    const rootContent = fs.readFileSync(path.resolve('src/app/app/page.tsx'), 'utf8');
    assert.ok(
      rootContent.includes('useAuth') && rootContent.includes('useMobileMember'),
      'Rota raiz /app deve aguardar auth e redirecionar conforme estado'
    );
    assert.ok(
      rootContent.includes('authLoading || memberLoading'),
      'Não deve redirecionar prematuramente enquanto sessão estiver em carregamento'
    );
  });

  // I — nenhum loop de autenticação
  it('I — ProtectedRoute global não interfere nas rotas /app/*', () => {
    const protectedContent = fs.readFileSync(path.resolve('src/components/ProtectedRoute.tsx'), 'utf8');
    assert.ok(
      protectedContent.includes("pathname === '/app' || pathname.startsWith('/app/')"),
      'ProtectedRoute global deve liberar todas as rotas mobile para o MobileMemberProvider'
    );
  });

  // J — template de e-mail institucional homologado
  it('J — Template institucional do Supabase Auth existe e contém ConfirmationURL oficial', () => {
    const templatePath = path.resolve('docs/email-templates/supabase-magic-link-template.html');
    assert.ok(fs.existsSync(templatePath), 'Arquivo de template de e-mail institucional deve existir');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    assert.ok(
      templateContent.includes('{{ .ConfirmationURL }}'),
      'Template deve utilizar a tag oficial {{ .ConfirmationURL }} do Supabase'
    );
    assert.ok(
      templateContent.includes('Gestão Eklésia'),
      'Template deve conter a marca Gestão Eklésia'
    );
    assert.ok(
      templateContent.includes('ACESSAR MEU PORTAL'),
      'Template deve conter o botão de ação [ ACESSAR MEU PORTAL ]'
    );
  });

  // K — responsividade e digitação direta com máscara nos campos de vinculação
  it('K — campos CPF e Data de Nascimento em /app/vincular utilizam digitação direta com máscara e contenção de overflow', () => {
    const vincularContent = fs.readFileSync(path.resolve('src/app/app/vincular/page.tsx'), 'utf8');
    assert.ok(
      vincularContent.includes('formatData') && vincularContent.includes('placeholder="DD/MM/AAAA"'),
      'Data de Nascimento deve utilizar máscara digitada DD/MM/AAAA'
    );
    assert.ok(
      vincularContent.includes('formatCpf') && vincularContent.includes('placeholder="000.000.000-00"'),
      'CPF deve utilizar máscara 000.000.000-00'
    );
    assert.ok(
      vincularContent.includes('max-w-full') && vincularContent.includes('min-w-0'),
      'Ambos os inputs devem possuir contenção estrita de overflow'
    );
  });

  // L — normalização determinística de data e resolução de candidatos multi-tenant
  it('L — endpoint /api/v1/mobile/auth/link-member suporta normalização civil de data e resolve candidatos elegíveis', () => {
    const routeContent = fs.readFileSync(path.resolve('src/app/api/v1/mobile/auth/link-member/route.ts'), 'utf8');
    assert.ok(
      routeContent.includes('DATE_BR_RE') && routeContent.includes('DATE_ISO_RE'),
      'Deve suportar formatos AAAA-MM-DD e DD/MM/AAAA de forma determinística'
    );
    assert.ok(
      routeContent.includes('unlinkedMember = candidates.find((c) => !c.auth_user_id)'),
      'Deve priorizar o membro não vinculado entre múltiplos candidatos multi-tenant'
    );
  });

  // M — tratamento seguro de códigos de erro no frontend
  it('M — frontend /app/vincular mapeia os códigos de erro oficiais da API sem fallback indevido', () => {
    const vincularContent = fs.readFileSync(path.resolve('src/app/app/vincular/page.tsx'), 'utf8');
    assert.ok(
      vincularContent.includes('data.code || data.error'),
      'Deve ler data.code ou data.error para exibição precisa de mensagem'
    );
    assert.ok(
      vincularContent.includes('MEMBER_NOT_FOUND') && vincularContent.includes('ALREADY_LINKED_OTHER'),
      'Deve tratar explicitamente casos de membro não encontrado e já vinculado a outra conta'
    );
  });

  // N — compatibilidade de templates Supabase para 1º acesso (Confirm signup) e logins posteriores (Magic Link)
  it('N — template institucional atende tanto o 1º acesso quanto novos Magic Links pós-logout com ConfirmationURL', () => {
    const templateContent = fs.readFileSync(path.resolve('docs/email-templates/supabase-magic-link-template.html'), 'utf8');
    assert.ok(
      templateContent.includes('href="{{ .ConfirmationURL }}"'),
      'O botão CTA deve conter exatamente href="{{ .ConfirmationURL }}"'
    );
    assert.ok(
      templateContent.includes('ACESSAR MEU PORTAL'),
      'O botão de acesso deve estar presente para ambos os templates'
    );
  });
});
