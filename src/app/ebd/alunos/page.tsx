'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveEbdScope } from '@/lib/cartoes-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { Plus, Printer, X, Users, Search, XCircle, IdCard, ClipboardList } from 'lucide-react';

// --- Tipos ---

interface Congregacao  { id: string; nome: string; }
interface EbdClasse    { id: string; nome: string; }
interface EbdTurma     {
  id: string; nome: string; church_id: string;
  classe_id: string | null;
  ebd_classes: { faixa_etaria_max: number | null } | null;
}
interface EbdAluno     { id: string; nome: string; church_id: string; ativo: boolean; }
interface MembroSugestao {
  id: string; name: string;
  phone: string | null;
  email: string | null;
  congregacao_id: string | null;
}
interface EbdMatricula {
  id: string; aluno_id: string; turma_id: string; ministry_id: string;
  data_inicio: string; data_fim: string | null; motivo_saida: string | null;
  aluno_nome?: string; turma_nome?: string; aluno_church_id?: string;
}
interface AlunoDetalhado {
  id: string; nome: string; church_id: string;
  data_nascimento: string | null; sexo: 'M' | 'F' | null;
  responsavel_nome: string | null; responsavel_telefone: string | null;
  foto_url?: string | null;
}
interface HistoricoItem {
  mat_id: string; turma_id: string; turma_nome: string;
  data_inicio: string; data_fim: string | null; motivo_saida: string | null;
  total_aulas: number; presencas: number;
}

// --- Componente ---

