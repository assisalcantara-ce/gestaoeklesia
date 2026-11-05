# Gestão Eklésia — Módulo Discipulado

**Documento Técnico e Funcional Consolidado — v1.0**  
**Data:** 05/11/2026  
**Situação:** Planejamento funcional consolidado; execução não autorizada.

> **INSTRUÇÃO AO AGENTE:** Este documento é referência de requisitos aprovados. Não iniciar auditorias, implementação, migrações, alterações de código, commits ou deploys sem autorização expressa. Distinguir decisões funcionais aprovadas de propostas de arquitetura e pontos técnicos ainda dependentes de verificação.

## 1. Finalidade e princípios

Acompanhar o novo convertido desde o acolhimento até a integração formal à membresia, com ensino bíblico, acompanhamento pastoral, avaliação da liderança e atos da Secretaria. O módulo não substitui decisões pastorais, não automatiza a membresia e não cria cadastro paralelo de pessoas.

Objetivos: organizar as 26 lições CPAD; oferecer ensino individual e turmas; gerir equipe autorizada; registrar frequência, reposições e progresso; acompanhar contatos e visitas; emitir certificado pedagógico; encaminhar avaliação pastoral e Secretaria; oferecer comunicação e gestão consolidada.

## 2. Decisões funcionais aprovadas

| Tema | Definição vinculante |
|---|---|
| Currículo | CPAD Discipulado 1 e 2, 13 lições por volume, 26 no total |
| Duração | Referência de uma lição por semana (~6 meses), sem prazo máximo obrigatório |
| Ensino | Discipulado individual e turmas, configuráveis |
| Equipe | Discipuladores e professores autorizados pela liderança |
| Turmas | Locais e intercongregacionais dentro do mesmo ministério |
| Progressão | Flexível; todas as pendências devem ser repostas para conclusão |
| Pastoral | Acompanhamento completo e configurável, com confidencialidade |
| Avaliação final | Exclusiva da liderança pastoral autorizada |
| Encerramento bem-sucedido | Somente após ato eclesiástico registrado e membresia confirmada pela Secretaria |
| Certificado | Após validação das 26 lições, independentemente de batismo e membresia |
| Comunicação | Interna, lembretes, notificações e WhatsApp opcional |
| Gestão | Dashboard completo, relatórios e filtros com proteção de dados |
| Implantação | Gradual e assistida, com piloto e homologação |
| Liberação | Disponível após homologação; ativação por ministério e progressiva por congregação |

## 3. Integração com Secretaria e Acolhimento

- A fonte oficial de pessoas é `public.members`, com identificação por `member_id` e isolamento por `ministry_id`.
- Novos convertidos podem ser cadastrados como `tipo_cadastro='congregado'`. Nunca rebaixar automaticamente pessoas já classificadas como `membro` ou `ministro`.
- Visitantes existentes em `public.culto_visitantes` poderão ser convertidos para o cadastro oficial preservando histórico e vínculos de conversão (`converted_to_member_id`, `converted_at`, quando aplicáveis).
- Não duplicar pessoa ao abrir uma jornada; utilizar cadastro existente quando identificado.
- Conclusão das lições, certificado e aprovação pastoral **não** alteram automaticamente o status eclesiástico.
- A Secretaria registra os atos e confirma a membresia. O Discipulado apenas acompanha essa confirmação.
- A jornada só poderá ser encerrada com sucesso quando o ato eclesiástico pertinente e a confirmação de integração como membro estiverem vinculados à mesma pessoa.

## 4. Jornada do discípulo

Fluxo principal: **novo convertido → jornada iniciada → formação em andamento → 26 lições validadas → avaliação pastoral → aguardando Secretaria → ato e membresia confirmados → jornada concluída**.

A avaliação pastoral pode resultar em **aprovado**, **necessita acompanhamento adicional** ou **não aprovado neste momento**. Nos dois últimos casos a jornada permanece aberta, com histórico preservado. O certificado pedagógico não depende da decisão pastoral.

Prever pausas, desistências, transferências, falecimento e encerramentos excepcionais autorizados, todos com justificativa e trilha de auditoria. Esses encerramentos não contam como conclusão bem-sucedida nem integração à membresia.

## 5. Currículo e progresso pedagógico

- Volume 1: 13 lições; volume 2: 13 lições; 26 conclusões individuais exigidas.
- Aulas e progresso individual são conceitos separados: presença não implica automaticamente lição validada; ausência não equivale a lição permanentemente perdida.
- Estados pedagógicos propostos: não iniciada, agendada, pendente, concluída, concluída por reposição.
- Permitir que o aluno assista a lições posteriores mesmo com pendências anteriores.
- Reposição individual, coletiva ou em outra turma autorizada do mesmo ministério, sem transferência automática da matrícula principal.
- Não contabilizar duas vezes a conclusão da mesma lição na mesma jornada.
- Aulas canceladas não geram falta para os alunos.
- Registrar lição, data, responsável, modalidade, frequência, resultado e eventuais correções auditáveis.
- Os títulos oficiais e a edição CPAD deverão ser conferidos na fase técnica. Não reproduzir integralmente conteúdo protegido por direitos autorais sem autorização.

