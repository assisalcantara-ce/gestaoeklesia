# ESPECIFICAÇÃO FUNCIONAL E TÉCNICA
## Módulo Células — Gestão Eklésia

**Documento:** GET-CEL-001  
**Versão:** 1.0 — Planejamento consolidado  
**Data:** 05/11/2026  
**Produto:** Gestão Eklésia  
**Responsável pelo produto:** Alcântara Sistemas  
**Estado:** Especificação de referência, pendente de auditoria técnica  
**Autorização de implementação:** Não concedida

> **Instrução ao agente:** este documento é referência de requisitos aprovados e propostas conceituais. Não presume que tabelas, APIs ou integrações já existam. Antes de qualquer implementação, verificar evidências no repositório e no banco. A existência deste arquivo não autoriza auditoria, alterações, migrations, commits, push ou deploy.

---

## 1. VISÃO EXECUTIVA

O módulo Células será uma solução de gestão ministerial para pequenos grupos cristãos, integrada à plataforma Gestão Eklésia. Apoiará a organização de células, reuniões, frequência, estudos bíblicos, visitantes, discipulado, liderança, supervisão pastoral, comunicação e multiplicação.

Deverá atender tanto igrejas que utilizam pequenos grupos simples quanto ministérios com estruturas celulares complexas. A metodologia será configurável por ministério, sem impor um modelo denominacional único.

### 1.1 Objetivos

- Centralizar a administração de células.
- Facilitar a operação cotidiana dos líderes.
- Integrar visitantes e membros aos módulos existentes.
- Fortalecer o acompanhamento pastoral e a formação de líderes.
- Registrar e acompanhar multiplicações.
- Produzir indicadores ministeriais confiáveis.
- Preservar segurança, privacidade, integridade histórica e isolamento entre clientes.

### 1.2 Princípios

Simplicidade operacional, flexibilidade ministerial, integração com a plataforma existente, privacidade por padrão, rastreabilidade e preservação histórica. A tecnologia apoia decisões pastorais, não as substitui.

### 1.3 Fora do escopo

Não criar sistemas paralelos de cadastro de membros, visitantes, gestão financeira ou discipulado. Não realizar avaliação automatizada de espiritualidade, promoção automática de líderes ou multiplicação automática de células.

---

## 2. DECISÕES FUNCIONAIS APROVADAS

| Código | Requisito | Decisão |
|---|---|---|
| RF-001 | Metodologia | Flexível e configurável por ministério |
| RF-002 | Acesso | Autenticado e links temporários restritos |
| RF-003 | Organização | Estrutura eclesiástica e redes ministeriais |
| RF-004 | Frequência | Numérica ou individual |
| RF-005 | Estudos | Oficiais e próprios, mediante autorização |
| RF-006 | Multiplicação | Assistida, configurável e com aprovação opcional |
| RF-007 | Visitantes | Integrados ao Acolhimento e Discipulado |
| RF-008 | Supervisão | Pastoral completa e configurável |
| RF-009 | Comunicação | Interna, lembretes e WhatsApp opcional |
| RF-010 | Inteligência | Painel pastoral completo e configurável |
| RF-011 | Implantação | Gradual e assistida |
| RF-012 | Disponibilização | Geral após homologação integral |

Estas decisões são requisitos aprovados de produto; os detalhes de implementação dependem de auditoria técnica.

---

## 3. ORGANIZAÇÃO MINISTERIAL

### 3.1 Vínculo eclesiástico

Cada célula pertencerá a um único ministério (`ministry_id`) e terá vínculo com uma unidade eclesiástica válida, respeitando as divisões organizacionais existentes e configuráveis do Gestão Eklésia (congregação, setor, supervisão ou outras nomenclaturas).

### 3.2 Redes ministeriais

As células poderão integrar redes de jovens, famílias, casais, homens, mulheres, evangelismo ou outras. Uma rede poderá abranger congregações distintas do **mesmo** ministério. A proposta inicial é uma rede principal opcional por célula; redes secundárias dependerão de validação futura.

### 3.3 Integridade

Uma célula nunca poderá pertencer a dois ministérios. Vínculos com redes, supervisores, unidades e líderes deverão respeitar o mesmo ministério e os escopos de autorização. A dupla visualização por unidade e rede não poderá duplicar células em consolidados.

---

## 4. CADASTRO E CICLO DE VIDA DAS CÉLULAS

### 4.1 Campos conceituais