export default function EbdAlunosPage() {
  const { user } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('ebd');
  const supabase  = useMemo(() => createClient(), []);
  useAppDialog();

  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const churchIdRef = useRef<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [classes,      setClasses]      = useState<EbdClasse[]>([]);
  const [turmas,       setTurmas]       = useState<EbdTurma[]>([]);
  const [matriculas,   setMatriculas]   = useState<EbdMatricula[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja | null>(null);

  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [busca,        setBusca]        = useState('');
  const [filtroCong,   setFiltroCong]   = useState('');
  const [filtroClasse, setFiltroClasse] = useState('');
  const [filtroTurma,  setFiltroTurma]  = useState('');

  const [encerrarModal, setEncerrarModal] = useState<{ mat: EbdMatricula } | null>(null);
  const [motivoSaida,   setMotivoSaida]   = useState('');

  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [carteirinhaModal, setCarteirinhaModal] = useState<{ mat: EbdMatricula; aluno: AlunoDetalhado } | null>(null);
  const [historicoModal,   setHistoricoModal]   = useState<{ nome: string; items: HistoricoItem[] } | null>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  const [showMatForm,      setShowMatForm]      = useState(false);
  const [formMat,          setFormMat]          = useState({
    member_id: '', turma_id: '', church_id: '',
    data_inicio: new Date().toISOString().slice(0, 10),
    responsavel_nome: '', responsavel_telefone: '',
  });
  const [buscaAluno,       setBuscaAluno]       = useState('');
  const [sugestoesAluno,   setSugestoesAluno]   = useState<MembroSugestao[]>([]);
  const [buscandoAluno,    setBuscandoAluno]    = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<MembroSugestao | null>(null);
  const [erroModal,        setErroModal]        = useState<string | null>(null);
  const buscaAlunoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const cid = churchIdRef.current;
    let congsQ   = supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome');
    if (cid) congsQ = congsQ.eq('id', cid);
    const classesQ = supabase.from('ebd_classes').select('id, nome').eq('ministry_id', mid).eq('ativo', true).order('ordem').order('nome');
    let turmasQ  = supabase.from('ebd_turmas').select('id, nome, church_id, classe_id, ebd_classes(faixa_etaria_max)').eq('ministry_id', mid).eq('ativo', true).order('nome');
    if (cid) turmasQ = turmasQ.eq('church_id', cid);
    let alunosQ  = supabase.from('ebd_alunos').select('id, nome, church_id, ativo').eq('ministry_id', mid).order('nome');
    if (cid) alunosQ = alunosQ.eq('church_id', cid);
    const matsQ = supabase.from('ebd_matriculas').select('*').eq('ministry_id', mid).order('data_inicio', { ascending: false });

    const [congsR, classesR, turmasR, alunosR, matsR] = await Promise.all([congsQ, classesQ, turmasQ, alunosQ, matsQ]);
    setCongregacoes(congsR.data ?? []);
    setClasses(classesR.data ?? []);
    setTurmas(turmasR.data ?? []);

    const alunoMap = new Map<string, EbdAluno>((alunosR.data ?? []).map((a: EbdAluno) => [a.id, a]));
    const turmaMap = new Map<string, string>((turmasR.data ?? []).map((t: EbdTurma) => [t.id, t.nome]));
    setMatriculas((matsR.data ?? []).map((m: EbdMatricula) => ({
      ...m,
      aluno_nome:      alunoMap.get(m.aluno_id)?.nome      ?? '---',
      aluno_church_id: alunoMap.get(m.aluno_id)?.church_id ?? '',
      turma_nome:      turmaMap.get(m.turma_id)            ?? '---',
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user || bloqueado) return;
    resolveEbdScope(supabase).then(async scope => {
      if (!scope.ministryId) return;
      churchIdRef.current = scope.churchId;
      setMinistryId(scope.ministryId);
      if (scope.churchId) setFiltroCong(scope.churchId);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      load(scope.ministryId);
    });
  }, [user, bloqueado, supabase, load]);

  const abrirMatricula = () => {
    setFormMat({ member_id: '', turma_id: '', church_id: '', data_inicio: new Date().toISOString().slice(0, 10), responsavel_nome: '', responsavel_telefone: '' });
    setBuscaAluno('');
    setSugestoesAluno([]);
    setAlunoSelecionado(null);
    setErroModal(null);
    setShowMatForm(true);
  };

  const matricular = async () => {
    if (!ministryId || !formMat.member_id || !formMat.turma_id || !formMat.church_id || !alunoSelecionado) return;

    // 1. Verifica/cria ebd_alunos para este membro
    const { data: alunoExistente } = await supabase
      .from('ebd_alunos')
      .select('id')
      .eq('ministry_id', ministryId)
      .eq('member_id', formMat.member_id)
      .maybeSingle();

    let alunoId: string;
    if (alunoExistente) {
      alunoId = alunoExistente.id;
    } else {
      const { data: novoAluno, error: errAluno } = await supabase
        .from('ebd_alunos')
        .insert({
          ministry_id: ministryId,
          church_id:   formMat.church_id,
          member_id:   formMat.member_id,
          nome:        alunoSelecionado.name,
        })
        .select('id')
        .single();
      if (errAluno) { flash('erro', errAluno.message); return; }
      alunoId = novoAluno.id;
    }

    // 2. Cria nova matrícula
    const { error: e2 } = await supabase.from('ebd_matriculas').insert({
      ministry_id: ministryId,
      aluno_id:    alunoId,
      turma_id:    formMat.turma_id,
      data_inicio: formMat.data_inicio,
    });
    if (e2) { flash('erro', e2.message); return; }

    // 4. Atualiza responsável para turmas juvenil/abaixo
    if (requerResponsavel(formMat.turma_id) && (formMat.responsavel_nome || formMat.responsavel_telefone)) {
      await supabase.from('ebd_alunos').update({
        responsavel_nome:     formMat.responsavel_nome || null,
        responsavel_telefone: formMat.responsavel_telefone || null,
      }).eq('id', alunoId);
    }

    flash('ok', 'Matrícula realizada!');
    setShowMatForm(false);
    setBuscaAluno('');
    setAlunoSelecionado(null);
    load(ministryId);
  };

  const confirmarEncerramento = async () => {
    if (!ministryId || !encerrarModal) return;
    const { error } = await supabase
      .from('ebd_matriculas')
      .update({ data_fim: new Date().toISOString().slice(0, 10), motivo_saida: motivoSaida.trim() || null })
      .eq('id', encerrarModal.mat.id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Matricula encerrada.'); setEncerrarModal(null); load(ministryId); }
  };

  const abrirCarteirinha = async (m: EbdMatricula) => {
    const aluno = await fetchAlunoComMembro(m);
    if (aluno) setCarteirinhaModal({ mat: m, aluno });
  };

  const imprimirCarteirinha = () => {
    if (!carteirinhaModal) return;
    const { mat, aluno } = carteirinhaModal;
    const bgUrl = `${window.location.origin}/img/card_ebd2.png`;
    const cardHtml = buildCardHtml(mat, aluno, bgUrl);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Carteirinha</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0; }
      body {
        padding: 15mm;
        overflow: auto;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style></head><body>
    ${cardHtml}
    <script>window.onload=function(){window.print();window.close();}<\/script>
    </body></html>`;
    const win = window.open('', '_blank', 'width=620,height=877');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // ── Helpers reutilizáveis de card ───────────────────────────────────────────
  const buildCardHtml = (
    mat: EbdMatricula,
    aluno: AlunoDetalhado,
    bgUrl: string,
  ): string => {
    const turma  = turmas.find(t => t.id === mat.turma_id);
    const classe = turma?.classe_id ? classes.find(c => c.id === turma.classe_id) : null;
    const nomeMin = configIgreja?.nome ?? '';
    const hashNum = parseInt(mat.id.replace(/-/g, '').slice(-4), 16) % 1000;
    const nascFormatado = aluno.data_nascimento
      ? new Date(aluno.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '';
    const fotoHtml = aluno.foto_url
      ? `<img src="${aluno.foto_url}" style="width:100%;height:100%;object-fit:cover;object-position:top;" />`
      : '';
    const anoAtual = String(new Date().getFullYear());
    const matHash  = String(hashNum).padStart(3, '0');
    const cel = (l: number, t: number, w: number, h: number, color: string, align = 'left') =>
      `position:absolute;left:${l}px;top:${t}px;width:${w}px;height:${h}px;` +
      `color:${color};font-size:10px;font-weight:bold;font-family:'Trebuchet MS',Arial;` +
      `display:flex;align-items:center;justify-content:${align === 'center' ? 'center' : 'flex-start'};` +
      `overflow:hidden;white-space:nowrap;`;
    return `<div style="display:inline-block;width:86mm;height:54mm;overflow:hidden;">
      <div style="width:465px;height:291px;transform:scale(0.70);transform-origin:top left;position:relative;
        background-image:url('${bgUrl}');background-size:100% 100%;background-repeat:no-repeat;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <div style="${cel(82,108,230,20,'#444444')}">${aluno.nome}</div>
        <div style="${cel(82,143,230,20,'#444444')}">${nascFormatado}</div>
        <div style="${cel(82,180,230,20,'#444444')}">${classe?.nome ?? mat.turma_nome ?? ''}</div>
        <div style="${cel(82,215,230,20,'#444444')}">${nomeMin}</div>
        <div style="position:absolute;left:331px;top:103px;width:94px;height:130px;
          display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${fotoHtml}
        </div>
        <div style="${cel(281,250,46,20,'#ef4444','center')}">${anoAtual}</div>
        <div style="${cel(339,248,60,20,'#ef4444','center')}">${matHash}</div>
      </div>
    </div>`;
  };

  const fetchAlunoComMembro = async (m: EbdMatricula): Promise<AlunoDetalhado | null> => {
    const { data } = await supabase
      .from('ebd_alunos')
      .select('id, nome, church_id, member_id, data_nascimento, sexo, responsavel_nome, responsavel_telefone')
      .eq('id', m.aluno_id)
      .single();
    if (!data) return null;
    let aluno = data as AlunoDetalhado & { member_id?: string | null };
    if (aluno.member_id) {
      const { data: membro } = await supabase
        .from('members')
        .select('data_nascimento, sexo, foto_url')
        .eq('id', aluno.member_id)
        .single();
      if (membro) {
        aluno = {
          ...aluno,
          data_nascimento: aluno.data_nascimento ?? membro.data_nascimento ?? null,
          sexo: (aluno.sexo ?? (membro.sexo === 'M' || membro.sexo === 'MASCULINO' ? 'M'
                               : membro.sexo === 'F' || membro.sexo === 'FEMININO'  ? 'F'
                               : null)) as 'M' | 'F' | null,
          foto_url: membro.foto_url ?? null,
        };
      }
    }
    return aluno;
  };

  const imprimirLote = async () => {
    const selecionados = listaFiltrada.filter(m => selectedIds.has(m.id));
    if (selecionados.length === 0) return;
    const bgUrl = `${window.location.origin}/img/card_ebd2.png`;
    const cardsHtml: string[] = [];
    for (const m of selecionados) {
      const aluno = await fetchAlunoComMembro(m);
      if (aluno) cardsHtml.push(buildCardHtml(m, aluno, bgUrl));
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Carteirinhas</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0; }
      body {
        padding: 15mm;
        overflow: auto;
        display: flex; flex-wrap: wrap; gap: 8mm; align-content: flex-start;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
    </style></head><body>
    ${cardsHtml.join('\n')}
    <script>window.onload=function(){window.print();window.close();}<\/script>
    </body></html>`;
    const win = window.open('', '_blank', 'width=700,height=900');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const abrirHistorico = async (m: EbdMatricula) => {
    setHistoricoModal({ nome: m.aluno_nome ?? '', items: [] });
    setHistoricoLoading(true);
    const alunoId = m.aluno_id;

    const { data: allMats } = await supabase
      .from('ebd_matriculas')
      .select('id, turma_id, data_inicio, data_fim, motivo_saida, ebd_turmas(nome)')
      .eq('aluno_id', alunoId)
      .order('data_inicio', { ascending: false });

    if (!allMats) { setHistoricoLoading(false); return; }

    const items: HistoricoItem[] = await Promise.all(
      allMats.map(async (mat: any) => {
        const { data: aulas } = await supabase
          .from('ebd_aulas')
          .select('id')
          .eq('turma_id', mat.turma_id)
          .eq('status', 'realizada');
        const aulaIds = (aulas ?? []).map((a: any) => a.id);
        let presencas = 0;
        if (aulaIds.length > 0) {
          const { data: freqs } = await supabase
            .from('ebd_frequencias')
            .select('presente')
            .eq('aluno_id', alunoId)
            .in('aula_id', aulaIds);
          presencas = (freqs ?? []).filter((f: any) => f.presente).length;
        }
        return {
          mat_id: mat.id,
          turma_id: mat.turma_id,
          turma_nome: (mat.ebd_turmas as any)?.nome ?? '---',
          data_inicio: mat.data_inicio,
          data_fim: mat.data_fim,
          motivo_saida: mat.motivo_saida,
          total_aulas: aulaIds.length,
          presencas,
        };
      })
    );

    setHistoricoModal({ nome: m.aluno_nome ?? '', items });
    setHistoricoLoading(false);
  };

  // ── Turma requer dados de responsável (juvenil e abaixo = faixa_etaria_max <= 17) ──

  const requerResponsavel = (turmaId: string): boolean => {
    const t = turmas.find(t => t.id === turmaId);
    const max = (t as EbdTurma | undefined)?.ebd_classes?.faixa_etaria_max;
    return max != null && max <= 17;
  };

  // ── Busca dinâmica de aluno ─────────────────────────────────────────────────

  useEffect(() => {
    if (buscaAluno.length < 3) { setSugestoesAluno([]); return; }
    if (buscaAlunoRef.current) clearTimeout(buscaAlunoRef.current);
    setBuscandoAluno(true);
    buscaAlunoRef.current = setTimeout(async () => {
      if (!ministryId) { setBuscandoAluno(false); return; }
      const { data } = await supabase
        .from('members')
        .select('id, name, phone, email, congregacao_id')
        .eq('ministry_id', ministryId)
        .ilike('name', `${buscaAluno}%`)
        .order('name')
        .limit(8);
      setSugestoesAluno(data ?? []);
      setBuscandoAluno(false);
    }, 300);
  }, [buscaAluno, ministryId, supabase]);

  const listaFiltrada = matriculas.filter(m => {
    if (filtroCong   && m.aluno_church_id !== filtroCong) return false;
    if (filtroTurma  && m.turma_id        !== filtroTurma) return false;
    if (filtroClasse) {
      const t = turmas.find(t => t.id === m.turma_id);
      if (!t || t.classe_id !== filtroClasse) return false;
    }
    if (busca && !m.aluno_nome?.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  if (bloqueado) return null;

  return (
    <PageLayout title="EBD - Alunos" description="Lista de alunos matriculados" activeMenu="ebd-cadastro-alunos">
      <style>{`
        @media print {
          body:not(.print-carteirinha) * { visibility: hidden !important; }
          body:not(.print-carteirinha) #alunos-print,
          body:not(.print-carteirinha) #alunos-print * { visibility: visible !important; }
          body:not(.print-carteirinha) #alunos-print { position: fixed; inset: 0; padding: 24px 32px; }
          .no-print { display: none !important; }

          body.print-carteirinha * { visibility: hidden !important; }
          body.print-carteirinha #carteirinha-card,
          body.print-carteirinha #carteirinha-card * { visibility: visible !important; }
          body.print-carteirinha #carteirinha-card {
            position: fixed !important;
            top: 50% !important; left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 465px !important; height: 291px !important;
            background-size: cover !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      <div id="alunos-print">
        <div className="hidden print:block mb-6 border-b pb-4">
          {configIgreja?.logo && <img src={configIgreja.logo} alt="Logo" className="h-14 object-contain mb-2" />}
          <p className="font-bold text-lg">{configIgreja?.nome}</p>
          {configIgreja?.endereco && <p className="text-sm text-gray-500">{configIgreja.endereco}</p>}
          {(configIgreja?.telefone || configIgreja?.email) && (
            <p className="text-sm text-gray-500">{[configIgreja.telefone, configIgreja.email].filter(Boolean).join(' | ')}</p>
          )}
          <h2 className="text-base font-bold mt-3">Lista de Alunos Matriculados</h2>
          <p className="text-xs text-gray-400">Emitido em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Painel de Filtros */}
        <div className="bg-[#eef4fb] border border-[#c5d9ec] rounded-lg p-4 md:p-5 mb-6 no-print">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-[#123b63]" />
              <h2 className="text-base font-semibold text-gray-700">Filtro de Busca</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 border border-[#c5d9ec] bg-white rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
              <button onClick={abrirMatricula}
                className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
                <Plus className="h-4 w-4" /> Matricular aluno
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Linha 1: Igreja, Classe, Turma */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-[#123b63] mb-1 block">IGREJA</label>
                <select value={filtroCong} onChange={e => setFiltroCong(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#c5d9ec] rounded-lg focus:outline-none focus:border-[#123b63] bg-white">
                  <option value="">- Todas as igrejas -</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#123b63] mb-1 block">CLASSE</label>
                <select value={filtroClasse} onChange={e => { setFiltroClasse(e.target.value); setFiltroTurma(''); }}
                  className="w-full px-3 py-2 text-sm border border-[#c5d9ec] rounded-lg focus:outline-none focus:border-[#123b63] bg-white">
                  <option value="">- Todas as classes -</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#123b63] mb-1 block">TURMA</label>
                <select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#c5d9ec] rounded-lg focus:outline-none focus:border-[#123b63] bg-white">
                  <option value="">- Todas as turmas -</option>
                  {turmas
                    .filter(t => !filtroClasse || t.classe_id === filtroClasse)
                    .map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Linha 2: Busca + Limpar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#123b63] mb-1 block">NOME DO ALUNO</label>
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={busca} onChange={e => setBusca(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#c5d9ec] rounded-lg text-sm focus:outline-none focus:border-[#123b63] bg-white"
                    placeholder="Buscar por nome do aluno..." />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setBusca(''); setFiltroCong(''); setFiltroClasse(''); setFiltroTurma(''); }}
                  className="w-full px-6 py-2 bg-[#123b63] hover:bg-[#0f2a45] text-white rounded-lg font-semibold transition text-sm">
                  LIMPAR FILTROS
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

        {!loading && listaFiltrada.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum aluno matriculado.</p>
          </div>
        )}

        {!loading && listaFiltrada.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#123b63]" /> Listagem de Alunos Matriculados
              </h2>
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <button
                    onClick={imprimirLote}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition no-print">
                    <Printer className="h-4 w-4" />
                    Imprimir {selectedIds.size} carteirinha{selectedIds.size > 1 ? 's' : ''}
                  </button>
                )}
                <span className="text-sm text-gray-600">
                  Quantidade: <strong className="text-[#123b63]">{listaFiltrada.length}</strong>
                </span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[#123b63]/10 border-b border-[#123b63]/20">
                <tr>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-[#123b63] border-r border-[#123b63]/10 no-print">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#123b63] cursor-pointer"
                      checked={listaFiltrada.length > 0 && listaFiltrada.every(m => selectedIds.has(m.id))}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(new Set(listaFiltrada.map(m => m.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#123b63] border-r border-[#123b63]/10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#123b63] border-r border-[#123b63]/10">Aluno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#123b63] border-r border-[#123b63]/10">Turma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#123b63] border-r border-[#123b63]/10">Igreja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#123b63] border-r border-[#123b63]/10">Desde</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#123b63] no-print">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((m, i) => (
                  <tr key={m.id} className={`border-b border-gray-100 transition ${selectedIds.has(m.id) ? 'bg-blue-50' : m.data_fim ? 'bg-gray-50' : 'hover:bg-[#eef4fb]'}`}>
                    <td className="px-3 py-3 text-center border-r border-gray-100 no-print">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#123b63] cursor-pointer"
                        checked={selectedIds.has(m.id)}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(m.id); else next.delete(m.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td className={`px-4 py-3 text-xs font-bold border-r border-gray-100 ${m.data_fim ? 'text-gray-400' : 'text-[#123b63]'}`}>#{i + 1}</td>
                    <td className={`px-4 py-3 font-semibold border-r border-gray-100 ${m.data_fim ? 'text-gray-400' : 'text-gray-800'}`}>{m.aluno_nome}</td>
                    <td className={`px-4 py-3 border-r border-gray-100 ${m.data_fim ? 'text-gray-400' : 'text-gray-700'}`}>
                      {m.turma_nome}
                      {m.data_fim && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Encerrada</span>}
                    </td>
                    <td className={`px-4 py-3 border-r border-gray-100 ${m.data_fim ? 'text-gray-400' : 'text-gray-600'}`}>{congregacoes.find(c => c.id === m.aluno_church_id)?.nome ?? '---'}</td>
                    <td className={`px-4 py-3 text-xs border-r border-gray-100 ${m.data_fim ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(m.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 no-print">
                      <div className="flex items-center justify-center gap-2">
                        {!m.data_fim && (
                          <div className="relative group">
                            <button
                              onClick={() => { setMotivoSaida(''); setEncerrarModal({ mat: m }); }}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                              <XCircle className="h-4 w-4" />
                            </button>
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              Encerrar Matr&#237;cula
                            </span>
                          </div>
                        )}
                        <div className="relative group">
                          <button
                            onClick={() => abrirCarteirinha(m)}
                            className="p-1.5 text-[#123b63]/60 hover:text-[#123b63] hover:bg-[#eef4fb] rounded-lg transition">
                            <IdCard className="h-4 w-4" />
                          </button>
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            Carteirinha do aluno
                          </span>
                        </div>
                        <div className="relative group">
                          <button
                            onClick={() => abrirHistorico(m)}
                            className="p-1.5 text-[#123b63]/60 hover:text-[#123b63] hover:bg-[#eef4fb] rounded-lg transition">
                            <ClipboardList className="h-4 w-4" />
                          </button>
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            Hist&#243;rico do aluno
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMatForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-[#123b63] text-lg">Matricular Aluno</h3>
              <button onClick={() => setShowMatForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            {erroModal && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                {erroModal}
              </div>
            )}
            <div className="space-y-4">

              {/* Busca dinâmica de aluno */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Aluno *</label>
                {alunoSelecionado ? (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">{alunoSelecionado.name}</p>
                      {alunoSelecionado.phone && (
                        <p className="text-xs text-blue-500">{alunoSelecionado.phone}</p>
                      )}
                    </div>
                    <button onClick={() => { setAlunoSelecionado(null); setBuscaAluno(''); setFormMat(f => ({ ...f, member_id: '', church_id: '', responsavel_nome: '', responsavel_telefone: '' })); }}
                      className="text-xs text-blue-400 hover:text-blue-600 font-medium transition">Trocar</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={buscaAluno}
                      onChange={e => setBuscaAluno(e.target.value)}
                      placeholder="Digite o nome do aluno (min. 3 letras)..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    {buscandoAluno && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
                    {sugestoesAluno.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {sugestoesAluno.map(a => (
                          <button key={a.id} onClick={async () => {
                            // Verifica matrícula ativa antes de selecionar
                            const { data: alunoExist } = await supabase
                              .from('ebd_alunos')
                              .select('id')
                              .eq('ministry_id', ministryId!)
                              .eq('member_id', a.id)
                              .maybeSingle();
                            if (alunoExist) {
                              const { data: matAtiva } = await supabase
                                .from('ebd_matriculas')
                                .select('turma_id')
                                .eq('aluno_id', alunoExist.id)
                                .is('data_fim', null)
                                .maybeSingle();
                              if (matAtiva) {
                                const turmaAtual = turmas.find(t => t.id === matAtiva.turma_id)?.nome ?? 'outra turma';
                                setErroModal(`${a.name} já está matriculado em "${turmaAtual}".`);
                                setBuscaAluno('');
                                setSugestoesAluno([]);
                                return;
                              }
                            }
                            setAlunoSelecionado(a);
                            setErroModal(null);
                            setFormMat(f => ({
                              ...f,
                              member_id: a.id,
                              church_id: a.congregacao_id ?? '',
                            }));
                            setBuscaAluno('');
                            setSugestoesAluno([]);
                          }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition border-b border-gray-50 last:border-0">
                            <p className="text-sm font-medium text-gray-800">{a.name}</p>
                            {a.phone && <p className="text-xs text-gray-400">{a.phone}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                    {buscaAluno.length >= 3 && !buscandoAluno && sugestoesAluno.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">Nenhum aluno encontrado.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Igreja */}
              {formMat.member_id && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja *</label>
                  <select value={formMat.church_id} onChange={e => setFormMat(f => ({ ...f, church_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Selecione...</option>
                    {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Turma */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Turma *</label>
                <select value={formMat.turma_id} onChange={e => setFormMat(f => ({ ...f, turma_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              {/* Data de início */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Data de in&#237;cio</label>
                <input type="date" value={formMat.data_inicio} onChange={e => setFormMat(f => ({ ...f, data_inicio: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>

              {/* Responsável — apenas para turmas juvenil / abaixo */}
              {formMat.turma_id && requerResponsavel(formMat.turma_id) && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-[#123b63] mb-3">Dados do Respons&#225;vel</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nome do respons&#225;vel</label>
                      <input
                        value={formMat.responsavel_nome}
                        onChange={e => setFormMat(f => ({ ...f, responsavel_nome: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Telefone de contato</label>
                      <input
                        value={formMat.responsavel_telefone}
                        onChange={e => setFormMat(f => ({ ...f, responsavel_telefone: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowMatForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={matricular} disabled={!formMat.member_id || !formMat.church_id || !formMat.turma_id}
                className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-40 disabled:cursor-not-allowed">Matricular</button>
            </div>
          </div>
        </div>
      )}

      {encerrarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-1">Encerrar matricula</h3>
            <p className="text-xs text-gray-400 mb-4">{encerrarModal.mat.aluno_nome}</p>
            <p className="text-sm text-gray-600 mb-3">Motivo da saida (opcional):</p>
            <input value={motivoSaida} onChange={e => setMotivoSaida(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-5"
              placeholder="Ex: Mudanca de cidade, formatura..." autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setEncerrarModal(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={confirmarEncerramento}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition">Encerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Carteirinha (layout card_ebd.png) ── */}
      {carteirinhaModal && (() => {
        const { mat, aluno } = carteirinhaModal;
        const turma   = turmas.find(t => t.id === mat.turma_id);
        const classe  = turma?.classe_id ? classes.find(c => c.id === turma.classe_id) : null;
        const nomeMin = configIgreja?.nome ?? '';
        const hashNum = parseInt(mat.id.replace(/-/g, '').slice(-4), 16) % 1000;
        const nascFormatado = aluno.data_nascimento
          ? new Date(aluno.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')
          : '';

        const cel = (left: number, top: number, width: number, height: number,
                     color: string, align: 'left'|'center'|'right' = 'left'): React.CSSProperties => ({
          position: 'absolute', left, top, width, height,
          color, fontSize: 10, fontWeight: 'bold', fontFamily: "'Trebuchet MS', Arial",
          display: 'flex', alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          overflow: 'hidden', whiteSpace: 'nowrap',
        });

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
            <div className="bg-white rounded-2xl p-5 shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-[#123b63] text-base">Carteirinha do Aluno</h3>
                <button onClick={() => setCarteirinhaModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>

              {/* wrapper que absorve o espaço do scale (465×291 → 90% = 419×262) */}
              <div style={{ width: 419, height: 262, overflow: 'hidden' }}>
                <div id="carteirinha-card" style={{
                  position: 'relative', width: 465, height: 291,
                  backgroundImage: 'url(/img/card_ebd2.png)',
                  backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
                  transformOrigin: 'top left', transform: 'scale(0.9)',
                  WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                } as React.CSSProperties}>
                  <div style={cel(82,  108, 230, 20, '#444444')}>{aluno.nome}</div>
                  <div style={cel(82,  143, 230, 20, '#444444')}>{nascFormatado}</div>
                  <div style={cel(82,  180, 230, 20, '#444444')}>{classe?.nome ?? mat.turma_nome ?? ''}</div>
                  <div style={cel(82,  215, 230, 20, '#444444')}>{nomeMin}</div>
                  <div style={{
                    position: 'absolute', left: 331, top: 103, width: 94, height: 130,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {aluno.foto_url
                      ? <img src={aluno.foto_url} alt={aluno.nome}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                      : <Users style={{ width: 40, height: 40, color: 'rgba(0,0,0,0.2)' }} />}
                  </div>
                  <div style={cel(281, 250, 46,  20, '#ef4444', 'center')}>{new Date().getFullYear()}</div>
                  <div style={cel(339, 248, 60,  20, '#ef4444', 'center')}>{String(hashNum).padStart(3,'0')}</div>
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <button onClick={() => setCarteirinhaModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                  Fechar
                </button>
                <button onClick={imprimirCarteirinha}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Histórico ── */}
      {historicoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-[#123b63] text-lg">Hist&#243;rico do Aluno</h3>
                <p className="text-sm text-gray-500">{historicoModal.nome}</p>
              </div>
              <button onClick={() => setHistoricoModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            {historicoLoading ? (
              <p className="text-center text-gray-400 text-sm py-10">Carregando hist&#243;rico...</p>
            ) : historicoModal.items.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">Nenhum hist&#243;rico encontrado.</p>
            ) : (
              <div className="space-y-3">
                {historicoModal.items.map((item) => {
                  const pct = item.total_aulas > 0 ? Math.round((item.presencas / item.total_aulas) * 100) : null;
                  const ativo = !item.data_fim;
                  return (
                    <div key={item.mat_id} className={`rounded-xl border p-4 ${ativo ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-800">{item.turma_nome}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(item.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                            {' \u2192 '}
                            {item.data_fim
                              ? new Date(item.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')
                              : <span className="text-green-600 font-medium">Atual</span>}
                          </p>
                          {item.motivo_saida && (
                            <p className="text-xs text-amber-600 mt-0.5">Motivo: {item.motivo_saida}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ativo ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {ativo ? 'Ativo' : 'Encerrado'}
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Frequ&#234;ncia</span>
                          <span>{item.presencas} / {item.total_aulas} aulas{pct !== null ? ` \u2014 ${pct}%` : ''}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct === null ? 'bg-gray-300' :
                              pct >= 75   ? 'bg-green-500' :
                              pct >= 50   ? 'bg-yellow-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                        {item.total_aulas === 0 && (
                          <p className="text-xs text-gray-400 mt-1 italic">Sem aulas registradas neste per&#237;odo.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => setHistoricoModal(null)}
              className="mt-5 w-full px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
              Fechar
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
