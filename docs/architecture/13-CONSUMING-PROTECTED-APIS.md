# Guia Arquitetural — Consumindo APIs Protegidas (Multi-Tenant & TenantAuth)

Este documento estabelece o padrão oficial do **Gestão Eklésia** para a realização de chamadas HTTP (especialmente uploads, formulários complexos e integrações `fetch()` diretas) a rotas de API protegidas no backend.

---

## 🎯 Contexto e Problema

No **Gestão Eklésia**, as APIs de backend protegidas utilizam a função `resolveTenantAuth(request)` ([`src/lib/tenant-auth.ts`](file:///c:/BACKUP/DESENVOLVIMENTO/gestaoeklesia/src/lib/tenant-auth.ts)) para resolver o contexto do usuário e validar o tenant (`ministry_id`).

O `resolveTenantAuth()` lê o token JWT do usuário exclusivamente a partir do cabeçalho HTTP:

```http
Authorization: Bearer <access_token>
```

Se um componente React no frontend realizar um `fetch()` direto (por exemplo, ao enviar um `FormData` com anexos ou fotos) **sem passar o cabeçalho `Authorization`**, o servidor não consegue autenticar a sessão do Supabase e retorna imediatamente:

```http
HTTP 401 Unauthorized
```

---

## 🛠️ Padrão Oficial de Implementação Client-Side

Todo componente React, hook ou serviço frontend que realize chamadas HTTP customizadas (via `fetch()` ou `axios`) para endpoints que utilizam `resolveTenantAuth()` deve seguir este protocolo obrigatório:

### 1. Obter a Sessão do Supabase Browser Client

Utilize o helper `createClient()` de `@/lib/supabase-client` para recuperar a sessão atual:

```typescript
import { createClient } from '@/lib/supabase-client';

const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();
```

### 2. Validar a Sessão Antes do Envio

Se `session?.access_token` não existir ou a sessão estiver expirada, interrompa a requisição imediatamente no cliente e alerte o usuário:

```typescript
if (!session?.access_token) {
  // Tratar sessão expirada no cliente (ex: alerta ou redirect)
  throw new Error('Sessão expirada. Por favor, realize o login novamente.');
}
```

### 3. Injetar o Cabeçalho `Authorization` no `fetch()`

Passe o `session.access_token` no objeto `headers`:

```typescript
const res = await fetch('/api/v1/modulo/endpoint', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
  body: formData, // ou JSON.stringify(data)
});
```

> [!NOTE]
> Quando enviar `FormData` (uploads de arquivos), **NÃO** defina manualmente o `Content-Type: multipart/form-data`, pois o navegador precisa gerar automaticamente o `boundary`. Defina apenas o cabeçalho `Authorization`.

---

## 💻 Exemplo de Referência Completo

Exemplo baseado na implementação oficial do módulo de anexos de suporte ([`src/components/common/AttachmentUploader.tsx`](file:///c:/BACKUP/DESENVOLVIMENTO/gestaoeklesia/src/components/common/AttachmentUploader.tsx)):

```typescript
import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';

export function useUploadAttachment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Obter o Supabase client de navegador
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      // 2. Validar token
      if (!session?.access_token) {
        throw new Error('Sessão expirada ou não autenticada. Faça login novamente.');
      }

      // 3. Montar payload
      const formData = new FormData();
      formData.append('file', file);

      // 4. Executar fetch com Authorization Bearer
      const response = await fetch('/api/v1/suporte/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar upload.');
      }

      return data;
    } catch (err: any) {
      setError(err.message || 'Erro inesperado no upload.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { upload, loading, error };
}
```

---

## ⚙️ Alternativas Disponíveis no Projeto

### Para Requisições de Painel Administrativo / Impersonation
Para chamadas de rotas administrativas que utilizam cookies de Impersonation ou contexto global de Admin, utilize o helper [`authenticatedFetch()`](file:///c:/BACKUP/DESENVOLVIMENTO/gestaoeklesia/src/lib/authenticated-fetch.ts), que anexa automaticamente as credenciais necessárias.

---

## ✅ Check-list de Validação para Code Review

Ao criar ou revisar uma nova integração no frontend (Secretaria, Financeiro, Eventos, CRM, EBD, Suporte):

- [ ] O endpoint de API backend utiliza `resolveTenantAuth(request)`?
- [ ] A chamada client-side utiliza `supabase.auth.getSession()` para resgatar o `access_token`?
- [ ] O cabeçalho `Authorization: Bearer <access_token>` está sendo injetado na requisição `fetch()`?
- [ ] Há tratamento visual para o caso de sessão expirada?
- [ ] O `npx tsc --noEmit` executa sem erros?
