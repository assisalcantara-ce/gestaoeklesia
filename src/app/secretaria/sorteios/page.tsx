'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate, OrgNomenclaturasState, getDefaultOrgNomenclaturas } from '@/lib/org-nomenclaturas';
import {
  Trophy,
  Plus,
  Trash2,
  X,
  Play,
  RotateCcw,
  Printer,
  ChevronRight,
  UserX,
  CheckCircle2,
  UsersRound,
  FileSpreadsheet,
  Upload
} from 'lucide-react';

interface Prize {
  name: string;
  winner: string | null;
}

interface Winner {
  prize: string;
  winner: string;
}

interface MemberOption {
  id: string;
  name: string;
  congregacao_id: string | null;
  cargo_ministerial: string | null;
  sexo: string | null;
  status: string | null;
}

interface CongregacaoOption {
  id: string;
  nome: string;
}

export default function SorteiosPage() {
  const { ctx } = useRequireModulo('secretaria');
  const supabase = useMemo(() => createClient(), []);

  // Tabs
  const [activeTab, setActiveTab] = useState<'config' | 'raffle' | 'results'>('config');

  // Nomenclaturas
  const [nomenclaturas, setNomenclaturas] = useState<OrgNomenclaturasState>(getDefaultOrgNomenclaturas());

  // Estados principais de dados
  const [participants, setParticipants] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [currentPrizeIdx, setCurrentPrizeIdx] = useState(0);

  // Formulários/Inputs locais
  const [manualNamesText, setManualNamesText] = useState('');
  const [newPrizeText, setNewPrizeText] = useState('');
  const [drawQuantity, setDrawQuantity] = useState(1);

  // Filtros de busca no banco de dados de membros
  const [congregacoes, setCongregacoes] = useState<CongregacaoOption[]>([]);
  const [selectedCongregacao, setSelectedCongregacao] = useState('TODAS');
  const [selectedCargo, setSelectedCargo] = useState('TODOS');
  const [selectedSexo, setSelectedSexo] = useState('TODOS');
  const [selectedStatus, setSelectedStatus] = useState('active'); // Membros ativos por padrão

  // Membros carregados via filtro pendentes de adição
  const [filteredMembers, setFilteredMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [hasSearchedMembers, setHasSearchedMembers] = useState(false);

  // Estados do Sorteador (Slot Machine)
  const [spinning, setSpinning] = useState(false);
  const [visibleNames, setVisibleNames] = useState<string[]>(['—']);
  const [currentWinnersForPrize, setCurrentWinnersForPrize] = useState<string[]>([]);
  const [lastWinnerName, setLastWinnerName] = useState<string | null>(null);

  // Refs e Animações
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modais de Notificação
  const [modalNotify, setModalNotify] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info'
  });

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setModalNotify({ isOpen: true, type, title, message });
  };

  const tabsOptions = useMemo(() => [
    { id: 'config', label: '⚙️ Configurar' },
    { id: 'raffle', label: '🎰 Sortear' },
    { id: 'results', label: '🏅 Resultados' }
  ], []);

  // Carregar Nomenclaturas e Congregações
  useEffect(() => {
    const initData = async () => {
      if (!ctx?.ministryId) return;
      try {
        const nom = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase);
        setNomenclaturas(nom);

        const { data: cgData } = await supabase
          .from('congregacoes')
          .select('id, nome')
          .eq('ministry_id', ctx.ministryId)
          .order('nome');
        if (cgData) setCongregacoes(cgData as CongregacaoOption[]);
      } catch (err) {
        console.error(err);
      }
    };
    if (!ctx?.loading && ctx?.ministryId) {
      initData();
    }
  }, [ctx?.loading, ctx?.ministryId, supabase]);

  // Lista de Cargos Ministeriais fixos do sistema para filtro
  const cargoOptions = [
    'Membro',
    'Cooperador',
    'Auxiliar',
    'Diácono',
    'Presbítero',
    'Evangelista',
    'Missionário',
    'Missionária',
    'Pastor',
    'Bispo',
    'Outro'
  ];

  // Confete engine em Canvas puro React
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctxCanvas = canvas.getContext('2d');
    if (!ctxCanvas) return;

    let particles: any[] = [];
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      gravity: number;
      size: number;
      color: string;
      shape: 'rect' | 'circle';
      rotation: number;
      rotSpeed: number;
      alpha: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = Math.random() * -12 - 6;
        this.gravity = 0.35;
        this.size = Math.random() * 8 + 4;
        this.color = ['#c9a227', '#f0d060', '#ffffff', '#10b981', '#ef4444', '#3b82f6'][Math.floor(Math.random() * 6)];
        this.shape = Math.random() > 0.5 ? 'rect' : 'circle';
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.15;
        this.alpha = 1;
      }

      update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
        this.alpha = Math.max(0, this.alpha - 0.01);
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.globalAlpha = this.alpha;
        c.fillStyle = this.color;
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        if (this.shape === 'rect') {
          c.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
        } else {
          c.beginPath();
          c.arc(0, 0, this.size / 2, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
      }
    }

    const loop = () => {
      ctxCanvas.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.update();
        p.draw(ctxCanvas);
      });
      particles = particles.filter(p => p.alpha > 0);
      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    (window as any).fireConfetti = () => {
      const cx = window.innerWidth / 2;
      for (let i = 0; i < 150; i++) {
        particles.push(new Particle(cx + (Math.random() - 0.5) * 200, window.innerHeight * 0.35));
      }
      cancelAnimationFrame(animationFrameId);
      loop();
    };

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const triggerConfetti = () => {
    if (typeof (window as any).fireConfetti === 'function') {
      (window as any).fireConfetti();
    }
  };

  // Buscar Membros no Banco com Filtros aplicados
  const handleLoadMembers = async () => {
    if (!ctx?.ministryId) return;
    setLoadingMembers(true);
    setHasSearchedMembers(true);
    try {
      let query = supabase
        .from('members')
        .select('id, name, congregacao_id, cargo_ministerial, sexo, status')
        .eq('ministry_id', ctx.ministryId);

      if (selectedCongregacao !== 'TODAS') {
        query = query.eq('congregacao_id', selectedCongregacao);
      }
      if (selectedCargo !== 'TODOS') {
        query = query.eq('cargo_ministerial', selectedCargo);
      }
      if (selectedSexo !== 'TODOS') {
        query = query.eq('sexo', selectedSexo);
      }
      if (selectedStatus !== 'TODOS') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query.order('name');

      if (!error && data) {
        setFilteredMembers(data as MemberOption[]);
      } else {
        setFilteredMembers([]);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Erro', 'Falha ao buscar membros no banco de dados.');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Adicionar Membros buscados à lista de Sorteio
  const handleAddFilteredMembers = () => {
    if (filteredMembers.length === 0) return;
    const names = filteredMembers.map(m => m.name).filter(Boolean);
    const added = names.filter(n => !participants.includes(n));
    setParticipants(prev => [...prev, ...added]);
    showNotification('success', 'Participantes Adicionados', `${added.length} membros foram adicionados ao sorteio.`);
    setFilteredMembers([]);
    setHasSearchedMembers(false);
  };

  // Adicionar Nomes Manuais
  const handleAddManualNames = () => {
    const raw = manualNamesText.trim();
    if (!raw) return;
    const list = raw
      .split(/[\n\r;,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    const added = list.filter(n => !participants.includes(n));
    setParticipants(prev => [...prev, ...added]);
    setManualNamesText('');
    showNotification('success', 'Nomes Adicionados', `${added.length} participantes foram inseridos.`);
  };

  // Importar arquivo CSV
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const list = text
        .split(/[\n\r;,]+/)
        .map(s => s.trim().replace(/^"|"$/g, '').trim())
        .filter(s => s.length > 1 && !/^(nome|name|participante)/i.test(s));

      const added = list.filter(n => !participants.includes(n));
      setParticipants(prev => [...prev, ...added]);
      showNotification('success', 'CSV Importado', `${added.length} participantes foram extraídos e adicionados.`);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Limpar lista de participantes
  const handleClearParticipants = () => {
    setParticipants([]);
    showNotification('info', 'Lista Limpa', 'Todos os participantes foram removidos.');
  };

  // Cadastrar Brinde/Prêmio
  const handleAddPrize = () => {
    const name = newPrizeText.trim();
    if (!name) {
      showNotification('warning', 'Brinde Vazio', 'Digite o nome do prêmio.');
      return;
    }
    setPrizes(prev => [...prev, { name, winner: null }]);
    setNewPrizeText('');
  };

  // Remover Brinde/Prêmio
  const handleRemovePrize = (index: number) => {
    setPrizes(prev => prev.filter((_, idx) => idx !== index));
  };

  // Inicializar o Sorteio
  const handleStartRaffle = () => {
    if (participants.length === 0) {
      showNotification('warning', 'Sem Participantes', 'Adicione pelo menos 1 participante.');
      return;
    }
    if (prizes.length === 0) {
      showNotification('warning', 'Sem Prêmios', 'Adicione pelo menos 1 brinde.');
      return;
    }

    setCurrentPrizeIdx(0);
    setWinners([]);
    // Reseta status dos brindes
    setPrizes(prev => prev.map(p => ({ ...p, winner: null })));
    setCurrentWinnersForPrize([]);
    setLastWinnerName(null);
    setVisibleNames(['—']);
    setActiveTab('raffle');
  };

  // Efeito Slot Machine - Roda o Sorteio
  const handleDrawNow = () => {
    if (spinning || prizes.length === 0) return;

    const prize = prizes[currentPrizeIdx];
    setSpinning(true);
    setLastWinnerName(null);

    // Filtrar participantes que já ganharam prêmios no sorteio atual
    const alreadyWon = winners.map(w => w.winner);
    let pool = participants.filter(p => !alreadyWon.includes(p) && !currentWinnersForPrize.includes(p));
    // Se o pool acabar, reseta o pool para permitir re-sorteio de todos
    if (pool.length === 0) pool = [...participants];

    let ticks = 0;
    const maxTicks = 45;

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    spinIntervalRef.current = setInterval(() => {
      ticks++;
      // Gera nomes aleatórios visíveis
      const screenNames = Array.from({ length: 5 }, () => pool[Math.floor(Math.random() * pool.length)]);
      setVisibleNames(screenNames);

      if (ticks >= maxTicks) {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

        const chosenWinner = pool[Math.floor(Math.random() * pool.length)];

        // Preenche o slot central com o vencedor
        const finalScreen = [
          pool[Math.floor(Math.random() * pool.length)],
          pool[Math.floor(Math.random() * pool.length)],
          chosenWinner,
          pool[Math.floor(Math.random() * pool.length)],
          pool[Math.floor(Math.random() * pool.length)],
        ];

        setVisibleNames(finalScreen);
        setSpinning(false);
        setLastWinnerName(chosenWinner);

        // Atualiza os ganhadores locais do brinde atual
        setCurrentWinnersForPrize(prev => [...prev, chosenWinner]);

        // Insere o ganhador geral
        setWinners(prev => [...prev, { prize: prize.name, winner: chosenWinner }]);

        // Atualiza a propriedade do brinde
        setPrizes(prev => prev.map((p, idx) => {
          if (idx === currentPrizeIdx) {
            return {
              ...p,
              winner: p.winner ? `${p.winner}, ${chosenWinner}` : chosenWinner
            };
          }
          return p;
        }));

        triggerConfetti();
      }
    }, 90);
  };

  // Re-sortear último ganhador (se ausente)
  const handleRedrawLastWinner = () => {
    if (spinning || currentWinnersForPrize.length === 0) return;

    const prize = prizes[currentPrizeIdx];
    const disqualified = currentWinnersForPrize[currentWinnersForPrize.length - 1];

    // Remove do array do brinde atual
    setCurrentWinnersForPrize(prev => prev.slice(0, -1));

    // Remove do array de vencedores global
    setWinners(prev => {
      const idx = prev.findIndex(w => w.prize === prize.name && w.winner === disqualified);
      if (idx !== -1) {
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      }
      return prev;
    });

    // Remove do nome do prêmio
    setPrizes(prev => prev.map((p, idx) => {
      if (idx === currentPrizeIdx && p.winner) {
        const list = p.winner.split(', ').map(s => s.trim()).filter(s => s !== disqualified);
        return { ...p, winner: list.length > 0 ? list.join(', ') : null };
      }
      return p;
    }));

    setLastWinnerName(null);
    setVisibleNames(['—']);
    showNotification('info', 'Participante Ausente', `⚠️ ${disqualified} foi desqualificado(a). Sorteando substituto...`);

    // Dispara novamente o sorteio automaticamente após 1 segundo
    setTimeout(() => {
      handleDrawNow();
    }, 1000);
  };

  // Ir para o Próximo Brinde
  const handleNextPrize = () => {
    if (currentPrizeIdx < prizes.length - 1) {
      setCurrentPrizeIdx(prev => prev + 1);
      setCurrentWinnersForPrize([]);
      setLastWinnerName(null);
      setVisibleNames(['—']);
    }
  };

  // Imprimir / Exportar Resultados em PDF
  const handlePrintResults = () => {
    const rows = winners
      .map((w, i) => `<tr><td>${i + 1}</td><td>${w.prize}</td><td>${w.winner}</td></tr>`)
      .join('');

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Resultados do Sorteio</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
          h1 { font-size: 1.8rem; margin: 0; color: #0f172a; }
          p { margin: 5px 0 0 0; color: #64748b; font-size: 0.95rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 12px 16px; text-align: left; }
          th { background: #0f172a; color: #fff; font-weight: 600; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer { margin-top: 40px; text-align: center; font-size: 0.8rem; color: #94a3b8; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Módulo de Sorteio Ministerial</h1>
          <p>Resultado Oficial da Extração de Brindes</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">#</th>
              <th>Prêmio / Brinde</th>
              <th>Ganhador(a)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">
          Gerado em ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })} às ${new Date().toLocaleTimeString('pt-BR')}
        </div>
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 10px 24px; font-size: 0.9rem; font-weight: bold; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">
            🖨️ Imprimir / Salvar em PDF
          </button>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  };

  // Resetar e iniciar novo sorteio
  const handleResetAll = () => {
    if (confirm('Deseja realmente reiniciar todo o sorteio? Todos os dados em andamento e resultados serão perdidos.')) {
      setParticipants([]);
      setPrizes([]);
      setWinners([]);
      setCurrentPrizeIdx(0);
      setCurrentWinnersForPrize([]);
      setLastWinnerName(null);
      setVisibleNames(['—']);
      setActiveTab('config');
    }
  };

  // Abre a aba de Resultados e renderiza
  const handleFinishRaffle = () => {
    setActiveTab('results');
  };

  const labelsDivPrincipal = nomenclaturas.divisaoPrincipal.opcao1 || 'CONGREGAÇÃO';

  return (
    <PageLayout
      title="Sorteador de Brindes"
      description="Módulo dinâmico e visual de sorteio de brindes para eventos e cultos da igreja"
    >
      {/* Canvas invisível para confetes */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      />

      <div className="mb-6">
        <Tabs
          tabs={tabsOptions}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as any)}
        >
          {/* ABA: CONFIGURAR */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Seção Esquerda: Participantes */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Adicionar pelo Banco de Dados de Membros */}
                <Section title="Filtrar e Importar Membros">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Filtro por Congregação */}
                    {labelsDivPrincipal !== 'NENHUMA' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                          {labelsDivPrincipal}
                        </label>
                        <select
                          value={selectedCongregacao}
                          onChange={e => setSelectedCongregacao(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                        >
                          <option value="TODAS">Todas as Congregações</option>
                          {congregacoes.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Filtro por Cargo Ministerial */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                        Cargo Ministerial
                      </label>
                      <select
                        value={selectedCargo}
                        onChange={e => setSelectedCargo(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                      >
                        <option value="TODOS">Todos os Cargos</option>
                        {cargoOptions.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filtro por Gênero */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                        Gênero
                      </label>
                      <select
                        value={selectedSexo}
                        onChange={e => setSelectedSexo(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                      >
                        <option value="TODOS">Todos</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                      </select>
                    </div>

                    {/* Filtro por Status */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                        Status
                      </label>
                      <select
                        value={selectedStatus}
                        onChange={e => setSelectedStatus(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                      >
                        <option value="TODOS">Todos</option>
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                      </select>
                    </div>

                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
                    <button
                      type="button"
                      onClick={handleLoadMembers}
                      disabled={loadingMembers}
                      className="px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white text-slate-775 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                    >
                      {loadingMembers ? 'Carregando...' : 'Aplicar Filtros'}
                    </button>

                    {hasSearchedMembers && !loadingMembers && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-semibold">
                          🔍 {filteredMembers.length} membro(s) encontrado(s)
                        </span>
                        {filteredMembers.length > 0 && (
                          <button
                            type="button"
                            onClick={handleAddFilteredMembers}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <UsersRound className="h-3.5 w-3.5" />
                            Adicionar à Lista
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </Section>

                {/* Adicionar por Arquivo CSV e Manual */}
                <Section title="Importação de CSV e Textos">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Upload CSV */}
                    <div className="flex flex-col justify-center border-2 border-dashed border-slate-300 hover:border-slate-400 transition rounded-2xl p-6 text-center bg-slate-50">
                      <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 mb-1">Importar CSV ou TXT</p>
                      <p className="text-[10px] text-slate-500 mb-4">Arquivo com um nome por linha</p>
                      <label className="inline-flex justify-center px-4 py-2 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl text-xs font-bold transition cursor-pointer self-center">
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                        Selecionar Arquivo
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={handleCSVImport}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Inclusão Manual */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                          Ou Digite Manualmente (um nome por linha)
                        </label>
                        <textarea
                          rows={4}
                          value={manualNamesText}
                          onChange={e => setManualNamesText(e.target.value)}
                          placeholder="João da Silva&#10;Maria de Souza&#10;José Carlos"
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddManualNames}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          + Adicionar Nomes
                        </button>
                      </div>
                    </div>

                  </div>
                </Section>

                {/* Visualizar Participantes Carregados */}
                <Section title="Participantes Cadastrados">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 font-bold">Total: {participants.length}</span>
                    {participants.length > 0 && (
                      <button
                        onClick={handleClearParticipants}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Limpar tudo
                      </button>
                    )}
                  </div>
                  {participants.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Nenhum participante adicionado. Use os filtros do banco, faça upload de CSV ou cole manualmente.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-3 bg-slate-50 flex flex-wrap gap-2">
                      {participants.slice(0, 100).map((name, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                        >
                          👤 {name}
                          <button
                            onClick={() => setParticipants(prev => prev.filter(p => p !== name))}
                            className="text-slate-400 hover:text-slate-600 transition"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {participants.length > 100 && (
                        <span className="text-xs font-bold text-slate-500 py-1 pl-2">
                          e mais {participants.length - 100} participantes...
                        </span>
                      )}
                    </div>
                  )}
                </Section>

              </div>

              {/* Seção Direita: Brindes e Configuração */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Brindes */}
                <Section title="Brindes / Prêmios">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Liquidificador, Bíblia de Estudo..."
                      value={newPrizeText}
                      onChange={e => setNewPrizeText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddPrize()}
                      className="flex-1 border border-slate-350 rounded-xl px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddPrize}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                    {prizes.length === 0 ? (
                      <p className="text-slate-400 text-xs text-center py-4">Nenhum prêmio cadastrado.</p>
                    ) : (
                      prizes.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-750 font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-slate-800">{p.name}</span>
                          </div>
                          <button
                            onClick={() => handleRemovePrize(i)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </Section>

                {/* Configuração de Sorteio */}
                <Section title="Regra do Sorteio">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Quantidade de ganhadores por brinde
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={drawQuantity}
                      onChange={e => setDrawQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full border border-slate-350 rounded-xl px-3 py-2 text-sm bg-white"
                    />
                  </div>
                </Section>

                {/* Iniciar */}
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleStartRaffle}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trophy className="h-5 w-5" />
                    Iniciar Sorteio Oficial
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* ABA: RAFFLE */}
          {activeTab === 'raffle' && prizes.length > 0 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Section title="Extração de Prêmios">
                
                {/* Dots de progresso dos prêmios */}
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {prizes.map((p, idx) => {
                    const isCurrent = idx === currentPrizeIdx;
                    const isDone = p.winner !== null;
                    return (
                      <div
                        key={idx}
                        title={p.name}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          isCurrent
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse'
                            : isDone
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 text-slate-400 bg-slate-50'
                        }`}
                      >
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>

                <div className="text-center mb-6">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                    Sorteio em Andamento
                  </span>
                  <h2 className="text-xl font-bold text-slate-800 mt-2">
                    🎁 Prêmio: {prizes[currentPrizeIdx]?.name}
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Extraindo {drawQuantity} ganhador(es) para este brinde
                  </p>
                </div>

                {/* Janela de Slot Machine */}
                <div className="max-w-md mx-auto bg-slate-900 border-2 border-emerald-500/30 rounded-2xl p-4 shadow-xl mb-6 relative overflow-hidden">
                  <div className="h-40 overflow-hidden relative rounded-xl bg-slate-950 flex flex-col justify-center items-center">
                    
                    {/* Linhas indicadoras centrais */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-emerald-500/10 border-y border-emerald-500/30 pointer-events-none z-10" />

                    {/* Overlays de gradiente para dar profundidade de roda */}
                    <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none z-10" />
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none z-10" />

                    <div className="w-full text-center space-y-1">
                      {visibleNames.map((name, i) => {
                        const isCenter = i === Math.floor(visibleNames.length / 2);
                        return (
                          <div
                            key={i}
                            className={`text-sm font-bold transition-all duration-150 ${
                              isCenter
                                ? 'text-emerald-400 text-lg uppercase scale-110 tracking-wide font-extrabold'
                                : 'text-slate-600 opacity-40 blur-[0.5px]'
                            }`}
                          >
                            {name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Painel do Vencedor Revelado */}
                {lastWinnerName && !spinning && (
                  <div className="max-w-md mx-auto bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 text-center shadow-lg mb-6 animate-fade-in">
                    <div className="text-3xl mb-2">🏆</div>
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Ganhador Revelado!</div>
                    <div className="text-2xl font-black text-slate-800 leading-tight uppercase mb-3 break-words">
                      {lastWinnerName}
                    </div>
                    <div className="text-xs text-slate-500">
                      Prêmio: <strong className="text-emerald-700">{prizes[currentPrizeIdx]?.name}</strong>
                    </div>
                    {drawQuantity > 1 && (
                      <span className="inline-block mt-3 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Ganhador {currentWinnersForPrize.length} de {drawQuantity}
                      </span>
                    )}
                  </div>
                )}

                {/* Ações de Botões */}
                <div className="flex flex-wrap gap-3 justify-center">
                  
                  {/* Botão de Sortear */}
                  {currentWinnersForPrize.length < drawQuantity && (
                    <button
                      type="button"
                      onClick={handleDrawNow}
                      disabled={spinning}
                      className="px-6 py-3 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                    >
                      <Play className="h-4 w-4" />
                      {currentWinnersForPrize.length > 0
                        ? `Sortear Ganhador ${currentWinnersForPrize.length + 1}`
                        : 'Sortear Agora'}
                    </button>
                  )}

                  {/* Botão de Redesenhar (Ausente) */}
                  {lastWinnerName && !spinning && (
                    <button
                      type="button"
                      onClick={handleRedrawLastWinner}
                      className="px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserX className="h-4 w-4" />
                      Ausente (Sortear de Novo)
                    </button>
                  )}

                  {/* Próximo Brinde ou Concluir */}
                  {currentWinnersForPrize.length >= drawQuantity && (
                    <>
                      {currentPrizeIdx < prizes.length - 1 ? (
                        <button
                          type="button"
                          onClick={handleNextPrize}
                          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          Próximo Brinde
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleFinishRaffle}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Ver Resultados Finais
                        </button>
                      )}
                    </>
                  )}

                </div>

              </Section>
            </div>
          )}

          {/* ABA: RESULTADOS */}
          {activeTab === 'results' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Section title="🏅 Resultados Finais do Sorteio">
                <div className="divide-y divide-slate-100">
                  {winners.map((w, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-xl">🏆</span>
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {w.prize}
                        </span>
                        <span className="text-sm font-bold text-slate-800 uppercase">
                          {w.winner}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 justify-center pt-6 border-t border-slate-100 mt-6">
                  <button
                    type="button"
                    onClick={handlePrintResults}
                    className="px-6 py-3 border border-slate-350 hover:border-slate-400 bg-white text-slate-750 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir / Salvar PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Novo Sorteio
                  </button>
                </div>
              </Section>
            </div>
          )}
        </Tabs>
      </div>

      <NotificationModal
        isOpen={modalNotify.isOpen}
        title={modalNotify.title}
        message={modalNotify.message}
        type={modalNotify.type}
        onClose={() => setModalNotify(prev => ({ ...prev, isOpen: false }))}
      />
    </PageLayout>
  );
}
