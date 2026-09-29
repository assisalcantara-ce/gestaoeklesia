export type CertificadoCategoria =
  | 'ministerial'
  | 'consagracao-obreiro'
  | 'apresentacao-criancas'
  | 'batismo-aguas'
  | 'casamento'
  | 'ebd'
  | 'eventos'
  | 'evento';

export const CERTIFICADO_CATEGORIAS: Array<{ value: CertificadoCategoria; label: string }> = [
  { value: 'ministerial', label: 'Ministerial' },
  { value: 'consagracao-obreiro', label: 'Consagração de Obreiro' },
  { value: 'apresentacao-criancas', label: 'Apresentação de Crianças' },
  { value: 'batismo-aguas', label: 'Batismo nas Águas' },
  { value: 'casamento', label: 'Casamento' },
  { value: 'ebd', label: 'EBD — Escola Bíblica Dominical' },
  { value: 'eventos', label: 'Eventos' },
  { value: 'evento', label: 'Eventos & Participação' },
];

export interface CertificadoPlaceholderItem {
  campo: string;
  placeholder: string;
  label: string;
  grupo?: 'PARTICIPANTE' | 'EVENTO' | 'INSTITUCIONAL' | 'CERTIFICADO' | 'GERAL';
}

const EVENTOS_PLACEHOLDERS: CertificadoPlaceholderItem[] = [
  // PARTICIPANTE
  { campo: 'participante_nome',     placeholder: '{{participante_nome}}',     label: 'Nome completo do participante', grupo: 'PARTICIPANTE' },
  
  // EVENTO
  { campo: 'evento_nome',           placeholder: '{{evento_nome}}',           label: 'Nome do evento',                grupo: 'EVENTO' },
  { campo: 'evento_tipo',           placeholder: '{{evento_tipo}}',           label: 'Tipo/categoria do evento',      grupo: 'EVENTO' },
  { campo: 'evento_data',           placeholder: '{{evento_data}}',           label: 'Data do evento',                grupo: 'EVENTO' },
  { campo: 'evento_data_inicio',     placeholder: '{{evento_data_inicio}}',     label: 'Data e horário de início',      grupo: 'EVENTO' },
  { campo: 'evento_data_fim',        placeholder: '{{evento_data_fim}}',        label: 'Data e horário de término',     grupo: 'EVENTO' },
  { campo: 'evento_local',          placeholder: '{{evento_local}}',          label: 'Local do evento',               grupo: 'EVENTO' },
  { campo: 'evento_congregacao',    placeholder: '{{evento_congregacao}}',    label: 'Congregação vinculada',         grupo: 'EVENTO' },
  { campo: 'evento_descricao',      placeholder: '{{evento_descricao}}',      label: 'Descrição do evento',           grupo: 'EVENTO' },
  { campo: 'evento_carga_horaria',   placeholder: '{{evento_carga_horaria}}',   label: 'Carga horária',                 grupo: 'EVENTO' },
  { campo: 'responsavel_evento',    placeholder: '{{responsavel_evento}}',    label: 'Responsável/coordenador',       grupo: 'EVENTO' },

  // INSTITUCIONAL
  { campo: 'ministerio_nome',       placeholder: '{{ministerio_nome}}',       label: 'Nome do ministério/igreja',     grupo: 'INSTITUCIONAL' },
  { campo: 'ministerio_cnpj',       placeholder: '{{ministerio_cnpj}}',       label: 'CNPJ institucional',            grupo: 'INSTITUCIONAL' },
  { campo: 'cidade',                placeholder: '{{cidade}}',                label: 'Cidade',                        grupo: 'INSTITUCIONAL' },
  { campo: 'estado',                placeholder: '{{estado}}',                label: 'UF / Estado',                   grupo: 'INSTITUCIONAL' },

  // CERTIFICADO
  { campo: 'evento_protocolo',      placeholder: '{{evento_protocolo}}',      label: 'Identificador/protocolo',       grupo: 'CERTIFICADO' },
  { campo: 'data_emissao',          placeholder: '{{data_emissao}}',          label: 'Data de emissão do certificado', grupo: 'CERTIFICADO' },
];

