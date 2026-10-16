import type { SupabaseClient } from '@supabase/supabase-js';
import type { CartaTemplate, TemplateCategoria, TemplateTipo } from '@/types/supabase';
import { CANVAS_A4 } from './cartas-constants';

export const createSystemTemplate = (
  id: string,
  key: string,
  title: string,
  tipo: TemplateTipo,
  categoria: TemplateCategoria,
  tituloDocumento: string,
  textoDeclaracao: string,
  isDeclaracao = false
): CartaTemplate => ({
  id,
  ministry_id: null,
  template_key: key,
  title,
  tipo,
  categoria,
  scope: 'system',
  is_active: true,
  content_json: {
    mode: 'canvas',
    canvas: {
      width: CANVAS_A4.width,
      height: CANVAS_A4.height,
      backgroundUrl: '',
      elements: [
        {
          x: 45,
          y: 26,
          id: '49a4a289-5962-4b99-8181-40c00858f084',
          cor: '#111827',
          tipo: 'logo',
          fonte: 'Calibri',
          altura: 101,
          locked: false,
          italico: false,
          largura: 92,
          negrito: false,
          visivel: true,
          fontSize: 12,
          imagemUrl: '',
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 142,
          y: 24,
          id: '4cc6787a-9fb7-4628-99a4-72231f43327a',
          cor: '#111827',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: '{{igreja.nome}}',
          altura: 32,
          locked: false,
          italico: false,
          largura: 506,
          negrito: true,
          visivel: true,
          fontSize: 22,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 144,
          y: 54,
          id: 'cabecalho-endereco',
          cor: '#374151',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: '{{igreja.endereco}}',
          altura: 24,
          locked: false,
          italico: false,
          largura: 506,
          negrito: false,
          visivel: true,
          fontSize: 14,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 144,
          y: 75,
          id: 'cabecalho-cnpj',
          cor: '#4B5563',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: 'CNPJ: {{igreja.cnpj}}',
          altura: 22,
          locked: false,
          italico: false,
          largura: 506,
          negrito: false,
          visivel: true,
          fontSize: 13,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 144,
          y: 94,
          id: 'cabecalho-contato',
          cor: '#4B5563',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: 'Tel: {{igreja.telefone}} | E-mail: {{igreja.email}}',
          altura: 22,
          locked: false,
          italico: false,
          largura: 506,
          negrito: false,
          visivel: true,
          fontSize: 13,
          sublinhado: false,
          alinhamento: 'left',
        },
        {
          x: 32,
          y: 263,
          id: '9ef02817-5d45-4078-8819-fcb24c29c58f',
          cor: '#111827',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: textoDeclaracao,
          altura: 520,
          locked: false,
          italico: false,
          largura: 618,
          negrito: false,
          visivel: true,
          fontSize: 22,
          sublinhado: false,
          alinhamento: 'center',
        },
        {
          x: 0,
          y: 144,
          id: '4014e7e1-a741-40b3-a2a1-119e80e5ff67',
          cor: '#150f95',
          tipo: 'linha',
          fonte: 'Calibri',
          texto: '',
          altura: 4,
          locked: false,
          italico: false,
          largura: 700,
          negrito: false,
          visivel: true,
          fontSize: 12,
          sublinhado: false,
          alinhamento: 'left',
          borderRadius: 0,
        },
        {
          x: 0,
          y: 148,
          id: '1787108727534jtjq91qbj',
          cor: '#ff0000',
          tipo: 'linha',
          fonte: 'Calibri',
          texto: '',
          altura: 4,
          locked: false,
          italico: false,
          largura: 700,
          negrito: false,
          visivel: true,
          fontSize: 12,
          sublinhado: false,
          alinhamento: 'left',
          borderRadius: 0,
        },
        {
          x: 100,
          y: 186,
          id: '494afeea-9420-486f-bb71-0889883c29c4',
          cor: '#111827',
          tipo: 'texto',
          fonte: 'Calibri',
          texto: tituloDocumento,
          altura: 48,
          locked: false,
          italico: false,
          largura: 480,
          negrito: true,
          visivel: true,
          fontSize: 24,
          sublinhado: false,
          alinhamento: 'center',
          borderRadius: 0,
        },
        ...(isDeclaracao
          ? []
          : [
              {
                x: 25,
                y: 994,
                id: '17871409999000b6o6qgzt',
                cor: '#111827',
                tipo: 'texto' as const,
                fonte: 'Calibri',
                texto: '<b>DESTINO:</b> {{carta.destino}}',
                altura: 29,
                locked: false,
                italico: false,
                largura: 643,
                negrito: false,
                visivel: true,
                fontSize: 16,
                sublinhado: false,
                alinhamento: 'left' as const,
                borderRadius: 0,
              },
              {
                x: 24,
                y: 1028,
                id: '17871410147888k2nbto2j',
                cor: '#111827',
                tipo: 'texto' as const,
                fonte: 'Calibri',
                texto: '<b>OBS.: </b>{{carta.observacoes}}',
                altura: 29,
                locked: false,
                italico: false,
                largura: 643,
                negrito: false,
                visivel: true,
                fontSize: 16,
                sublinhado: false,
                alinhamento: 'left' as const,
                borderRadius: 0,
              },
            ]),
      ],
    },
  },
});

