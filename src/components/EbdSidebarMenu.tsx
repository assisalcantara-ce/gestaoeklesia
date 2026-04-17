'use client';

/**
 * EbdSidebarMenu — menu hierárquico de 3 níveis exclusivo do módulo EBD.
 *
 * Estrutura fiel ao mapa mental:
 *
 * EBD (raiz — gerenciada pelo Sidebar pai)
 * ├─ Dashboard                     ← nível 1 (folha — renderização condicional: admin=global, usuário=local)
 * ├─ Cadastro                      ← nível 1 (agrupador)
 * │   ├─ Classes                   ← nível 2 (folha)
 * │   ├─ Turmas                    ← nível 2 (folha)
 * │   ├─ Superintendente           ← nível 2 (folha)
 * │   ├─ Professores               ← nível 2 (folha)
 * │   └─ Alunos                    ← nível 2 (agrupador + folha própria)
 * │       └─ Carteirinha           ← nível 3 (folha)
 * ├─ Aulas                         ← nível 1 (agrupador)
 * │   ├─ Frequência                ← nível 2 (folha)
 * │   ├─ Avaliações                ← nível 2 (folha)
 * │   └─ Material de apoio         ← nível 2 (folha)
 * ├─ Relatórios                    ← nível 1 (agrupador)
 * │   ├─ Boletim de aula           ← nível 2 (folha)
 * │   ├─ Histórico de presença     ← nível 2 (folha)
 * │   ├─ Aniversariantes           ← nível 2 (folha)
 * │   ├─ Professores               ← nível 2 (folha)
 * │   └─ Alunos                    ← nível 2 (folha)
 * ├─ Pedidos                       ← nível 1 (agrupador)
 * │   ├─ Revistas                  ← nível 2 (folha)
 * │   └─ Material extra            ← nível 2 (folha)
 * ├─ Certificado por classe        ← nível 1 (folha)
 * └─ Caixa                         ← nível 1 (agrupador)
 *     └─ Ofertas                   ← nível 2 (folha)
 */

import { useState, useEffect } from 'react';

// ─── Tipo ────────────────────────────────────────────────────────────────────

interface EbdNode {
  /** Identificador único — usado como activeMenu nas páginas */
  id: string;
  /** Texto exibido no menu */
  label: string;
  /** Rota de navegação — ausente em agrupadores que não têm página própria */
  path?: string;
  /** Filhos — presente em agrupadores; ausente em folhas */
  children?: EbdNode[];
}

// ─── Árvore de dados EBD ─────────────────────────────────────────────────────
// Ordem e hierarquia fiéis ao mapa mental.

export const EBD_TREE: EbdNode[] = [
  // ── Nível 1: Dashboard (único — conteúdo muda por permissão) ──
  { id: 'ebd-dashboard', label: 'Dashboard', path: '/ebd/dashboard' },

  // ── Nível 1: Cadastro ──
  {
    id: 'ebd-cadastro',
    label: 'Cadastro',
    children: [
      // Nível 2 — folhas simples
      { id: 'ebd-cadastro-classes',          label: 'Classes',        path: '/ebd/cadastro/classes'          },
      { id: 'ebd-cadastro-turmas',           label: 'Turmas',         path: '/ebd/turmas'                    },
      { id: 'ebd-cadastro-superintendente',  label: 'Superintendente', path: '/ebd/cadastro/superintendentes' },
      { id: 'ebd-cadastro-professores',      label: 'Professores',    path: '/ebd/cadastro/professores'      },
      // Nível 2 — agrupador com folha própria
      {
        id: 'ebd-cadastro-alunos',
        label: 'Alunos',
        path: '/ebd/alunos',
        children: [
          // Nível 3 — folha
          { id: 'ebd-cadastro-alunos-carteirinha', label: 'Carteirinha', path: '/ebd/alunos/carteirinha' },
        ],
      },
    ],
  },

  // ── Nível 1: Aulas ──
  {
    id: 'ebd-aulas',
    label: 'Aulas',
    children: [
      // Nível 2 — folhas
      { id: 'ebd-aulas-frequencia', label: 'Frequência',        path: '/ebd/chamada'    },
      { id: 'ebd-aulas-avaliacoes', label: 'Avaliações',        path: '/ebd/avaliacoes' },
      { id: 'ebd-aulas-material',   label: 'Material de apoio', path: '/ebd/material'   },
    ],
  },

  // ── Nível 1: Relatórios ──
  {
    id: 'ebd-relatorios',
    label: 'Relatórios',
    children: [
      // Nível 2 — folhas
      { id: 'ebd-relatorios-boletim',          label: 'Boletim de aula',      path: '/ebd/relatorios/boletim'          },
      { id: 'ebd-relatorios-historico',        label: 'Histórico de presença', path: '/ebd/historico'                   },
      { id: 'ebd-relatorios-aniversariantes',  label: 'Aniversariantes',      path: '/ebd/relatorios/aniversariantes'  },
      { id: 'ebd-relatorios-professores',      label: 'Professores',          path: '/ebd/relatorios/professores'      },
      { id: 'ebd-relatorios-alunos',           label: 'Alunos',               path: '/ebd/relatorios/alunos'           },
    ],
  },

  // ── Nível 1: Pedidos ──
  {
    id: 'ebd-pedidos',
    label: 'Pedidos',
    children: [
      // Nível 2 — folhas
      { id: 'ebd-pedidos-revistas', label: 'Revistas',       path: '/ebd/revistas'         },
      { id: 'ebd-pedidos-material', label: 'Material extra', path: '/ebd/pedidos/material' },
    ],
  },

  // ── Nível 1: Certificado por classe — folha sem filhos ──
  { id: 'ebd-certificados', label: 'Certificado por classe', path: '/ebd/certificados' },

  // ── Nível 1: Caixa ──
  {
    id: 'ebd-caixa',
    label: 'Caixa',
    children: [
      // Nível 2 — folha
      { id: 'ebd-caixa-ofertas', label: 'Ofertas', path: '/ebd/ofertas' },
    ],
  },
];

