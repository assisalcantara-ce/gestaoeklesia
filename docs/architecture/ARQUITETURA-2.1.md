# Arquitetura 2.1 — Metodologia Oficial de Redução de Monólitos

**Status**: `VALIDADA E PADRONIZADA`  
**Data de Consolidação**: Julho de 2026  
**Sistema**: Gestão Eklésia  

---

## 1. Objetivo

A **Arquitetura 2.1** foi estabelecida como o padrão arquitetural oficial para a refatoração e redução dos módulos monolíticos (arquivos `page.tsx` extensos) do sistema Gestão Eklésia.

### Principais Diretrizes:
- **Redução Agressiva de Monólitos**: Reduzir a complexidade e o número de linhas de código das páginas mantendo **regressão zero**.
- **Preservação de Regras de Negócio**: Não alterar nenhuma regra de negócio, permissão de acesso, endpoint de API ou comportamento visual existente.
- **Manutenibilidade e Legibilidade**: Isolar a camada de apresentação da camada de lógica de aplicação e gerenciamento de estado.
- **Reutilização de Componentes**: Facilitar a manutenção contínua e a realização de testes unitários através da clara separação de responsabilidades.

---

## 2. Estrutura Oficial

A Arquitetura 2.1 estabelece um padrão rígido de três camadas para os módulos do sistema:

```text
               ┌────────────────────────┐
               │        page.tsx        │ (Camada de Composição)
               └───────────┬────────────┘
                           │
                           ▼
               ┌────────────────────────┐
               │      useModulo()       │ (Camada de Lógica & Estado)
               └───────────┬────────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
       ┌───────────┐ ┌───────────┐ ┌───────────┐
       │ Component │ │ Component │ │  Modais   │ (Camada de Apresentação)
       └───────────┘ └───────────┘ └───────────┘
```

### Exemplo de Aplicação:

```text
src/app/tesouraria/page.tsx
       ↓
src/hooks/tesouraria/useTesouraria.ts
       ↓
components/tesouraria/
├── TesourariaToolbar.tsx
├── TesourariaTable.tsx
├── TesourariaFormModal.tsx
└── ConfirmDeleteModal.tsx
```

O mesmo modelo de composição aplica-se de forma padronizada a todos os módulos do Gestão Eklésia (*Membros*, *Congregações*, *Agenda*, etc.).

---

## 3. Fluxo Oficial de Execução

A refatoração de qualquer módulo monolítico deve seguir estritamente as três etapas metodológicas:

### 🔹 Etapa 1: Extração dos Componentes Visuais
- Mover exclusivamente a renderização (JSX) dos grandes blocos visuais para componentes dedicados no diretório `components/<modulo>/`.
- Manter toda a lógica (`useState`, `useEffect`, `useMemo`, handlers e chamadas ao Supabase/APIs) temporariamente dentro da `page.tsx`.
- Validar se a interface gráfica e o comportamento permanecem idênticos.

### 🔹 Etapa 2: Extração da Lógica para Hook Único (`useModulo()`)
- Criar o hook customizado em `hooks/<modulo>/useModulo.ts`.
- Transferir para o hook todos os estados (`useState`), efeitos (`useEffect`), seletores e memoizações (`useMemo`), funções de callback (`useCallback`), integrações com banco/API, CRUD, filtros, paginação, validações de formulário e funções auxiliares.
- Refatorar a `page.tsx` para que consuma unicamente o hook `useModulo()` e passe as propriedades e eventos para os componentes visuais.

### 🔹 Etapa 3: Validação, Verificação e Congelamento
- Executar a checagem rigorosa do TypeScript (`npx tsc --noEmit`).
- Realizar a validação de todos os fluxos funcionais (CRUD, pesquisa, modais, permissões).
- Congelar a versão refatorada e efetuar `git commit` e `git push`.

---

## 4. Regras Obrigatórias