export const DEFAULT_SYSTEM_TEMPLATES: CartaTemplate[] = [
  // ─── CARTAS MINISTERIAIS ──────────────────────────────────────────────────
  createSystemTemplate(
    'system-mudanca',
    'mudanca',
    'Carta de Mudança',
    'mudanca',
    'carta',
    'CARTA DE MUDANÇA',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nFaz parte desta igreja, como MEMBRO fiel e dedicado.\nPor se achar em comunhão com esta Igreja, nós o recomendamos que o recebais no Senhor como usam fazer os Santos..\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-transito',
    'transito',
    'Carta de Trânsito',
    'transito',
    'carta',
    'CARTA DE TRÂNSITO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nMembro desta igreja, encontra-se em viagem ou trânsito temporário.\nRecomendamos que o recebais em comunhão cristã durante o período de sua permanência.\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-desligamento',
    'desligamento',
    'Carta de Desligamento',
    'desligamento',
    'carta',
    'CARTA DE DESLIGAMENTO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nTeve seu desligamento formalizado a seu pedido do rol de membros desta igreja.\nRegistramos nossos agradecimentos pelo período em que esteve em nossa comunhão.\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),
  createSystemTemplate(
    'system-recomendacao',
    'recomendacao',
    'Carta de Recomendação',
    'recomendacao',
    'carta',
    'CARTA DE RECOMENDAÇÃO',
    'Declaramos para os devidos fins que\n<b>{{membro.nome}}, CPF {{membro.cpf}}</b>\n\nÉ membro em plena comunhão desta igreja e o(a) recomendamos carinhosamente aos irmãos para acolhimento nas atividades cristãs.\n\n<b>Congregação:</b> {{membro.congregacao}} \n<b>Cargo:</b> {{membro.cargo}}\n\nEm fé de verdade, firmamos a presente.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n'
  ),

  // ─── DECLARAÇÕES OFICIAIS ────────────────────────────────────────────────
  createSystemTemplate(
    'system-declaracao-membro-ativo',
    'membro_ativo',
    'Declaração de Membro Ativo',
    'membro_ativo',
    'declaracao',
    'DECLARAÇÃO DE MEMBRO ATIVO',
    'Declaramos para os devidos fins a quem possa interessar que\n<b>{{membro.nome}}</b>, portador(a) do CPF nº <b>{{membro.cpf}}</b>,\né membro ativo(a) e regular do rol de membros desta instituição religiosa,\nencontrando-se em plena comunhão com a comunidade e seus estatutos.\n\n<b>Congregação:</b> {{membro.congregacao}}\n<b>Cargo/Função:</b> {{membro.cargo}}\n\nPor ser expressão da verdade, firmamos a presente declaração.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
  createSystemTemplate(
    'system-declaracao-batismo',
    'batismo',
    'Declaração de Batismo nas Águas',
    'batismo',
    'declaracao',
    'DECLARAÇÃO DE BATISMO NAS ÁGUAS',
    'Certificamos para os devidos fins de direito eclesiástico que\n<b>{{membro.nome}}</b>, portador(a) do CPF nº <b>{{membro.cpf}}</b>,\nprofessou publicamente sua fé em Jesus Cristo e foi batizado(a) nas águas conforme a ordenança bíblica,\npassando a integrar a comunhão do corpo de Cristo nesta Igreja.\n\n<b>Congregação:</b> {{membro.congregacao}}\n\nPor ser verdade, emitimos o presente documento.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
  createSystemTemplate(
    'system-declaracao-cargo',
    'cargo',
    'Declaração de Exercício de Cargo',
    'cargo',
    'declaracao',
    'DECLARAÇÃO DE EXERCÍCIO DE CARGO',
    'Declaramos para os devidos fins ministeriais e civis que\n<b>{{membro.nome}}</b>, portador(a) do CPF nº <b>{{membro.cpf}}</b>,\nexercita oficialmente a função/cargo de <b>{{membro.cargo}}</b>\nno âmbito de <b>{{igreja.nome}}</b>, desenvolvendo suas atividades com zelo e dedicação cristã.\n\n<b>Congregação:</b> {{membro.congregacao}}\n\nFirmamos a presente declaração para que produza os efeitos necessários.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
  createSystemTemplate(
    'system-declaracao-apresentacao',
    'apresentacao_crianca',
    'Declaração de Apresentação de Criança',
    'apresentacao_crianca',
    'declaracao',
    'DECLARAÇÃO DE APRESENTAÇÃO DE CRIANÇA',
    'Certificamos para fins de registro eclesiástico que a criança foi solenemente apresentada ao Senhor Jesus Cristo\nem culto público nesta Igreja, recebendo a oração intercessória e bênção pastoral da congregação,\nconforme os preceitos das Sagradas Escrituras.\n\n<b>Responsável/Membro:</b> {{membro.nome}}\n<b>Congregação:</b> {{membro.congregacao}}\n\nEm fé de verdade, passamos a presente declaração.\n\n<b>{{data.extenso}}</b>\n\n________________________________________\n<b>{{pastor.responsavel}}</b> - Pastor Presidente\n',
    true
  ),
];

export async function loadCartasTemplatesFromSupabase(supabase: SupabaseClient): Promise<{
  templates: CartaTemplate[];
  systemMap: Record<string, CartaTemplate>;
}> {
  const { data, error } = await supabase
    .from('cartas_templates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const dbRows = (data || []) as CartaTemplate[];

  const systemMap: Record<string, CartaTemplate> = {};
  DEFAULT_SYSTEM_TEMPLATES.forEach((t) => {
    systemMap[t.template_key] = t;
  });
  dbRows.filter((t) => t.scope === 'system').forEach((dbSys) => {
    systemMap[dbSys.template_key] = dbSys;
  });

  const tenantRows = dbRows.filter((t) => t.scope === 'tenant');
  const merged = new Map<string, CartaTemplate>();

  // Customizados do tenant
  tenantRows.forEach((t) => merged.set(t.template_key, t));

  // Padrões do sistema se não sobrescritos pelo tenant
  Object.values(systemMap).forEach((t) => {
    if (!merged.has(t.template_key)) {
      merged.set(t.template_key, t);
    }
  });

  const templates = Array.from(merged.values()).map((tpl) => {
    const sysNative = DEFAULT_SYSTEM_TEMPLATES.find((s) => s.template_key === tpl.template_key);
    if (sysNative && (tpl.scope === 'system' || !tpl.content_json?.canvas?.elements || tpl.content_json?.canvas?.elements?.length < 11)) {
      return { ...sysNative };
    }
    return tpl;
  });

  return { templates, systemMap };
}
