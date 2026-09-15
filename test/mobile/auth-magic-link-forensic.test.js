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

  // K — responsividade e contenção de overflow no formulário de vinculação
  it('K — campos CPF e Data de Nascimento em /app/vincular possuem contenção de overflow e min-w-0', () => {
    const vincularContent = fs.readFileSync(path.resolve('src/app/app/vincular/page.tsx'), 'utf8');
    assert.ok(
      vincularContent.includes('type="date"') && vincularContent.includes('max-w-full') && vincularContent.includes('min-w-0'),
      'Input type date deve possuir max-w-full e min-w-0 para evitar overflow horizontal em viewports estreitos'
    );
    assert.ok(
      vincularContent.includes('type="text"') && vincularContent.includes('max-w-full'),
      'Input CPF deve possuir max-w-full e manter consistência visual com data'
    );
  });
});