Identificador interno, código amigável, nome, descrição, ministério, unidade eclesiástica, rede principal opcional, data de fundação, situação, líder, auxiliar, supervisor, anfitrião opcional, local/modalidade de reunião, dia, horário, periodicidade, histórico de liderança e referência à célula de origem quando aplicável.

### 4.2 Situações

Em formação, ativa, suspensa e encerrada. Encerramento preserva reuniões, presenças, relatórios, vínculos e genealogia. Mudanças de unidade, rede, liderança e supervisão devem preservar vigência histórica para análises retrospectivas.

### 4.3 Exclusão

Não permitir exclusão destrutiva de células com histórico operacional. Correções cadastrais deverão respeitar autorização, auditoria e integridade referencial.

---

## 5. PARTICIPANTES E IDENTIDADE

### 5.1 Categorias

Membros, congregantes, visitantes, participantes regulares externos e pessoas em formação para liderança. A condição eclesiástica não se confunde com a situação de participação na célula.

### 5.2 Identidade compartilhada

A fonte de identidade deverá ser definida após auditoria real de Secretaria e Acolhimento. Não duplicar pessoas para representar participação em células. Possíveis correspondências cadastrais exigem confirmação adequada antes de vincular ou criar registros.

### 5.3 Vínculos

Proposta: uma célula principal ativa por pessoa no ministério, preservando visitas a outras células e histórico de transferências. Eventual flexibilização deverá ser justificada e não comprometer indicadores.

### 5.4 Participação anônima

Presenças anônimas podem ser contabilizadas sem criar identidades fictícias. Dados numéricos não permitem inferir pessoas únicas.

---

## 6. REUNIÕES E FREQUÊNCIA

### 6.1 Ciclo de vida

Planejada, em andamento, finalizada, cancelada ou não realizada. Somente reuniões válidas compõem indicadores de atividades realizadas.

### 6.2 Frequência numérica

Registro de total de presentes e subconjunto de visitantes. Não permite determinar pessoas únicas, retorno individual ou retenção com precisão.

### 6.3 Frequência individual

Registro nominal de participantes presentes, inclusive visitantes identificados; totais calculados a partir dos registros válidos.

### 6.4 Preservação histórica

Cada reunião armazena a modalidade efetivamente utilizada. Mudanças de configuração não reescrevem dados anteriores.

### 6.5 Finalização e correções

Finalização bloqueia edições comuns. Correções posteriores exigem permissão específica, justificativa, histórico e recomputação segura dos indicadores derivados.

### 6.6 Indicadores complementares

Podem ser configurados evangelização, reconciliação, visitas, estudos e outros indicadores compatíveis. Definir fonte de verdade e deduplicação com Relatório Espiritual antes da implementação.

---

## 7. LINKS TEMPORÁRIOS

Acesso limitado a operações específicas, como frequência ou relatório de uma célula/reunião.

Requisitos: tokens imprevisíveis, armazenamento somente por hash, expiração, revogação, escopo restrito, validação no servidor, proteção contra repetição/abuso e auditoria. O mecanismo de EBD é referência a verificar, sem pressupor reutilização direta. Links não podem conceder acesso amplo a dados pessoais ou registros pastorais confidenciais.

---

## 8. ESTUDOS BÍBLICOS E MATERIAIS

### 8.1 Modalidades

Estudos oficiais do ministério, oficiais de redes e próprios de líderes autorizados.

### 8.2 Conteúdo

Tema, objetivo, referências bíblicas, introdução, desenvolvimento, perguntas, aplicação, conclusão, orientações e anexos.

### 8.3 Governança

Revisão e aprovação configuráveis. Estados conceituais: rascunho, em revisão, aprovado, publicado, arquivado e rejeitado, conforme o fluxo adotado.

### 8.4 Distribuição

Por ministério, rede, unidade ou células específicas, com séries e períodos de publicação.

### 8.5 Versionamento

Versões publicadas preservadas; cada reunião referencia a versão efetivamente utilizada. Alterações futuras não modificam retrospectivamente estudos históricos.

### 8.6 Arquivos

Anexos com validação de tipo/tamanho, permissões e armazenamento seguro.

---

## 9. ACOLHIMENTO E DISCIPULADO

Células registra participação e pode encaminhar ou consultar processos existentes. Acolhimento mantém sua responsabilidade pelos visitantes e tarefas; Discipulado, pelas jornadas individuais. Jornada conceitual: primeira visita, identificação, acolhimento, integração à célula e eventual discipulado, sem transições obrigatórias ou automáticas.

