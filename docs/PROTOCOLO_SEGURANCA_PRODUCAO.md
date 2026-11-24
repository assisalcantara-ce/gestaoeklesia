# PROTOCOLO PERMANENTE DE SEGURANÇA E PROTEÇÃO DA PRODUÇÃO
## Gestão Eklésia — Plataforma de Gestão Eclesiástica e Financeira Multi-Tenant

**Status:** VIGENTE E OBRIGATÓRIO (Em vigor desde 24 de novembro de 2026)  
**Escopo:** Todos os módulos, integrações, APIs, bancos de dados e tarefas de engenharia no Gestão Eklésia.  
**Princípio Maior:** A estabilidade da plataforma e a integridade financeira dos assinantes prevalecem sobre qualquer demanda ou alteração técnica.

---

### 1. Invariantes Operacionais Inegociáveis

1. **Continuidade de Serviços Financeiros:**
   - O Gestão Eklésia opera com múltiplos tenants online simultâneos, realizando lançamentos, gerando cobranças e recebendo pagamentos PIX/cartão em tempo real.
   - Nenhuma intervenção técnica pode interromper, degradar ou bloquear a recepção de webhooks ASAAS, o processamento de transações ou as conciliações financeiras.

2. **Integridade Absoluta dos Dados Reais:**
   - É terminantemente proibido alterar, excluir, sobrescrever ou duplicar registros financeiros ou cadastrais de qualquer ministério ativo.
   - Nenhuma migração ou mutação destrutiva pode ser executada sem auditoria prévia, cópia de segurança e autorização formal.

3. **Isolamento Estrito Multi-Tenant:**
   - Todos os acessos a dados devem ser rigorosamente escopados por `ministry_id`.
   - Nenhuma consulta ou mutação pode vazar, consolidar ou expor dados entre diferentes igrejas ou ministérios.

4. **Diretrizes para Consultas em Produção:**
   - Consultas em produção devem ser executadas **estritamente em modo somente leitura**.
   - As consultas devem ser de escopo delimitado, indexadas e de baixo impacto computacional, sem locks na tabela.
   - É proibido realizar testes de carga, estresse, escrita ou concorrência contra o banco de dados de produção.

5. **Testes de Engenharia:**
   - Testes de concorrência, inserção em lote, paginação pesada, estornos ou falhas devem utilizar **dados sintéticos** em memória ou ambientes isolados.

6. **Governança de Migrações e RLS:**
   - Nenhuma alteração em Row Level Security (RLS) ou migração estrutural (`supabase/migrations`) pode ser aplicada sem validação prévia de impacto e autorização expressa.

7. **Estratégia Obrigatória de Publicação e Rollback:**
   - Toda publicação deve ser controlada, conter apenas os arquivos do escopo aprovado e possuir plano claro e imediato de rollback em caso de anomalia.

8. **Interrupção Preventiva de Emergência:**
   - Caso qualquer implementação apresente risco operacional, a equipe deve interromper imediatamente o procedimento e reportar a alternativa mais segura.

---
*Este documento é de leitura e observância obrigatória para todos os agentes, desenvolvedores e mantenedores do Gestão Eklésia.*