// ─── Conjunto de todos os IDs EBD (para uso externo no parentMap) ─────────────

function collectAllIds(nodes: EbdNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children) ids.push(...collectAllIds(node.children));
  }
  return ids;
}

export const ALL_EBD_IDS = collectAllIds(EBD_TREE);

// ─── Helper: retorna cadeia de ancestrais de um ID ────────────────────────────

function findAncestors(
  nodes: EbdNode[],
  targetId: string,
  path: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return path;
    if (node.children) {
      const found = findAncestors(node.children, targetId, [...path, node.id]);
      if (found !== null) return found;
    }
  }
  return null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface EbdSidebarMenuProps {
  activeMenu: string;
  /** Callback fornecido pelo Sidebar pai — faz router.push + fecha menu mobile */
  onNavigate: (id: string, path: string) => void;
}

export default function EbdSidebarMenu({ activeMenu, onNavigate }: EbdSidebarMenuProps) {
  // IDs dos agrupadores internos que estão expandidos
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expande ancestrais quando activeMenu muda
  useEffect(() => {
    const ancestors = findAncestors(EBD_TREE, activeMenu);
    if (ancestors && ancestors.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        ancestors.forEach(id => next.add(id));
        return next;
      });
    }
  }, [activeMenu]);

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Renderizador recursivo ──────────────────────────────────────────────
  // depth 0 = nível 1 (filho direto do EBD raiz)
  // depth 1 = nível 2
  // depth 2 = nível 3

  const renderNode = (node: EbdNode, depth: number) => {
    const isExpanded  = expanded.has(node.id);
    const isActive    = activeMenu === node.id;
    const hasChildren = !!node.children?.length;

    // Recuo visual por nível
    const paddingClass =
      depth === 0 ? 'pl-6'
      : depth === 1 ? 'pl-10'
      : 'pl-14';

    // Marcador visual por nível
    const marker =
      depth === 0 ? <span className="text-orange-400 text-xs flex-shrink-0">▸</span>
      : depth === 1 ? <span className="text-white/40 text-xs flex-shrink-0 font-bold">–</span>
      : <span className="text-white/25 text-xs flex-shrink-0">·</span>;

    const handleClick = () => {
      if (hasChildren) {
        toggleExpanded(node.id);
        // Agrupadores com path próprio também navegam ao clicar
        if (node.path) onNavigate(node.id, node.path);
      } else if (node.path) {
        onNavigate(node.id, node.path);
      }
    };

    return (
      <div key={node.id}>
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-2 py-2 pr-3 text-left transition-colors text-sm ${paddingClass} ${
            isActive
              ? 'bg-white/20 text-white font-semibold'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          {marker}
          <span className="flex-1 leading-tight">{node.label}</span>
          {hasChildren && (
            <span
              className={`text-white/40 text-xs transition-transform duration-200 flex-shrink-0 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            >
              ▼
            </span>
          )}
        </button>

        {/* Filhos — renderizados recursivamente ao expandir */}
        {hasChildren && isExpanded && (
          <div className={depth === 0 ? 'bg-black/10' : ''}>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#0f2a45] border-y border-white/10">
      {EBD_TREE.map(node => renderNode(node, 0))}
    </div>
  );
}