Líderes acessam somente tarefas e dados pertinentes a seu escopo. Evitar duplicação de pessoas, tarefas e encaminhamentos. Contratos de integração dependem do schema real.

---

## 10. LIDERANÇA E FORMAÇÃO

Papéis ministeriais conceituais: pastor/administrador, coordenador, supervisor, líder, auxiliar e anfitrião, distintos dos perfis globais de autenticação. Formação de líderes com jornadas, requisitos e acompanhamento configuráveis, reutilizando o Discipulado quando possível. Designação e habilitação dependem de decisão humana; nenhuma promoção automática baseada em métricas.

---

## 11. SUPERVISÃO PASTORAL

Cada célula pode ter supervisor principal com histórico de atribuições. Coordenadores acompanham apenas redes/áreas autorizadas.

Funcionalidades: relatórios, visitas, reuniões de acompanhamento, orientações, solicitações de apoio e planos de ação. Visitas podem ser agendadas, realizadas, canceladas ou não realizadas; podem gerar encaminhamentos com responsáveis e prazos.

Registros pastorais sensíveis terão classificação e permissões próprias. Hierarquia não concede acesso irrestrito a informações pessoais. Indicadores são operacionais, sem rankings espirituais automáticos.

---

## 12. MULTIPLICAÇÃO ASSISTIDA

Processo planejado, acompanhado e efetivado mediante autorização conforme regras ministeriais.

Critérios configuráveis: participação, tempo de funcionamento, liderança preparada, local e aprovação; critérios podem ser orientativos ou obrigatórios.

Fluxo: planejamento → avaliação → aprovação quando exigida → efetivação → acompanhamento posterior.

A efetivação cria a nova célula e movimenta vínculos em transação atômica e idempotente. Preservar genealogia sem ciclos e distinguir células pioneiras de multiplicadas. Metas são opcionais e não provocam multiplicação automática.

---

## 13. COMUNICAÇÃO MINISTERIAL

Canais: comunicados internos, notificações, lembretes e WhatsApp opcional. Públicos por ministério, unidade, rede, supervisor, célula ou papel autorizado.

**WhatsApp manual:** preparar mensagem para envio pelo próprio usuário, sem afirmar entrega.

**WhatsApp automatizado:** depende de integração oficial autorizada, credenciais segregadas por ministério, consentimentos/base legal apropriada, templates e regras do provedor; usar filas, idempotência, limites, preferências, descadastramento e controles de horário. Falhas de mensagens não podem impedir registros operacionais.

---

## 14. INTELIGÊNCIA PASTORAL E RELATÓRIOS

### 14.1 Painel

Visão de células, reuniões, participantes, visitantes, liderança, supervisão, formação e multiplicação.

### 14.2 Filtros

Período, unidade eclesiástica, rede, supervisor e célula, sempre respeitando o escopo autorizado e o ministério da sessão.

### 14.3 Métricas

Células ativas, participantes regulares, reuniões realizadas, presenças, visitantes, líderes em formação, solicitações de apoio, multiplicações e relatórios pendentes.

### 14.4 Definições e precisão

Distinguir presenças acumuladas, pessoas únicas identificadas, totais agregados e indicadores indisponíveis por ausência de identificação. Não apresentar estimativas como contagens exatas. Denominadores, datas, fuso horário, cancelamentos e cobertura dos dados devem ser explícitos.

### 14.5 Consolidação

Células presentes nas visões de rede e unidade não serão duplicadas no total ministerial. Relatórios históricos devem considerar vínculos vigentes à época ou indicar explicitamente quando usam a organização atual.

### 14.6 Alertas

Relatórios pendentes, interrupção de atividades, acolhimento em aberto, solicitações de apoio e preparação para multiplicação; somente alertas operacionais.

### 14.7 Exportações

PDF e formatos tabulares com as mesmas restrições de autorização, minimização e auditoria do painel. Informações pastorais confidenciais não devem integrar exportações comuns.

---

## 15. MODELO DE DADOS CONCEITUAL

**Atenção:** nomes abaixo são hipóteses de modelagem, não migrations aprovadas.