## 6. Equipe e permissões

- Liderança pastoral: autoriza discipuladores/professores, supervisiona e decide avaliação final.
- Coordenação: gerencia turmas, atribuições, matrículas, progresso e validação pedagógica.
- Discipulador: acompanha discípulos atribuídos, registra atividades autorizadas e solicita avaliação.
- Professor: ministra aulas e registra frequência das turmas atribuídas.
- Secretaria: mantém cadastro oficial, registra atos e confirma integração à membresia.
- Administrador do ministério: configura e ativa funcionalidades conforme RBAC.

Autorização pastoral de uma pessoa vinculada a `members` não significa que ela possua login no ERP. Atribuições, usuários autenticados e permissões devem ser tratados separadamente. Revogações preservam o histórico. Restringir acessos por ministério, congregação e atribuição, sem ampliar permissões indevidamente em turmas intercongregacionais.

## 7. Turmas e matrículas

Cada turma: nome, modalidade, congregação anfitriã, professor, auxiliares, horários, local, capacidade, início e status. Permitir turmas locais e intercongregacionais autorizadas, sempre no mesmo tenant. Preservar a congregação de origem do discípulo, mesmo que estude em outra congregação. Mudanças de turma e modalidade não apagam aulas, frequência, progresso ou acompanhamento. Relatórios distinguem origem do discípulo e local da turma para evitar contagens duplicadas.

## 8. Acompanhamento pastoral

Ficha individual: identificação, responsáveis, aulas, progresso, contatos, visitas, participação congregacional, necessidades, alertas, encaminhamentos, avaliação e situação na Secretaria.

- Dados operacionais: acessíveis somente a responsáveis autorizados.
- Notas pastorais restritas: segregadas, com acesso específico, auditável e minimização de dados.
- Relatórios e notificações comuns não expõem notas confidenciais.
- Alertas de faltas, falta de contato e pendências são administrativos, nunca pontuações de espiritualidade.
- Observar LGPD, retenção adequada e mínimo necessário de dados pessoais.

## 9. Avaliação pastoral e encerramento

Somente após as 26 lições validadas a coordenação/discipulador poderá encaminhar solicitação de avaliação final. A decisão compete exclusivamente à liderança autorizada. Registrar autor, data, decisão, justificativa restrita e reavaliações. A aprovação encaminha à Secretaria; não altera cadastro automaticamente. Encerramento bem-sucedido exige verificação do ato eclesiástico e confirmação da membresia no registro oficial da mesma pessoa. Não confundir aprovação, conclusão pedagógica e integração eclesiástica.

## 10. Certificados

Certificado de conclusão **pedagógica**, em PDF A4, após validação das 26 lições, independentemente de batismo, aprovação pastoral ou membresia. Conteúdo: identidade visual do ministério, nome do discípulo, congregação, currículo, data, responsáveis autorizados, código único e QR de autenticidade. Prever segunda via, retificação, cancelamento e auditoria. Consulta pública de autenticidade com exposição mínima de dados; não divulgar CPF, contato, endereço ou dados pastorais. Não apresentar a CPAD como emissora sem autorização.

## 11. Comunicação

Central de comunicação com avisos internos, lembretes de aula, alterações, reposições, acompanhamento, avaliação, certificado e pendências da Secretaria. Destinatários e eventos condicionados às permissões e preferências. WhatsApp é opcional, pode usar contato manual e, futuramente, integração oficial autorizada; não pressupor provedor existente. Registrar estado real dos envios; não afirmar entrega sem confirmação. Respeitar base legal, consentimento quando aplicável, revogação, opt-out, horários e regras do provedor. Nunca incluir informações pastorais restritas em mensagens externas.

## 12. Dashboard e relatórios

Visões por ministério, congregação e discipulador; filtros por período, turma, origem, responsável, volume, lição e estado da jornada. Indicadores: discípulos, turmas, frequência, reposições, progresso, contatos, avaliações, certificados, pendências da Secretaria e integrações à membresia. Relatórios gerais, por congregação, turma, discipulador, formação CPAD, encaminhamentos e certificados. Consultas detalhadas e exportações obedecem ao mesmo controle de acesso. Diferenciar certificado pedagógico de jornada encerrada; evitar duplicação em agregações intercongregacionais.

## 13. Arquitetura-alvo (proposta; não auditada)