const CERTIFICADO_PLACEHOLDERS_POR_CATEGORIA: Record<CertificadoCategoria, CertificadoPlaceholderItem[]> = {
  ministerial: [
    { campo: 'ministro_nome', placeholder: '{ministro_nome}', label: 'Nome do Ministro' },
    { campo: 'matricula', placeholder: '{matricula}', label: 'Matrícula' },
    { campo: 'cargo_ministerial', placeholder: '{cargo_ministerial}', label: 'Cargo Ministerial' },
    { campo: 'congregacao', placeholder: '{congregacao}', label: 'Congregação' },
    { campo: 'data_consagracao', placeholder: '{data_consagracao}', label: 'Data de Consagração' },
    { campo: 'presidente_nome', placeholder: '{presidente_nome}', label: 'Presidente' },
    { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissão' },
    { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' }
  ],
  'apresentacao-criancas': [
    { campo: 'crianca_nome', placeholder: '{crianca_nome}', label: 'Nome da Criança' },
    { campo: 'crianca_data_nascimento', placeholder: '{crianca_data_nascimento}', label: 'Data de Nascimento' },
    { campo: 'crianca_sexo', placeholder: '{crianca_sexo}', label: 'Sexo' },
    { campo: 'pai_nome', placeholder: '{pai_nome}', label: 'Nome do Pai' },
    { campo: 'mae_nome', placeholder: '{mae_nome}', label: 'Nome da Mãe' },
    { campo: 'responsavel_nome', placeholder: '{responsavel_nome}', label: 'Responsável' },
    { campo: 'responsavel_telefone', placeholder: '{responsavel_telefone}', label: 'Telefone do Responsável' },
    { campo: 'data_apresentacao', placeholder: '{data_apresentacao}', label: 'Data da Apresentação' },
    { campo: 'congregacao', placeholder: '{congregacao}', label: 'Congregação do Ato' },
    { campo: 'local_apresentacao', placeholder: '{local_apresentacao}', label: 'Local da Apresentação' },
    { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissão' },
    { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' }
  ],
  'batismo-aguas': [
    { campo: 'candidato_nome', placeholder: '{candidato_nome}', label: 'Nome do Candidato' },
    { campo: 'candidato_data_nascimento', placeholder: '{candidato_data_nascimento}', label: 'Data de Nascimento' },
    { campo: 'candidato_sexo', placeholder: '{candidato_sexo}', label: 'Sexo' },
    { campo: 'data_batismo', placeholder: '{data_batismo}', label: 'Data do Batismo' },
    { campo: 'congregacao', placeholder: '{congregacao}', label: 'Congregação do Ato' },
    { campo: 'local_batismo', placeholder: '{local_batismo}', label: 'Local do Batismo' },
    { campo: 'pastor_nome', placeholder: '{pastor_nome}', label: 'Nome do Pastor' },
    { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissão' },
    { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' },
  ],
  'casamento': [
    { campo: 'conjuge1_nome', placeholder: '{conjuge1_nome}', label: 'Nome do Cônjuge 1' },
    { campo: 'conjuge2_nome', placeholder: '{conjuge2_nome}', label: 'Nome do Cônjuge 2' },
    { campo: 'conjuge1_data_nascimento', placeholder: '{conjuge1_data_nascimento}', label: 'Data de Nascimento (Cônjuge 1)' },
    { campo: 'conjuge2_data_nascimento', placeholder: '{conjuge2_data_nascimento}', label: 'Data de Nascimento (Cônjuge 2)' },
    { campo: 'data_casamento', placeholder: '{data_casamento}', label: 'Data do Casamento' },
    { campo: 'congregacao', placeholder: '{congregacao}', label: 'Congregação do Ato' },
    { campo: 'local_casamento', placeholder: '{local_casamento}', label: 'Local do Casamento' },
    { campo: 'tipo_casamento', placeholder: '{tipo_casamento}', label: 'Tipo de Casamento' },
    { campo: 'pastor_nome', placeholder: '{pastor_nome}', label: 'Pastor Celebrante' },
    { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissão' },
    { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' },
  ],
  'consagracao-obreiro': [
    { campo: 'obreiro_nome',      placeholder: '{obreiro_nome}',      label: 'Nome do Obreiro' },
    { campo: 'cargo',             placeholder: '{cargo}',             label: 'Cargo (Diácono, Presbítero...)' },
    { campo: 'data_consagracao',  placeholder: '{data_consagracao}',  label: 'Data de Consagração' },
    { campo: 'nome_igreja',       placeholder: '{nome_igreja}',       label: 'Nome da Igreja' },
    { campo: 'pastor_nome',       placeholder: '{pastor_nome}',       label: 'Pastor Presidente' },
    { campo: 'data_emissao',      placeholder: '{data_emissao}',      label: 'Data de Emissão' },
  ],
  ebd: [
    { campo: 'aluno_nome',            placeholder: '{aluno_nome}',            label: 'Nome do Aluno' },
    { campo: 'aluno_data_nascimento', placeholder: '{aluno_data_nascimento}', label: 'Data de Nascimento' },
    { campo: 'turma_nome',            placeholder: '{turma_nome}',            label: 'Nome da Turma' },
    { campo: 'classe_nome',           placeholder: '{classe_nome}',           label: 'Nome da Classe' },
    { campo: 'professor_nome',        placeholder: '{professor_nome}',        label: 'Professor Titular' },
    { campo: 'trimestre',             placeholder: '{trimestre}',             label: 'Trimestre' },
    { campo: 'ano',                   placeholder: '{ano}',                   label: 'Ano' },
    { campo: 'responsavel_nome',      placeholder: '{responsavel_nome}',      label: 'Responsável' },
    { campo: 'nome_igreja',           placeholder: '{nome_igreja}',           label: 'Nome da Igreja' },
    { campo: 'data_emissao',          placeholder: '{data_emissao}',          label: 'Data de Emissão' },
  ],
  eventos: EVENTOS_PLACEHOLDERS,
  evento: EVENTOS_PLACEHOLDERS,
};

export const CERTIFICADO_PLACEHOLDERS = CERTIFICADO_PLACEHOLDERS_POR_CATEGORIA.ministerial;

export const getCertificadoPlaceholders = (categoria?: string): CertificadoPlaceholderItem[] => {
  if (!categoria) return CERTIFICADO_PLACEHOLDERS;
  const key = categoria.toLowerCase().trim() as CertificadoCategoria;
  return CERTIFICADO_PLACEHOLDERS_POR_CATEGORIA[key] || CERTIFICADO_PLACEHOLDERS;
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return str;
};

export function substituirPlaceholdersCertificado(
  texto: string,
  dados: Record<string, any>,
  categoria?: string
): string {
  if (!texto) return texto;

  let resultado = texto;
  const today = new Date();
  const dataEmissao = dados.data_emissao || `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  // Normalização de chaves para Eventos e demais categorias
  const base: Record<string, any> = {
    ...dados,
    data_emissao: dataEmissao,
    data_consagracao: formatDate(dados.data_consagracao || dados.data_processo || dados.data_evento || ''),
    // Aliases para Eventos (garantir suporte a ambos os formatos)
    evento_nome: dados.evento_nome || dados.evento_titulo || dados.titulo || '',
    evento_titulo: dados.evento_titulo || dados.evento_nome || dados.titulo || '',
    evento_tipo: dados.evento_tipo || dados.tipo_evento || dados.tipo || '',
    tipo_evento: dados.tipo_evento || dados.evento_tipo || dados.tipo || '',
    evento_data: dados.evento_data || dados.data_evento || dados.data_inicio || '',
    data_evento: dados.data_evento || dados.evento_data || dados.data_inicio || '',
    evento_data_inicio: dados.evento_data_inicio || dados.data_inicio || '',
    evento_data_fim: dados.evento_data_fim || dados.data_fim || '',
    evento_local: dados.evento_local || dados.local_evento || dados.local_nome || dados.local_endereco || '',
    local_evento: dados.local_evento || dados.evento_local || dados.local_nome || '',
    evento_congregacao: dados.evento_congregacao || dados.congregacao || dados.congregacao_nome || '',
    congregacao: dados.congregacao || dados.evento_congregacao || dados.congregacao_nome || '',
    evento_descricao: dados.evento_descricao || dados.descricao || '',
    evento_carga_horaria: dados.evento_carga_horaria || dados.carga_horaria || '',
    carga_horaria: dados.carga_horaria || dados.evento_carga_horaria || '',
    responsavel_evento: dados.responsavel_evento || dados.pastor_nome || dados.responsavel || '',
    ministerio_nome: dados.ministerio_nome || dados.nome_igreja || dados.igreja_nome || '',
    nome_igreja: dados.nome_igreja || dados.ministerio_nome || '',
    ministerio_cnpj: dados.ministerio_cnpj || dados.cnpj || '',
    cidade: dados.cidade || '',
    estado: dados.estado || dados.uf || '',
    evento_protocolo: dados.evento_protocolo || dados.protocolo || dados.inscricao_id || '',
    participante_nome: dados.participante_nome || dados.nome || dados.membro_nome || '',
  };

  const placeholders = getCertificadoPlaceholders(categoria);
  placeholders.forEach((ph) => {
    const rawCampo = ph.campo;
    const valor = String(base[rawCampo] ?? '').toUpperCase();

    // Suporta tanto {{campo}} quanto {campo} de forma flexível e insensível a maiúsculas/minúsculas
    const regexDuplo = new RegExp(`\\{\\{\\s*${rawCampo}\\s*\\}\\}`, 'gi');
    const regexSimples = new RegExp(`\\{\\s*${rawCampo}\\s*\\}`, 'gi');

    resultado = resultado.replace(regexDuplo, valor);
    resultado = resultado.replace(regexSimples, valor);
  });

  return resultado;
}

export function obterPreviewTextoCertificado(texto: string, categoria?: string): string {
  if (!texto) return 'Texto';

  let preview = texto;
  const placeholders = getCertificadoPlaceholders(categoria);
  placeholders.forEach((ph) => {
    const rawCampo = ph.campo;
    const regexDuplo = new RegExp(`\\{\\{\\s*${rawCampo}\\s*\\}\\}`, 'gi');
    const regexSimples = new RegExp(`\\{\\s*${rawCampo}\\s*\\}`, 'gi');
    const tag = `[${ph.label}]`;

    preview = preview.replace(regexDuplo, tag);
    preview = preview.replace(regexSimples, tag);
  });

  return preview;
}
