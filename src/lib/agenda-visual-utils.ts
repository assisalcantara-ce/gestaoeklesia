import React from 'react';
import {
  Church,
  Users,
  BookOpen,
  Users2,
  MoreHorizontal,
  LayoutGrid,
  Calendar,
  Music,
  Star,
  Award,
  Flame,
} from 'lucide-react';
import { AgendaEvento } from '@/hooks/agenda/useAgenda';

export type AgendaCategoryKey = 'todos' | 'culto' | 'reuniao' | 'ebd' | 'departamento' | 'congresso' | 'outro';

export interface CategoryInfo {
  key: AgendaCategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  activeRingClass: string;
}

export const CATEGORIES_CONFIG: CategoryInfo[] = [
  {
    key: 'todos',
    label: 'Todos',
    icon: LayoutGrid,
    color: '#475569',
    bgClass: 'bg-white',
    borderClass: 'border-slate-300 hover:border-slate-400',
    textClass: 'text-slate-800',
    activeRingClass: 'ring-2 ring-slate-500 border-slate-500 bg-slate-50 shadow-sm',
  },
  {
    key: 'culto',
    label: 'Cultos',
    icon: Church,
    color: '#ea580c',
    bgClass: 'bg-[#fff8f2]',
    borderClass: 'border-[#fdba74] hover:border-[#fb923c]',
    textClass: 'text-[#c2410c]',
    activeRingClass: 'ring-2 ring-orange-500 border-orange-500 bg-[#ffedd5] shadow-sm',
  },
  {
    key: 'reuniao',
    label: 'Reuniões',
    icon: Users,
    color: '#16a34a',
    bgClass: 'bg-[#f0fdf4]',
    borderClass: 'border-[#86efac] hover:border-[#4ade80]',
    textClass: 'text-[#15803d]',
    activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 bg-[#dcfce7] shadow-sm',
  },
  {
    key: 'ebd',
    label: 'Escola Bíblica',
    icon: BookOpen,
    color: '#9333ea',
    bgClass: 'bg-[#faf5ff]',
    borderClass: 'border-[#d8b4fe] hover:border-[#c084fc]',
    textClass: 'text-[#7e22ce]',
    activeRingClass: 'ring-2 ring-purple-500 border-purple-500 bg-[#f3e8ff] shadow-sm',
  },
  {
    key: 'departamento',
    label: 'Departamentos',
    icon: Users2,
    color: '#0284c7',
    bgClass: 'bg-[#f0f9ff]',
    borderClass: 'border-[#7dd3fc] hover:border-[#38bdf8]',
    textClass: 'text-[#0369a1]',
    activeRingClass: 'ring-2 ring-sky-500 border-sky-500 bg-[#e0f2fe] shadow-sm',
  },
  {
    key: 'congresso',
    label: 'Congressos',
    icon: Award,
    color: '#e11d48',
    bgClass: 'bg-[#fff1f2]',
    borderClass: 'border-[#fda4af] hover:border-[#fb7185]',
    textClass: 'text-[#be123c]',
    activeRingClass: 'ring-2 ring-rose-500 border-rose-500 bg-[#ffe4e6] shadow-sm',
  },
  {
    key: 'outro',
    label: 'Outros',
    icon: MoreHorizontal,
    color: '#475569',
    bgClass: 'bg-[#f8fafc]',
    borderClass: 'border-[#cbd5e1] hover:border-[#94a3b8]',
    textClass: 'text-[#475569]',
    activeRingClass: 'ring-2 ring-slate-500 border-slate-500 bg-slate-100 shadow-sm',
  },
];

/**
 * Identifica a categoria visual unificada de um evento
 */
export function getEventoCategoryKey(evento: AgendaEvento): AgendaCategoryKey {
  const tipo = (evento.tipo || '').toLowerCase();
  const titulo = (evento.titulo || '').toLowerCase();
  const tipoNome = (evento.agenda_tipos?.nome || '').toLowerCase();
  const tipoCat = (evento.agenda_tipos?.categoria || '').toLowerCase();
  const origem = (evento.origem_tipo || '').toLowerCase();

  // 1. Congressos (alta prioridade temática)
  if (
    titulo.includes('congresso') ||
    titulo.includes('conferência') ||
    titulo.includes('conferencia') ||
    tipoNome.includes('congresso')
  ) {
    return 'congresso';
  }

  // 2. Escola Bíblica (EBD)
  if (
    tipo === 'aula' ||
    origem === 'ebd' ||
    titulo.includes('escola bíblica') ||
    titulo.includes('escola biblica') ||
    titulo.includes('ebd') ||
    tipoNome.includes('ebd') ||
    tipoNome.includes('escola')
  ) {
    return 'ebd';
  }

  // 3. Reuniões
  if (
    tipo === 'reuniao' ||
    tipoCat === 'reuniao' ||
    origem === 'reunioes' ||
    titulo.includes('reunião') ||
    titulo.includes('reuniao') ||
    tipoNome.includes('reunião')
  ) {
    return 'reuniao';
  }

  // 4. Departamentos (inclui coral, música, grupos, tarefas, ensaio)
  if (
    tipo === 'tarefa' ||
    tipoCat === 'departamento' ||
    titulo.includes('ensaio') ||
    titulo.includes('coral') ||
    titulo.includes('música') ||
    titulo.includes('musica') ||
    titulo.includes('departamento') ||
    tipoNome.includes('departamento') ||
    titulo.includes('diretoria')
  ) {
    return 'departamento';
  }

  // 5. Cultos
  if (
    tipo === 'culto' ||
    tipoCat === 'culto' ||
    origem === 'cultos' ||
    titulo.includes('culto') ||
    tipoNome.includes('culto')
  ) {
    return 'culto';
  }

  return 'outro';
}

export interface EventoVisual {
  category: AgendaCategoryKey;
  label: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  dotColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Retorna as cores, ícones e classes exatas para exibição no Calendário e no Painel
 */
export function getEventoVisual(evento: AgendaEvento): EventoVisual {
  const cat = getEventoCategoryKey(evento);
  const titulo = (evento.titulo || '').toLowerCase();
  const desc = (evento.descricao || '').toLowerCase();

  // Caso específico para ensaio / coral (Rosa com nota musical)
  if (titulo.includes('coral') || titulo.includes('ensaio') || titulo.includes('música') || titulo.includes('musica')) {
    return {
      category: 'departamento',
      label: 'Música / Ensaio',
      pillBg: 'bg-[#fdf2f8]',
      pillBorder: 'border-[#f472b6]',
      pillText: 'text-[#9d174d]',
      dotColor: 'bg-[#db2777]',
      iconBg: 'bg-[#fce7f3]',
      iconColor: 'text-[#db2777]',
      icon: Music,
    };
  }

  // Caso específico para Congresso de Jovens (Azul com estrela)
  if (cat === 'congresso' && (titulo.includes('jovens') || titulo.includes('mocidade'))) {
    return {
      category: 'congresso',
      label: 'Congresso',
      pillBg: 'bg-[#f0f9ff]',
      pillBorder: 'border-[#38bdf8]',
      pillText: 'text-[#0369a1]',
      dotColor: 'bg-[#0284c7]',
      iconBg: 'bg-[#e0f2fe]',
      iconColor: 'text-[#0284c7]',
      icon: Star,
    };
  }

  switch (cat) {
    case 'culto': {
      // 1. Culto de Doutrina / Ensino / Estudo Bíblico (Ouro / Âmbar harmonioso)
      if (titulo.includes('doutrina') || titulo.includes('ensino') || titulo.includes('estudo') || desc.includes('doutrina')) {
        return {
          category: 'culto',
          label: 'Doutrina',
          pillBg: 'bg-[#fffbeb]',
          pillBorder: 'border-[#fcd34d]',
          pillText: 'text-[#854d0e]',
          dotColor: 'bg-[#d97706]',
          iconBg: 'bg-[#fef3c7]',
          iconColor: 'text-[#d97706]',
          icon: Church,
        };
      }

      // 2. Culto Evangelístico / Missões / Celebração (Chama Pôr-do-Sol vibrante)
      if (titulo.includes('evangel') || titulo.includes('celebração') || titulo.includes('celebracao') || titulo.includes('missões') || titulo.includes('missoes')) {
        return {
          category: 'culto',
          label: 'Evangelístico',
          pillBg: 'bg-[#fff7ed]',
          pillBorder: 'border-[#fb923c]',
          pillText: 'text-[#c2410c]',
          dotColor: 'bg-[#ea580c]',
          iconBg: 'bg-[#fed7aa]',
          iconColor: 'text-[#ea580c]',
          icon: Flame,
        };
      }

      // 3. Culto da Família / Ceia / Santa Ceia (Terracota acolhedor)
      if (titulo.includes('família') || titulo.includes('familia') || titulo.includes('ceia')) {
        return {
          category: 'culto',
          label: 'Família',
          pillBg: 'bg-[#fff8f1]',
          pillBorder: 'border-[#f97316]',
          pillText: 'text-[#9a3412]',
          dotColor: 'bg-[#c2410c]',
          iconBg: 'bg-[#ffedd5]',
          iconColor: 'text-[#c2410c]',
          icon: Users,
        };
      }

      // 4. Culto Administrativo / Solene / Obreiros (Bronze neutro elegante)
      if (titulo.includes('administrativo') || titulo.includes('solene') || titulo.includes('posse') || titulo.includes('assembleia')) {
        return {
          category: 'culto',
          label: 'Administrativo',
          pillBg: 'bg-[#fafaf9]',
          pillBorder: 'border-[#a8a29e]',
          pillText: 'text-[#44403c]',
          dotColor: 'bg-[#78716c]',
          iconBg: 'bg-[#e7e5e4]',
          iconColor: 'text-[#57534e]',
          icon: Church,
        };
      }

      // 5. Culto de Oração / Vigília / Geral (Laranja clássico de Cultos)
      return {
        category: 'culto',
        label: 'Culto',
        pillBg: 'bg-[#fff7ed]',
        pillBorder: 'border-[#fdba74]',
        pillText: 'text-[#9a3412]',
        dotColor: 'bg-[#ea580c]',
        iconBg: 'bg-[#ffedd5]',
        iconColor: 'text-[#ea580c]',
        icon: Church,
      };
    }

    case 'reuniao':
      return {
        category: 'reuniao',
        label: 'Reunião',
        pillBg: 'bg-[#f0fdf4]',
        pillBorder: 'border-[#86efac]',
        pillText: 'text-[#166534]',
        dotColor: 'bg-[#16a34a]',
        iconBg: 'bg-[#dcfce7]',
        iconColor: 'text-[#16a34a]',
        icon: Users,
      };

    case 'ebd':
      return {
        category: 'ebd',
        label: 'Escola Bíblica',
        pillBg: 'bg-[#faf5ff]',
        pillBorder: 'border-[#d8b4fe]',
        pillText: 'text-[#6b21a8]',
        dotColor: 'bg-[#9333ea]',
        iconBg: 'bg-[#f3e8ff]',
        iconColor: 'text-[#9333ea]',
        icon: BookOpen,
      };

    case 'congresso':
      return {
        category: 'congresso',
        label: 'Congresso',
        pillBg: 'bg-[#fff1f2]',
        pillBorder: 'border-[#fda4af]',
        pillText: 'text-[#9f1239]',
        dotColor: 'bg-[#e11d48]',
        iconBg: 'bg-[#ffe4e6]',
        iconColor: 'text-[#e11d48]',
        icon: Star,
      };

    case 'departamento':
      return {
        category: 'departamento',
        label: 'Departamento',
        pillBg: 'bg-[#f0f9ff]',
        pillBorder: 'border-[#7dd3fc]',
        pillText: 'text-[#0369a1]',
        dotColor: 'bg-[#0284c7]',
        iconBg: 'bg-[#e0f2fe]',
        iconColor: 'text-[#0284c7]',
        icon: Users2,
      };

    default:
      return {
        category: 'outro',
        label: 'Outro',
        pillBg: 'bg-[#f8fafc]',
        pillBorder: 'border-[#cbd5e1]',
        pillText: 'text-[#475569]',
        dotColor: 'bg-[#64748b]',
        iconBg: 'bg-[#f1f5f9]',
        iconColor: 'text-[#64748b]',
        icon: Calendar,
      };
  }
}
