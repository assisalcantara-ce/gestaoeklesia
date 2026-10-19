import {
  PlusCircle,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Eye,
  Download,
  Upload,
  LogIn,
  LogOut,
  Zap,
  ShieldCheck,
  MessageSquare,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

export interface AuditLog {
  id: string;
  usuario_id?: string | null;
  usuario_email: string | null;
  acao: string;
  modulo: string;
  area: string | null;
  descricao: string | null;
  status: 'sucesso' | 'erro' | 'aviso' | string;
  data_criacao: string;
  ip_address?: string | null;
  user_agent?: string | null;
  tabela_afetada?: string | null;
  registro_id?: string | null;
  dados_anteriores?: Record<string, unknown> | null;
  dados_novos?: Record<string, unknown> | null;
  mensagem_erro?: string | null;
}

/**
 * Sanitiza recursivamente dados técnicos para evitar a exibição de senhas,
 * tokens, credenciais ou dados sensíveis nos logs de auditoria.
 */
export function sanitizarDadosSensiveis(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    // Detecta tokens Bearer, JWTs ou chaves longas suspeitas
    if (/bearer\s+[a-zA-Z0-9_\-.]+/i.test(val) || /^eyJ[a-zA-Z0-9_\-.]+\.[a-zA-Z0-9_\-.]+/i.test(val)) {
      return '•••••••• (token ocultado por segurança)';
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizarDadosSensiveis);
  }
  if (typeof val === 'object') {
    const sensitiveKeys = [
      'password',
      'senha',
      'token',
      'secret',
      'access_token',
      'refresh_token',
      'authorization',
      'apikey',
      'api_key',
      'credentials',
      'cartao',
      'cvv',
      'hash',
      'private_key',
      'chave_privada',
    ];
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
        sanitized[k] = '•••••••• (ocultado por segurança)';
      } else {
        sanitized[k] = sanitizarDadosSensiveis(v);
      }
    }
    return sanitized;
  }
  return val;
}

/**
 * Retorna metadados visuais (ícone, cores e label) para cada tipo de ação.
 */
export function getAcaoBadge(acao: string) {
  const norm = (acao || '').toLowerCase().trim();
  switch (norm) {
    case 'criar':
      return {
        label: 'Criar',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        icon: PlusCircle,
      };
    case 'editar':
      return {
        label: 'Editar',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        icon: Pencil,
      };
    case 'deletar':
    case 'excluir':
      return {
        label: 'Deletar',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
        icon: Trash2,
      };
    case 'inativar':
      return {
        label: 'Inativar',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
        icon: UserX,
      };
    case 'reativar':
      return {
        label: 'Reativar',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80',
        icon: UserCheck,
      };
    case 'visualizar':
      return {
        label: 'Visualizar',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200/80',
        icon: Eye,
      };
    case 'exportar':
      return {
        label: 'Exportar',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
        icon: Download,
      };
    case 'importar':
      return {
        label: 'Importar',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        icon: Upload,
      };
    case 'login':
      return {
        label: 'Login',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        icon: LogIn,
      };
    case 'logout':
      return {
        label: 'Logout',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200/80',
        icon: LogOut,
      };
    case 'atualizar_status':
      return {
        label: 'Status',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
        icon: Zap,
      };
    case 'atualizar_permissoes':
      return {
        label: 'Permissões',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        icon: ShieldCheck,
      };
    case 'responder':
      return {
        label: 'Responder',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
        icon: MessageSquare,
      };
    case 'reclassificar':
      return {
        label: 'Reclassificar',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        icon: RefreshCw,
      };
    default:
      return {
        label: acao ? acao.charAt(0).toUpperCase() + acao.slice(1) : 'Ação',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200/80',
        icon: FileText,
      };
  }
}

/**
 * Retorna metadados visuais para o status do log.
 */
export function getStatusBadge(status: string) {
  const norm = (status || '').toLowerCase().trim();
  switch (norm) {
    case 'sucesso':
      return {
        label: 'Sucesso',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
        icon: CheckCircle2,
      };
    case 'erro':
      return {
        label: 'Erro',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500',
        icon: XCircle,
      };
    case 'aviso':
    case 'alerta':
      return {
        label: 'Aviso',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
        icon: AlertTriangle,
      };
    default:
      return {
        label: status || 'Registro',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
        icon: Info,
      };
  }
}

/**
 * Calcula os índices de paginação no padrão Range do Supabase.
 */
export function calcularIntervaloPaginacao(pagina: number, itensPorPagina: number = 20) {
  const pag = Math.max(1, pagina);
  const from = (pag - 1) * itensPorPagina;
  const to = from + itensPorPagina - 1;
  return { from, to };
}
