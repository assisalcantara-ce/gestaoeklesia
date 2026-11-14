export type CelulaStatus = 'em_formacao' | 'ativa' | 'suspensa' | 'encerrada';
export type CelulaModalidade = 'presencial' | 'online' | 'hibrida';
export type CelulaReuniaoStatus = 'planejada' | 'em_andamento' | 'finalizada' | 'cancelada' | 'nao_realizada';
export type CelulaParticipanteTipo = 'membro' | 'congregante' | 'visitante' | 'crianca';
export type CelulaTokenStatus = 'ativo' | 'finalizado' | 'expirado' | 'revogado';

export type CelulaPapelParticipante = 
  | 'lider' 
  | 'vice_lider' 
  | 'anfitriao' 
  | 'lider_em_treinamento' 
  | 'membro' 
  | 'congregante' 
  | 'visitante_regular' 
  | 'crianca';

export type CelulaParticipanteStatus = 'ativo' | 'inativo' | 'transferido' | 'desligado';

export interface CelulaConfiguracao {
  id: string;
  ministry_id: string;
  metodologia: string;
  termo_celula: string;
  termo_lider: string;
  termo_supervisor: string;
  dia_padrao_reuniao: number | null;
  horario_padrao_reuniao: string | null;
  frequencia_obrigatoria: 'flexivel' | 'individual' | 'numerica';
  permite_multiplas_celulas_por_membro: boolean;
  exige_aprovacao_multiplicacao: boolean;
  is_ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CelulaRede {
  id: string;
  ministry_id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  coordenador_member_id: string | null;
  coordenador?: {
    id: string;
    name: string;
  } | null;
  is_ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CelulaItem {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  rede_id: string | null;
  supervisao_id: string | null;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  data_fundacao: string;
  status: CelulaStatus;
  motivo_status: string | null;
  dia_semana: number;
  horario: string;
  modalidade: CelulaModalidade;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  lider_member_id: string | null;
  vice_lider_member_id: string | null;
  anfitriao_member_id: string | null;
  supervisor_member_id: string | null;
  celula_mae_id: string | null;
  created_at: string;
  updated_at: string;

  // Relações em consultas
  congregacao?: { id: string; nome: string } | null;
  rede?: { id: string; nome: string; cor?: string | null } | null;
  lider?: { id: string; name: string; phone?: string | null; celular?: string | null } | null;
  vice_lider?: { id: string; name: string } | null;
  supervisor?: { id: string; name: string } | null;
  anfitriao?: { id: string; name: string } | null;
  celula_mae?: { id: string; nome: string } | null;
}

export interface SalvarCelulaInput {
  id?: string;
  congregacao_id?: string | null;
  rede_id?: string | null;
  supervisao_id?: string | null;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  data_fundacao?: string;
  status?: CelulaStatus;
  motivo_status?: string | null;
  dia_semana: number;
  horario: string;
  modalidade?: CelulaModalidade;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lider_member_id?: string | null;
  vice_lider_member_id?: string | null;
  anfitriao_member_id?: string | null;
  supervisor_member_id?: string | null;
  celula_mae_id?: string | null;
}

// ------------------------------------------------------------------------------
// Lote 2: Reuniões, Frequência e Links Rápidos
// ------------------------------------------------------------------------------

export interface CelulaReuniaoItem {
  id: string;
  ministry_id: string;
  celula_id: string;
  congregacao_id: string | null;
  data_reuniao: string;
  horario_inicio: string;
  horario_termino: string | null;
  modalidade: CelulaModalidade;
  status: CelulaReuniaoStatus;
  motivo_cancelamento: string | null;
  tema_estudo: string | null;
  estudo_id: string | null;
  observacoes: string | null;
  presentes_membros: number;
  presentes_visitantes: number;
  presentes_criancas: number;
  total_presentes: number;
  conversoes_decisoes: number;
  reconciliacoes: number;
  testemunhos: number;
  pedidos_oracao: number;
  valor_oferta: number;
  finalizada_em: string | null;
  finalizada_por: string | null;
  editada_pos_fechamento: boolean;
  justificativa_edicao: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  celula?: { id: string; nome: string; congregacao_id?: string | null } | null;
  congregacao?: { id: string; nome: string } | null;
}

export interface CelulaFrequenciaItem {
  id: string;
  ministry_id: string;
  reuniao_id: string;
  celula_id: string;
  member_id: string | null;
  nome_participante: string;
  tipo_participante: CelulaParticipanteTipo;
  presente: boolean;
  justificativa_ausencia: string | null;
  created_at: string;

  // Joins
  member?: { id: string; name: string; phone?: string | null } | null;
}

export interface CelulaChamadaTokenItem {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  celula_id: string;
  reuniao_id: string | null;
  token_hash: string;
  tipo_acesso: 'frequencia_reuniao' | 'relatorio_rapido';
  status: CelulaTokenStatus;
  expires_at: string;
  finalizado_em: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SalvarReuniaoInput {
  id?: string;
  celula_id: string;
  congregacao_id?: string | null;
  data_reuniao: string;
  horario_inicio?: string;
  horario_termino?: string | null;
  modalidade?: CelulaModalidade;
  status?: CelulaReuniaoStatus;
  motivo_cancelamento?: string | null;
  tema_estudo?: string | null;
  observacoes?: string | null;
  presentes_membros?: number;
  presentes_visitantes?: number;
  presentes_criancas?: number;
  conversoes_decisoes?: number;
  reconciliacoes?: number;
  testemunhos?: number;
  pedidos_oracao?: number;
  valor_oferta?: number;
  justificativa_edicao?: string | null;
  frequencias?: Array<{
    member_id?: string | null;
    nome_participante: string;
    tipo_participante?: CelulaParticipanteTipo;
    presente: boolean;
    justificativa_ausencia?: string | null;
  }>;
}

// ------------------------------------------------------------------------------
// Lote 3: Participantes, Vínculos e Transferências
// ------------------------------------------------------------------------------

export interface CelulaParticipanteItem {
  id: string;
  ministry_id: string;
  celula_id: string;
  congregacao_id: string | null;
  member_id: string | null;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  papel: CelulaPapelParticipante;
  status: CelulaParticipanteStatus;
  data_ingresso: string;
  data_saida: string | null;
  motivo_saida: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  member?: { id: string; name: string; phone?: string | null; email?: string | null } | null;
  celula?: { id: string; nome: string } | null;
  congregacao?: { id: string; nome: string } | null;
}

export interface SalvarParticipanteInput {
  id?: string;
  celula_id: string;
  congregacao_id?: string | null;
  member_id?: string | null;
  nome_completo: string;
  email?: string | null;
  telefone?: string | null;
  papel?: CelulaPapelParticipante;
  status?: CelulaParticipanteStatus;
  data_ingresso?: string;
}

export interface TransferirParticipanteInput {
  participante_id: string;
  celula_destino_id: string;
  motivo?: string | null;
}

export interface CelulaTransferenciaItem {
  id: string;
  ministry_id: string;
  participante_id: string;
  member_id: string | null;
  celula_origem_id: string;
  celula_destino_id: string;
  data_transferencia: string;
  motivo: string | null;
  solicitado_por: string | null;
  created_at: string;

  // Joins
  participante?: { id: string; nome_completo: string } | null;
  celula_origem?: { id: string; nome: string } | null;
  celula_destino?: { id: string; nome: string } | null;
}

// ------------------------------------------------------------------------------
// Lote 4: Estudos Bíblicos, Supervisão Pastoral e Relatórios Consolidados
// ------------------------------------------------------------------------------
export type CelulaEstudoStatus = 'rascunho' | 'em_revisao' | 'aprovado' | 'publicado' | 'arquivado' | 'rejeitado';
export type CelulaSupervisaoTipo = 'visita' | 'reuniao_lideranca' | 'solicitacao_apoio' | 'alinhamento_pastoral';
export type CelulaSupervisaoStatus = 'agendada' | 'realizada' | 'cancelada' | 'nao_realizada';
export type CelulaDiagnosticoSaude = 'saudavel' | 'atencao' | 'critico' | 'em_multiplicacao';

export interface CelulaEstudoItem {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  rede_id: string | null;
  titulo: string;
  tema: string | null;
  serie: string | null;
  numero_licao: number | null;
  referencias_biblicas: string | null;
  objetivo: string | null;
  quebra_gelo: string | null;
  introducao: string | null;
  desenvolvimento: string;
  perguntas_discussao: string | null;
  aplicacao_pratica: string | null;
  conclusao: string | null;
  oracao_final: string | null;
  status: CelulaEstudoStatus;
  versao: number;
  data_publicacao_inicio: string | null;
  data_publicacao_fim: string | null;
  autor_user_id: string | null;
  aprovado_por_user_id: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  congregacao?: { id: string; nome: string } | null;
  rede?: { id: string; nome: string } | null;
}

export interface SalvarEstudoInput {
  id?: string;
  congregacao_id?: string | null;
  rede_id?: string | null;
  titulo: string;
  tema?: string | null;
  serie?: string | null;
  numero_licao?: number | null;
  referencias_biblicas?: string | null;
  objetivo?: string | null;
  quebra_gelo?: string | null;
  introducao?: string | null;
  desenvolvimento: string;
  perguntas_discussao?: string | null;
  aplicacao_pratica?: string | null;
  conclusao?: string | null;
  oracao_final?: string | null;
  status?: CelulaEstudoStatus;
  data_publicacao_inicio?: string | null;
  data_publicacao_fim?: string | null;
}

export interface CelulaSupervisaoItem {
  id: string;
  ministry_id: string;
  celula_id: string;
  congregacao_id: string | null;
  supervisor_member_id: string | null;
  tipo: CelulaSupervisaoTipo;
  status: CelulaSupervisaoStatus;
  data_agendada: string;
  data_realizada: string | null;
  diagnostico_saude: CelulaDiagnosticoSaude;
  observacoes_pastorais: string | null;
  plano_acao: string | null;
  solicitou_apoio_pastoral: boolean;
  detalhe_apoio: string | null;
  registrado_por_user_id: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  celula?: { id: string; nome: string } | null;
  congregacao?: { id: string; nome: string } | null;
  supervisor?: { id: string; name: string } | null;
}

export interface SalvarSupervisaoInput {
  id?: string;
  celula_id: string;
  congregacao_id?: string | null;
  supervisor_member_id?: string | null;
  tipo?: CelulaSupervisaoTipo;
  status?: CelulaSupervisaoStatus;
  data_agendada: string;
  data_realizada?: string | null;
  diagnostico_saude?: CelulaDiagnosticoSaude;
  observacoes_pastorais?: string | null;
  plano_acao?: string | null;
  solicitou_apoio_pastoral?: boolean;
  detalhe_apoio?: string | null;
}

export interface CelulaConsolidadoRelatorio {
  total_celulas: number;
  celulas_ativas: number;
  total_participantes: number;
  participantes_ativos: number;
  lideres_ativos: number;
  reunioes_mes: number;
  media_presenca_reuniao: number;
  total_visitantes_mes: number;
  supervisoes_pendentes: number;
  solicitacoes_apoio_abertas: number;
}

// ------------------------------------------------------------------------------
// Lote 5: Multiplicação Assistida e Genealogia
// ------------------------------------------------------------------------------
export type CelulaMultiplicacaoStatus = 'solicitada' | 'em_avaliacao' | 'aprovada' | 'efetivada' | 'rejeitada' | 'cancelada';

export interface CelulaMultiplicacaoParticipanteItem {
  id: string;
  ministry_id: string;
  multiplicacao_id: string;
  participante_id: string;
  papel_planejado: CelulaPapelParticipante;
  transferido_efetivo: boolean;
  created_at: string;

  // Joins
  participante?: {
    id: string;
    nome_completo: string;
    papel: CelulaPapelParticipante;
    member?: { id: string; name: string } | null;
  } | null;
}

export interface CelulaMultiplicacaoItem {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  celula_origem_id: string;
  celula_filha_id: string | null;
  nome_nova_celula: string;
  novo_lider_member_id: string | null;
  novo_vice_lider_member_id: string | null;
  novo_anfitriao_member_id: string | null;
  dia_reuniao: number | null;
  horario_reuniao: string | null;
  endereco_local: string | null;
  status: CelulaMultiplicacaoStatus;
  data_planejada: string | null;
  data_efetivacao: string | null;
  motivo_planejamento: string | null;
  justificativa_aprovacao: string | null;
  motivo_rejeicao: string | null;
  solicitado_por_user_id: string | null;
  avaliado_por_user_id: string | null;
  efetivado_por_user_id: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  celula_origem?: { id: string; nome: string } | null;
  celula_filha?: { id: string; nome: string } | null;
  novo_lider?: { id: string; name: string } | null;
  novo_vice_lider?: { id: string; name: string } | null;
  congregacao?: { id: string; nome: string } | null;
  participantes?: CelulaMultiplicacaoParticipanteItem[];
}

export interface SolicitarMultiplicacaoInput {
  celula_origem_id: string;
  congregacao_id?: string | null;
  nome_nova_celula: string;
  novo_lider_member_id?: string | null;
  novo_vice_lider_member_id?: string | null;
  novo_anfitriao_member_id?: string | null;
  dia_reuniao?: number | null;
  horario_reuniao?: string | null;
  endereco_local?: string | null;
  data_planejada?: string | null;
  motivo_planejamento?: string | null;
  participantes?: Array<{
    participante_id: string;
    papel_planejado: CelulaPapelParticipante;
  }>;
}

export interface AvaliarMultiplicacaoInput {
  multiplicacao_id: string;
  acao: 'aprovar' | 'rejeitar' | 'cancelar';
  justificativa?: string | null;
}

export interface EfetivarMultiplicacaoInput {
  multiplicacao_id: string;
}

// ------------------------------------------------------------------------------
// Lote 6: Comunicação Ministerial e Notificações
// ------------------------------------------------------------------------------
export type CelulaComunicadoPublico = 'todos' | 'lideres' | 'supervisores' | 'participantes' | 'anfitrioes';
export type CelulaComunicadoPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type CelulaComunicadoStatus = 'rascunho' | 'publicado' | 'arquivado';
export type CelulaTemplateTipo = 'lembrete_reuniao' | 'boas_vindas' | 'apoio_pastoral' | 'chamada_estudo' | 'comunicado_geral';
export type CelulaCanalMensagem = 'whatsapp_manual' | 'notificacao_app' | 'email' | 'sms';
export type CelulaStatusEnvio = 'preparado' | 'enviado' | 'falha';

export interface CelulaComunicadoItem {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  rede_id: string | null;
  celula_id: string | null;
  publico_alvo: CelulaComunicadoPublico;
  titulo: string;
  conteudo: string;
  prioridade: CelulaComunicadoPrioridade;
  status: CelulaComunicadoStatus;
  data_expiracao: string | null;
  autor_user_id: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  congregacao?: { id: string; nome: string } | null;
  rede?: { id: string; nome: string } | null;
  celula?: { id: string; nome: string } | null;
}

export interface SalvarComunicadoInput {
  id?: string;
  congregacao_id?: string | null;
  rede_id?: string | null;
  celula_id?: string | null;
  publico_alvo?: CelulaComunicadoPublico;
  titulo: string;
  conteudo: string;
  prioridade?: CelulaComunicadoPrioridade;
  status?: CelulaComunicadoStatus;
  data_expiracao?: string | null;
}

export interface CelulaTemplateMensagemItem {
  id: string;
  ministry_id: string;
  tipo: CelulaTemplateTipo;
  titulo: string;
  corpo_texto: string;
  variaveis_disponiveis: string[] | null;
  is_ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalvarTemplateInput {
  id?: string;
  tipo: CelulaTemplateTipo;
  titulo: string;
  corpo_texto: string;
  variaveis_disponiveis?: string[];
  is_ativo?: boolean;
}

export interface CelulaMensagemLogItem {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  celula_id: string | null;
  canal: CelulaCanalMensagem;
  destinatario_nome: string;
  destinatario_contato: string | null;
  conteudo_enviado: string;
  status_envio: CelulaStatusEnvio;
  enviado_por_user_id: string | null;
  created_at: string;
}

export interface PrepararMensagemWhatsAppInput {
  celula_id: string;
  participante_id: string;
  template_tipo: CelulaTemplateTipo;
  variaveis_adicionais?: Record<string, string>;
}

export interface MensagemWhatsAppPreparada {
  link_whatsapp: string;
  destinatario_nome: string;
  destinatario_telefone: string;
  mensagem: string;
  log_id?: string;
}

// ------------------------------------------------------------------------------
// Lote 7: Inteligência Pastoral, Indicadores e Relatórios Avançados
// ------------------------------------------------------------------------------
export interface CelulaFiltrosInteligencia {
  congregacao_id?: string | null;
  rede_id?: string | null;
  supervisor_member_id?: string | null;
  celula_id?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export interface CelulaAlertaOperacional {
  tipo: 'relatorio_pendente' | 'sem_reuniao_recente' | 'solicitacao_apoio' | 'preparacao_multiplicacao' | 'baixa_frequencia';
  nivel: 'baixo' | 'medio' | 'alto' | 'critico';
  celula_id: string;
  celula_nome: string;
  congregacao_id: string | null;
  mensagem: string;
  data_referencia?: string | null;
}

export interface CelulaSaudeItem {
  celula_id: string;
  celula_nome: string;
  congregacao_id: string | null;
  lider_nome: string | null;
  total_participantes: number;
  media_presenca_ultimas_4_reunioes: number;
  total_visitantes_periodo: number;
  decisoes_periodo: number;
  ultima_reuniao_data: string | null;
  dias_desde_ultima_reuniao: number | null;
  diagnostico_estimado: 'saudavel' | 'atencao' | 'critico' | 'pronta_multiplicar';
}

export interface CelulaEvolucaoPeriodo {
  periodo_mes: string; // YYYY-MM
  reunioes_realizadas: number;
  presencas_acumuladas: number;
  pessoas_unicas_presentes: number;
  visitantes_total: number;
  conversoes_decisoes: number;
  multiplicacoes_efetivadas: number;
}

export interface CelulaInteligenciaPastoralReport {
  periodo: {
    inicio: string;
    fim: string;
    fuso_horario: string;
  };
  escopo: {
    ministry_id: string;
    congregacao_id: string | null;
    rede_id: string | null;
    celula_id: string | null;
  };
  indicadores_gerais: {
    total_celulas: number;
    celulas_ativas: number;
    celulas_em_formacao: number;
    celulas_inativas: number;
    total_membros_vinculados: number;
    participantes_regulares_ativos: number;
    lideres_atuantes: number;
    reunioes_realizadas: number;
    reunioes_canceladas: number;
    presencas_totais_acumuladas: number;
    presencas_unicas_identificadas: number;
    visitantes_totais: number;
    conversoes_decisoes: number;
    reconciliacoes: number;
    multiplicacoes_efetivadas: number;
    supervisoes_realizadas: number;
    solicitacoes_apoio_pendentes: number;
  };
  alertas_operacionais: CelulaAlertaOperacional[];
  saude_celulas: CelulaSaudeItem[];
  serie_temporal: CelulaEvolucaoPeriodo[];
}

// ------------------------------------------------------------------------------
// Lote 8: Assistente de Implantação e Homologação
// ------------------------------------------------------------------------------
export type CelulaEtapaImplantacao = 
  | 'metodologia' 
  | 'organizacao' 
  | 'lideranca' 
  | 'reunioes' 
  | 'funcionalidades_opcionais' 
  | 'revisao';

export interface CelulaStatusImplantacao {
  is_ativo: boolean;
  etapa_atual: CelulaEtapaImplantacao;
  concluido: boolean;
  etapas_status: {
    metodologia: boolean;
    organizacao: boolean;
    lideranca: boolean;
    reunioes: boolean;
    funcionalidades_opcionais: boolean;
    revisao: boolean;
  };
  total_redes: number;
  total_celulas: number;
  total_lideres_designados: number;
  configuracao: CelulaConfiguracao;
}