Stack conhecida do Gestão Eklésia: Next.js/React/Tailwind, Supabase com RLS e Vercel. Reutilizar estruturas existentes quando apropriado; não presumir que novos objetos já existam. Domínios lógicos: pessoas, jornadas, equipe, turmas, matrículas, encontros, frequência, lições, contatos, avaliações, certificados, comunicação, configurações e ativações. **Esses domínios não constituem autorização para criar tabelas.**

Requisitos não funcionais: isolamento real por `ministry_id`, RLS, validação de autorização no servidor, escopo por congregação, integridade referencial, transições consistentes, idempotência, histórico auditável, proteção de dados pastorais e endpoints públicos de certificados com acesso mínimo.

### Contexto de implementação existente

A Fase 1 do Discipulado já havia sido implementada e disponibilizada anteriormente, com menu **Acolhimento → Discipulado**, dashboard, listagem, inclusão de novo convertido e estruturas `discipulado_jornadas`, `discipulado_contatos` e `iniciar_jornada_discipulado_rpc`. **Este documento não confirma o estado atual desses recursos, não os audita e não autoriza alterá-los.** A implementação futura deverá considerar sua compatibilidade e preservar a produção.

## 14. Regras de negócio essenciais

- **RN-01:** Cadastro único; sem duplicar pessoas.
- **RN-02:** Cada lição é concluída uma vez por jornada.
- **RN-03:** Pendências não bloqueiam aulas seguintes.
- **RN-04:** Conclusão pedagógica exige as 26 lições.
- **RN-05:** Somente equipe autorizada atua nos papéis correspondentes.
- **RN-06:** Turmas intercongregacionais não atravessam tenants.
- **RN-07:** Origem congregacional preservada.
- **RN-08:** Certificado após formação, sem depender de batismo.
- **RN-09:** Avaliação final exclusiva da liderança pastoral.
- **RN-10:** Formação concluída não altera membresia.
- **RN-11:** Encerramento bem-sucedido depende de ato e membresia confirmados pela Secretaria.
- **RN-12:** Dados pastorais restritos não entram em relatórios gerais.
- **RN-13:** Comunicação externa sujeita a permissões, preferências e regras aplicáveis.
- **RN-14:** Ativação por ministério e progressiva por congregação.
- **RN-15:** Suspensão e transferência preservam histórico.
- **RN-16:** Encerramentos excepcionais não são contados como integrações.

## 15. Implantação e liberação

1. Preparar configurações por ministério e equipe autorizada.
2. Cadastrar turmas e jornadas existentes, com validação individual de lições anteriores; não presumir conclusão de lições só pela posição atual da turma.
3. Ativar congregação piloto.
4. Homologar segurança, integridade, progressão, pastoral, certificados, comunicação e Secretaria.
5. Expandir gradualmente por congregação.
6. Após homologação geral, tornar o módulo disponível a ministérios elegíveis, com ativação voluntária assistida e progressiva.

Estados administrativos sugeridos: não disponível, disponível, em configuração, piloto, ativo, suspenso. Suspensão não exclui históricos. Elegibilidade comercial respeita os planos existentes, a confirmar antes da execução.

## 16. Critérios de aceite para homologação futura

- [ ] Cadastro único e integração correta com Acolhimento/Secretaria.
- [ ] Isolamento multi-tenant e permissões por congregação.
- [ ] Autorização de equipe e revogação sem perda histórica.
- [ ] Turmas locais/intercongregacionais e mudança de turma.
- [ ] Registro das 26 lições, faltas e reposições.
- [ ] Progressão flexível sem duplicar conclusão.
- [ ] Proteção de registros pastorais restritos.
- [ ] Avaliação final somente pela liderança.
- [ ] Certificado pedagógico com autenticidade e privacidade.
- [ ] Encerramento apenas após confirmação da Secretaria.
- [ ] Comunicação autorizada e estados reais de envio.
- [ ] Dashboard e exportações consistentes e autorizados.
- [ ] Ativação assistida, piloto e expansão progressiva.
- [ ] Ausência de pendências críticas de segurança e integridade antes da liberação geral.

## 17. Pontos a verificar somente quando houver autorização

Compatibilidade das estruturas existentes; mecanismo real de atos e membresia na Secretaria; papéis/RBAC e usuários; títulos/edição CPAD; identidade visual e assinaturas dos certificados; provedor WhatsApp; regras comerciais; validação de históricos de turmas em andamento; desenho físico de dados e APIs. Não resolver esses pontos por suposição nem alterar a aplicação agora.

## 18. Estado e limites

**Decisões funcionais: consolidadas.**  
**Arquitetura física e integrações: propostas, dependentes de validação futura.**  
**Auditoria, implementação, migrações, commits e deploys: não autorizados por este documento.**

Qualquer execução exige instrução posterior e explícita do responsável pelo projeto.