| Entidade lógica | Finalidade |
|---|---|
| `cell_settings` | Configurações por ministério |
| `cell_networks` | Redes ministeriais |
| `cells` | Cadastro das células |
| `cell_leadership` | Designações e histórico de liderança |
| `cell_participants` | Vínculos e transferências |
| `cell_meetings` | Reuniões |
| `cell_attendance` | Presenças individuais |
| `cell_meeting_metrics` | Indicadores agregados |
| `cell_access_tokens` | Acessos temporários |
| `cell_studies` | Estudos e metadados |
| `cell_study_versions` | Versões imutáveis publicadas |
| `cell_study_assignments` | Distribuição de estudos |
| `cell_study_attachments` | Anexos de estudos |
| `cell_study_reviews` | Revisões e aprovações |
| `cell_training_paths` | Trilhas de formação, se não houver recurso reutilizável |
| `cell_training_progress` | Progresso de formação, se necessário |
| `cell_supervisor_assignments` | Atribuições de supervisão |
| `cell_supervision_visits` | Visitas |
| `cell_support_requests` | Solicitações de apoio |
| `cell_support_actions` | Encaminhamentos |
| `cell_supervision_plans` | Planos de acompanhamento |
| `cell_supervision_meetings` | Reuniões de supervisão |
| `cell_multiplication_requests` | Planejamento de multiplicação |
| `cell_multiplication_approvals` | Aprovações |
| `cell_multiplication_participants` | Movimentações planejadas |
| `cell_multiplication_events` | Histórico de efetivação |
| `cell_multiplication_goals` | Metas opcionais |
| `cell_announcements` | Comunicados |
| `cell_announcement_targets` | Públicos dos comunicados |
| `cell_notifications` | Notificações |
| `cell_notification_preferences` | Preferências |
| `cell_message_deliveries` | Registro de tentativas de envio |
| `cell_communication_templates` | Modelos de comunicação |
| `cell_audit_logs` | Auditoria específica, se necessária |

Reutilizar tabelas/serviços existentes sempre que viável. Não criar estruturas redundantes para corresponder à nomenclatura proposta.

### 15.1 Integridade

RLS por ministério; FKs e restrições que impeçam vínculos cruzados entre tenants; vigência temporal; transações e idempotência para operações críticas; índices e agregações definidos conforme carga real.

---

## 16. SEGURANÇA E AUTORIZAÇÃO

- Isolamento multi-tenant real por `ministry_id`; multiunidade não substitui multitenancy.
- RLS para leitura e escrita, incluindo caminhos privilegiados e serviços administrativos.
- Autorização no servidor por ministério, unidade, rede, célula, papel e operação.
- Controles específicos para transferências, multiplicações, aprovações, liderança e correções de relatórios.
- Auditoria de ações sensíveis e acessos relevantes.
- LGPD: finalidade, minimização, retenção, segurança e proteção de dados religiosos sensíveis.
- Salvaguardas reforçadas para dados de crianças e adolescentes.
- Tokens de acesso temporário nunca persistidos em texto puro.

---

## 17. IMPLANTAÇÃO GRADUAL E DISPONIBILIZAÇÃO

### 17.1 Assistente inicial

Etapas: metodologia → organização → liderança → reuniões → funcionalidades opcionais → revisão. Permitir salvar rascunho e continuar.

### 17.2 Recursos opcionais

Estudos, acolhimento, supervisão, multiplicação, comunicação e inteligência avançada poderão ser habilitados conforme necessidades e elegibilidade comercial.

### 17.3 Preservação

Desativar funcionalidade não exclui histórico. Separar disponibilidade comercial, ativação ministerial e recursos habilitados.

### 17.4 Liberação

Após homologação integral, disponibilizar o módulo a todos os ministérios **elegíveis**, sem aprovação individual ou piloto obrigatório. Cada ministério decide quando iniciar sua configuração. A liberação geral não implica ativação automática.

---

## 18. INTEGRAÇÕES A VALIDAR

| Módulo existente | Integração esperada |
|---|---|
| Secretaria | Identidade e vínculo de membros |
| Acolhimento | Visitantes e acompanhamento |
| Discipulado | Jornadas individuais e formação |
| Divisões organizacionais | Unidades e hierarquia |
| Agenda | Eventos, quando disponível pelo plano |
| EBD | Referência de padrões técnicos de acesso temporário |
| Relatório Espiritual | Consolidação sem duplicidade |
| Tesouraria | Ofertas opcionais, sem financeiro paralelo |
| Assinaturas | Elegibilidade e recursos por plano |
| Autenticação | Identidade, papéis e permissões |
| Infraestrutura de notificações | Reutilização de serviços, quando existente |