1. **Zero Alteração de Regras de Negócio**: Nenhuma regra de validação, cálculo ou fluxo operacional pode ser modificada durante o processo de refatoração.
2. **Zero Alteração de APIs**: As chamadas de endpoints, tabelas do banco de dados e schemas permanencem inalterados.
3. **Zero Alteração de Permissões**: Manter a checagem de papéis (`roles`), privilégios de escrita e visibilidade por grupo de usuários.
4. **Fidelidade Visual**: O layout, espaçamento, comportamento e estilização gráfica devem permanecer 100% idênticos.
5. **Hook Principal Único**: É expressamente proibido fatiar a lógica em múltiplos hooks secundários sem necessidade justificada. Toda a inteligência do módulo deve estar centralizada em um único `useModulo()`.
6. **Componentes Puramente Declarativos**: Os componentes visuais extraídos em `components/<modulo>/` devem ser focados unicamente na apresentação (prop-driven UI).
7. **`page.tsx` Como Camada de Composição**: A página principal deve funcionar apenas como a orquestradora visual dos componentes e do hook.

---

## 5. Critérios de Aceitação

Para que a refatoração da Arquitetura 2.1 seja aprovada e o módulo seja considerado concluído, ele deve atingir:

- **Build TypeScript Limpo**: 0 erros no comando `npx tsc --noEmit`.
- **Integridade Funcional Total**: Todas as funcionalidades existentes testadas e funcionando.
- **Regressão Zero**: Ausência de bugs visuais ou de execução.
- **Redução Extrema da `page.tsx`**: Tamanho final da página reduzido para o patamar de **400 a 600 linhas** de código.

---

## 6. Checklist de Validação

Checklist padrão obrigatório a ser executado ao concluir cada módulo:

- [x] **Build**: Compilação TypeScript limpa (`0 erros`).
- [x] **CRUD**: Inclusão, leitura, edição e exclusão de registros verificados.
- [x] **Pesquisa**: Busca por palavra-chave funcionando em tempo real ou sob demanda.
- [x] **Filtros**: Filtros rápidos e avançados aplicando os critérios corretamente.
- [x] **Paginação**: Controle de páginas e limite de registros por página funcional.
- [x] **Permissões**: Restrições de escrita/leitura ativas conforme o perfil de acesso.
- [x] **Uploads**: Envio e compressão de imagens/arquivos operacionais (quando aplicável).
- [x] **Consultas Externas (CEP/Geolocalização)**: Integração com APIs externas operando (quando aplicável).
- [x] **Impressões / Exportações PDF**: Geradores de relatórios funcionando sem interrupção (quando aplicável).
- [x] **Responsividade**: Comportamento fluido em telas desktop, tablets e smartphones.
- [x] **Auditoria**: Registro correto de logs de auditoria no sistema.

---

## 7. Métricas de Impacto da Arquitetura 2.1

A aplicação sistemática da Arquitetura 2.1 atingiu os seguintes resultados comprovados nos monólitos refatorados do Gestão Eklésia:

| Módulo | Linhas Iniciais | Linhas Finais | Linhas Removidas | Redução (%) |
| :--- | :---: | :---: | :---: | :---: |
| **Tesouraria** | 4.785 | 438 | 4.347 | **-90,8%** |
| **Membros** | 3.771 | 430 | 3.341 | **-88,6%** |
| **Congregações** | 3.176 | 485 | 2.691 | **-84,7%** |
| **Agenda** | 2.385 | 548 | 1.837 | **-77,0%** |
| **TOTAL** | **14.117** | **1.901** | **12.216** | **-86,5%** |

---

## 8. Declaração de Status

```text
=====================================================
STATUS OFICIAL: VALIDADA E PADRONIZADA
=====================================================
```

A **Arquitetura 2.1** passa a ser reconhecida oficialmente como o padrão arquitetural obrigatório para todas as futuras reduções de monólitos, refatorações e manutenções no ecossistema do **Gestão Eklésia**.
