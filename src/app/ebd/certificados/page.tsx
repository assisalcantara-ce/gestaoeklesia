'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { substituirPlaceholdersCertificado } from '@/lib/certificados-utils';
import { Award, ChevronRight, Printer, Settings } from 'lucide-react';
import Link from 'next/link';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type CertTemplate = {
  id: string; nome: string; backgroundUrl?: string;
  elementos: any[]; orientacao?: 'landscape' | 'portrait'; categoria?: string;
};

interface Congregacao { id: string; nome: string; }
interface EbdTurma {
  id: string; nome: string; church_id: string; classe_id: string | null;
  professor_titular_id: string | null;
  church_nome?: string; classe_nome?: string; professor_nome?: string;
}
interface EbdAluno {
  id: string; nome: string; data_nascimento: string | null;
  responsavel_nome: string | null;
}

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };
const fmtDate = (v?: string | null) => {
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdCertificadosPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const [loading,     setLoading]     = useState(true);
  const [templates,   setTemplates]   = useState<CertTemplate[]>([]);
  const [configIgreja,setConfigIgreja]= useState<ConfiguracaoIgreja>({ nome: '', endereco: '', cnpj: '', telefone: '', email: '', website: '', descricao: '', responsavel: '', logo: '' });

  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [turmas,       setTurmas]       = useState<EbdTurma[]>([]);
  const [alunos,       setAlunos]       = useState<EbdAluno[]>([]);

  const [selCong,     setSelCong]     = useState('');
  const [selTurma,    setSelTurma]    = useState<EbdTurma | null>(null);
  const [selTemplate, setSelTemplate] = useState<CertTemplate | null>(null);
  const [selAlunos,   setSelAlunos]   = useState<Set<string>>(new Set());
  const [alunosLoad,  setAlunosLoad]  = useState(false);
  const [imprimindo,  setImprimindo]  = useState<string | null>(null);

  // ── Carga inicial ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(async mid => {
      if (!mid) return;

      const [{ templates: all }, config, congsR, turmasR] = await Promise.all([
        loadCertificadosTemplatesForCurrentUser(supabase),
        fetchConfiguracaoIgrejaFromSupabase(supabase),
        supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
        supabase.from('ebd_turmas')
          .select('id, nome, church_id, classe_id, professor_titular_id, congregacoes(nome), ebd_classes(nome), ebd_professores(nome)')
          .eq('ministry_id', mid)
          .eq('ativo', true)
          .order('nome'),
      ]);

      // Filtra só templates EBD
      const ebdTemplates = (all as CertTemplate[]).filter(t => t.categoria === 'ebd');
      setTemplates(ebdTemplates);
      if (ebdTemplates.length === 1) setSelTemplate(ebdTemplates[0]);

      setConfigIgreja(config as ConfiguracaoIgreja);
      setCongregacoes(congsR.data ?? []);

      setTurmas(((turmasR.data ?? []) as any[]).map(t => ({
        id:                  t.id,
        nome:                t.nome,
        church_id:           t.church_id,
        classe_id:           t.classe_id,
        professor_titular_id:t.professor_titular_id,
        church_nome:         t.congregacoes?.nome ?? '—',
        classe_nome:         t.ebd_classes?.nome ?? '—',
        professor_nome:      t.ebd_professores?.nome ?? null,
      })));

      setLoading(false);
    });
  }, [user, supabase]);

  // ── Carregar alunos da turma ─────────────────────────────────────────────

  const carregarAlunos = useCallback(async (turmaId: string) => {
    setAlunosLoad(true);
    setAlunos([]);
    setSelAlunos(new Set());
    const { data } = await supabase
      .from('ebd_matriculas')
      .select('aluno_id, ebd_alunos(id, nome, data_nascimento, responsavel_nome)')
      .eq('turma_id', turmaId)
      .is('data_fim', null);
    const lista: EbdAluno[] = ((data ?? []) as any[])
      .map(m => m.ebd_alunos)
      .filter(Boolean)
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome));
    setAlunos(lista);
    setSelAlunos(new Set(lista.map((a: any) => a.id)));
    setAlunosLoad(false);
  }, [supabase]);

  const handleSelectTurma = (t: EbdTurma) => {
    setSelTurma(t);
    carregarAlunos(t.id);
  };

  // ── Renderização do certificado ──────────────────────────────────────────

  const renderHtml = useCallback((template: CertTemplate, aluno: EbdAluno) => {
    if (!selTurma) return '';
    const map: Record<string, string> = {
      aluno_nome:            aluno.nome,
      aluno_data_nascimento: fmtDate(aluno.data_nascimento),
      turma_nome:            selTurma.nome,
      classe_nome:           selTurma.classe_nome ?? '—',
      professor_nome:        selTurma.professor_nome ?? '—',
      responsavel_nome:      aluno.responsavel_nome ?? '',
      nome_igreja:           configIgreja.nome || '',
      data_emissao:          new Date().toLocaleDateString('pt-BR'),
      trimestre:             '',
      ano:                   String(new Date().getFullYear()),
    };

    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? CERTIFICADO_CANVAS.altura : CERTIFICADO_CANVAS.largura;
    const altura  = orientacao === 'portrait' ? CERTIFICADO_CANVAS.largura : CERTIFICADO_CANVAS.altura;

    const bgHtml = template.backgroundUrl
      ? `<img src="${template.backgroundUrl}" style="position:absolute;left:0;top:0;width:${largura}px;height:${altura}px;object-fit:fill;display:block;" />`
      : '';

    const elementsHtml = (template.elementos || [])
      .filter((el: any) => el.visivel !== false)
      .map((el: any) => {
        const base = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.largura}px;height:${el.altura}px;`;
        if (el.tipo === 'texto') {
          const txt = substituirPlaceholdersCertificado(el.texto || '', map, 'ebd').replace(/\n/g, '<br />');
          const s = [
            base,
            `font-size:${el.fontSize||14}px;`,
            `font-family:${el.fonte||'Arial'};`,
            `font-weight:${el.negrito?700:400};`,
            `font-style:${el.italico?'italic':'normal'};`,
            `text-decoration:${el.sublinhado?'underline':'none'};`,
            `color:${el.cor||'#111'};`,
            `text-align:${el.alinhamento||'left'};`,
            'box-sizing:border-box;',
          ].join('');
          return `<div style="${s}">${txt}</div>`;
        }
        if (el.tipo === 'chapa') {
          return `<div style="${base}background-color:${el.cor||'#111'};opacity:${el.transparencia??1};"></div>`;
        }
        if (el.tipo === 'logo' || el.tipo === 'imagem') {
          const src = el.tipo === 'logo' ? (configIgreja.logo || el.imagemUrl || '') : (el.imagemUrl || '');
          if (!src) return '';
          return `<img src="${src}" style="${base}object-fit:contain;opacity:${el.transparencia??1};" />`;
        }
        return '';
      }).join('');

    return `<div style="position:relative;width:${largura}px;height:${altura}px;margin:0 auto;overflow:hidden;">${bgHtml}${elementsHtml}</div>`;
  }, [selTurma, configIgreja]);

  // ── Impressão ────────────────────────────────────────────────────────────

  const imprimirAluno = (aluno: EbdAluno) => {
    if (!selTemplate) return;
    setImprimindo(aluno.id);
    const html = renderHtml(selTemplate, aluno);
    const win = window.open('', '_blank');
    if (!win) { setImprimindo(null); return; }
    const scaleX = (297 * 3.7795) / CERTIFICADO_CANVAS.largura;
    const scaleY = (210 * 3.7795) / CERTIFICADO_CANVAS.altura;
    const scale  = Math.min(scaleX, scaleY).toFixed(4);
    win.document.write(`<!DOCTYPE html><html><head><title>Certificado EBD</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 landscape;margin:0;}
      html,body{width:297mm;height:210mm;overflow:hidden;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .w{transform-origin:top left;transform:scale(${scale});width:${CERTIFICADO_CANVAS.largura}px;height:${CERTIFICADO_CANVAS.altura}px;}
      img{display:block;}
    </style></head><body><div class="w">${html}</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); setImprimindo(null); }, 400);
  };

  const imprimirTodos = () => {
    if (!selTemplate || alunos.length === 0) return;
    const selecionados = alunos.filter(a => selAlunos.has(a.id));
    if (selecionados.length === 0) return;

    const scaleX = (297 * 3.7795) / CERTIFICADO_CANVAS.largura;
    const scaleY = (210 * 3.7795) / CERTIFICADO_CANVAS.altura;
    const scale  = Math.min(scaleX, scaleY).toFixed(4);

    const allHtml = selecionados.map(a =>
      `<div class="page"><div class="w">${renderHtml(selTemplate, a)}</div></div>`
    ).join('');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Certificados EBD</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 landscape;margin:0;}
      html,body{overflow:hidden;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .page{width:297mm;height:210mm;page-break-after:always;overflow:hidden;}
      .w{transform-origin:top left;transform:scale(${scale});width:${CERTIFICADO_CANVAS.largura}px;height:${CERTIFICADO_CANVAS.altura}px;}
      img{display:block;}
    </style></head><body>${allHtml}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const turmasFiltradas = selCong ? turmas.filter(t => t.church_id === selCong) : turmas;

  return (
    <PageLayout
      title="EBD — Certificados"
      description="Emita certificados de conclusão para alunos da EBD"
      activeMenu="ebd-certificados"
    >
      {loading ? (
        <div className="py-20 text-center text-gray-400">Carregando...</div>
      ) : templates.length === 0 ? (
        /* Nenhum template EBD criado */
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-5">
          <Award className="h-16 w-16 opacity-20" />
          <div className="text-center">
            <p className="text-base font-semibold text-gray-600">Nenhum modelo de certificado EBD encontrado</p>
            <p className="text-sm mt-1">
              Acesse <strong>Configurações → Certificados</strong>, crie um novo modelo
              e defina a categoria como <strong>EBD — Escola Bíblica Dominical</strong>.
            </p>
          </div>
          <Link
            href="/configuracoes/certificados"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#123b63] text-white rounded-xl font-semibold text-sm hover:bg-[#0f2a45] transition"
          >
            <Settings className="h-4 w-4" />
            Ir para Configurações de Certificados
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Coluna esquerda: Seleção ── */}
          <div className="space-y-4">

            {/* Modelo */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">1. Modelo de certificado</h3>
              <div className="space-y-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelTemplate(t)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                      selTemplate?.id === t.id
                        ? 'border-[#123b63] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="h-12 w-20 rounded overflow-hidden shrink-0 bg-gray-100"
                      style={t.backgroundUrl ? { backgroundImage: `url(${t.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{t.nome}</p>
                      <p className="text-xs text-gray-400">{t.orientacao === 'portrait' ? 'Retrato' : 'Paisagem'}</p>
                    </div>
                  </button>
                ))}
              </div>
              <Link
                href="/configuracoes/certificados"
                className="mt-3 flex items-center gap-1 text-xs text-[#123b63] hover:underline"
              >
                <Settings className="h-3 w-3" /> Gerenciar modelos
              </Link>
            </div>

            {/* Igreja / Turma */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">2. Selecionar turma</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
                  <select value={selCong} onChange={e => { setSelCong(e.target.value); setSelTurma(null); setAlunos([]); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Todas</option>
                    {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {turmasFiltradas.length === 0 && (
                    <p className="text-xs text-gray-400 py-3 text-center">Nenhuma turma ativa.</p>
                  )}
                  {turmasFiltradas.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTurma(t)}
                      className={`w-full flex flex-col p-3 rounded-xl border text-left transition ${
                        selTurma?.id === t.id
                          ? 'border-[#123b63] bg-blue-50'
                          : 'border-gray-100 hover:border-gray-300 bg-gray-50'
                      }`}
                    >
                      <span className="text-sm font-semibold text-gray-800">{t.nome}</span>
                      <span className="text-xs text-gray-400">{t.church_nome} · {t.classe_nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Coluna direita: Alunos ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-700">
                    {selTurma ? `Alunos — ${selTurma.nome}` : 'Alunos'}
                  </h3>
                  {selTurma && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selTurma.church_nome} · {selTurma.classe_nome}
                      {selTurma.professor_nome && ` · Prof. ${selTurma.professor_nome}`}
                    </p>
                  )}
                </div>
                {alunos.length > 0 && selTemplate && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {selAlunos.size}/{alunos.length} selecionados
                    </span>
                    <button
                      onClick={imprimirTodos}
                      className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-xl text-sm font-semibold hover:bg-[#0f2a45] transition"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir {selAlunos.size > 1 ? `${selAlunos.size} certificados` : 'certificado'}
                    </button>
                  </div>
                )}
              </div>

              {!selTurma ? (
                <div className="text-center py-16 text-gray-400">
                  <Award className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Selecione uma turma para ver os alunos.</p>
                </div>
              ) : !selTemplate ? (
                <div className="text-center py-16 text-amber-500">
                  <Award className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">Selecione um modelo de certificado primeiro.</p>
                </div>
              ) : alunosLoad ? (
                <p className="text-center py-10 text-gray-400 text-sm">Carregando alunos...</p>
              ) : alunos.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-sm">Nenhum aluno matriculado nesta turma.</p>
                </div>
              ) : (
                <>
                  {/* Seleção em massa */}
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                    <input
                      type="checkbox"
                      checked={selAlunos.size === alunos.length}
                      onChange={e => setSelAlunos(e.target.checked ? new Set(alunos.map(a => a.id)) : new Set())}
                      className="h-4 w-4 rounded text-[#123b63]"
                    />
                    <span className="text-xs font-semibold text-gray-500">Selecionar todos</span>
                  </div>

                  <div className="space-y-2">
                    {alunos.map(a => (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition ${
                          selAlunos.has(a.id) ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selAlunos.has(a.id)}
                            onChange={e => {
                              const next = new Set(selAlunos);
                              e.target.checked ? next.add(a.id) : next.delete(a.id);
                              setSelAlunos(next);
                            }}
                            className="h-4 w-4 rounded text-[#123b63]"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{a.nome}</p>
                            {a.data_nascimento && (
                              <p className="text-xs text-gray-400">{fmtDate(a.data_nascimento)}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => imprimirAluno(a)}
                          disabled={imprimindo === a.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-50"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          {imprimindo === a.id ? 'Abrindo...' : 'Imprimir'}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      )}
    </PageLayout>
  );
}