A integração efetiva depende de evidências do schema e serviços reais. O módulo deve operar em seus recursos básicos mesmo quando Agenda ou WhatsApp automatizado não estiverem disponíveis.

---

## 19. REQUISITOS NÃO FUNCIONAIS

**Desempenho:** evitar consultas redundantes; definir paginação, índices, cache e agregações após aferir volume real.

**Disponibilidade:** falhas de integrações opcionais não bloqueiam registro de reuniões/frequência.

**Responsividade:** computador, tablet e celular; fluxo do líder simples e rápido.

**Observabilidade:** logs, rastreamento de operações críticas e diagnósticos sem exposição de dados sensíveis.

**Acessibilidade:** teclado, contraste, rótulos e mensagens compreensíveis.

**Compatibilidade:** nenhuma regressão nos módulos existentes.

---

## 20. FASES FUTURAS PROPOSTAS

| Fase | Entrega | Marco de validação |
|---|---|---|
| 0 | Auditoria técnica exclusivamente de leitura | Diagnóstico e arquitetura aprovados |
| 1 | Fundação: configurações, redes, células, liderança, permissões | Isolamento/RLS e cadastro homologados |
| 2 | Reuniões, frequência, métricas básicas e links temporários | Presenças e relatórios homologados |
| 3 | Participantes, visitantes e integrações | Sem duplicidade cadastral |
| 4 | Estudos, formação e supervisão | Fluxos e permissões homologados |
| 5 | Multiplicação assistida | Transações e histórico homologados |
| 6 | Comunicação e notificações | Canais, consentimentos e segurança homologados |
| 7 | Inteligência pastoral e relatórios | Indicadores reconciliados |
| 8 | Assistente de implantação e homologação final | Regressão e liberação geral aprovadas |

A sequência poderá ser ajustada após auditoria. Cada fase depende de homologação antes da próxima.

---

## 21. CRITÉRIOS DE ACEITAÇÃO

1. Isolamento efetivo entre ministérios.
2. Permissões corretas por papel e escopo.
3. Cadastro e histórico íntegros das células.
4. Frequência numérica e individual sem dupla contagem.
5. Links temporários seguros e revogáveis.
6. Integrações sem duplicação de identidades.
7. Preservação de versões de estudos.
8. Supervisão e registros confidenciais protegidos.
9. Multiplicação atômica, idempotente e com genealogia íntegra.
10. Comunicação externa controlada e opcional.
11. Indicadores reconciliados com suas fontes.
12. Funcionamento responsivo e acessível.
13. Ausência de regressões relevantes.
14. Assistente de implantação funcional.
15. Elegibilidade por plano corretamente aplicada.

A disponibilização geral dependerá da aprovação dos critérios e dos testes adicionais indicados na auditoria.

---

## 22. PENDÊNCIAS DE VALIDAÇÃO TÉCNICA

- Estrutura real de membros e visitantes.
- Integração efetiva com Discipulado.
- Modelagem das divisões organizacionais.
- Infraestrutura de notificações e mensagens.
- Padrões de auditoria e logs.
- Autorização por escopo.
- Integração com Agenda e Tesouraria.
- Compatibilidade com Relatório Espiritual.
- Disponibilidade comercial por plano.
- Storage e processamento assíncrono.
- Necessidade de novas tabelas e migrations.
- Volume esperado e estratégia de desempenho.

Nenhuma pendência autoriza alterações no sistema.

---

## 23. DIRETRIZES PARA A FUTURA AUDITORIA

Somente quando expressamente autorizada, a primeira atividade do Antigravity deverá ser exclusivamente de leitura e diagnóstico. Entregar evidências de código e banco, riscos, dependências, oportunidades de reutilização e recomendações arquiteturais.

**Proibido nessa fase:** alterar arquivos ou dados, executar migrations, criar commits, fazer push/deploy ou implementar funcionalidades. A aprovação do relatório de auditoria será necessária antes de qualquer desenvolvimento.

---

## 24. DECLARAÇÃO DE ESTADO DO PROJETO

O planejamento funcional do módulo Células encontra-se consolidado nesta especificação. A arquitetura é conceitual e depende de auditoria técnica do Gestão Eklésia.

A criação deste documento não autoriza alterações em código-fonte, banco de dados, infraestrutura ou produção.

**Próximo marco previsto:** auditoria técnica de leitura, somente mediante autorização expressa.

**Fim da especificação — Versão 1.0.**
