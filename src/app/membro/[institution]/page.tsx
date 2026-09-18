'use client';

import { useState, useEffect, use } from 'react';
import {
  UserCheck,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ArrowLeft,
  Phone,
  MapPin,
  Heart,
  Briefcase,
  Sparkles,
  Camera,
  Upload,
  User,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Check,
  Crop,
  X,
  Church,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface PageProps {
  params: Promise<{
    institution: string;
  }>;
}

interface CongregacaoOption {
  id: string;
  nome: string;
}

interface MemberFormData {
  name: string;
  nome_pai: string;
  nome_mae: string;
  rg: string;
  data_batismo_aguas: string;
  email: string;
  phone: string;
  celular: string;
  whatsapp: string;
  data_nascimento: string;
  sexo: string;
  estado_civil: string;
  nome_conjuge: string;
  cpf_conjuge: string;
  data_nascimento_conjuge: string;
  profissao: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  estado: string;
  escolaridade: string;
  nacionalidade: string;
  naturalidade: string;
  uf_naturalidade: string;
  foto_url: string;
}

const EMPTY_FORM: MemberFormData = {
  name: '',
  nome_pai: '',
  nome_mae: '',
  rg: '',
  data_batismo_aguas: '',
  email: '',
  phone: '',
  celular: '',
  whatsapp: '',
  data_nascimento: '',
  sexo: '',
  estado_civil: '',
  nome_conjuge: '',
  cpf_conjuge: '',
  data_nascimento_conjuge: '',
  profissao: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  complemento: '',
  cidade: '',
  estado: '',
  escolaridade: '',
  nacionalidade: '',
  naturalidade: '',
  uf_naturalidade: '',
  foto_url: '',
};

function formatCpf(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCep(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function PublicMemberPage({ params }: PageProps) {
  const { institution } = use(params);

  // Estados institucionais (carregados via /info)
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [institutionName, setInstitutionName] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOption[]>([]);

  // Fluxo em 4 etapas: welcome -> congregacao -> cpf -> form -> success
  const [stage, setStage] = useState<'welcome' | 'congregacao' | 'cpf' | 'form' | 'success'>('welcome');
  const [selectedCongregacaoId, setSelectedCongregacaoId] = useState<string>('');
  const [cpf, setCpf] = useState('');
  const [isExisting, setIsExisting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<MemberFormData>(EMPTY_FORM);

  // Feedback States
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Crop Modal States
  const [fotoOriginal, setFotoOriginal] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Carregar dados institucionais e congregações da instituição
  useEffect(() => {
    let active = true;
    async function fetchInfo() {
      try {
        setLoadingInfo(true);
        const res = await fetch(`/api/v1/public/members/info?institution=${encodeURIComponent(institution)}`);
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setInstitutionName(data.institution_name || '');
          setLogoUrl(data.logo_url || null);
          const congs = Array.isArray(data.congregacoes) ? data.congregacoes : [];
          setCongregacoes(congs);
          if (congs.length === 1) {
            setSelectedCongregacaoId(congs[0].id);
          }
        } else {
          setErrorMessage(data.error || 'Instituição não encontrada.');
        }
      } catch {
        if (active) setErrorMessage('Erro ao carregar dados da instituição.');
      } finally {
        if (active) setLoadingInfo(false);
      }
    }
    fetchInfo();
    return () => {
      active = false;
    };
  }, [institution]);

  // Selecionar arquivo de foto para iniciar o ajuste/corte
  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Formato de foto inválido. Utilize JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('A imagem original não pode ultrapassar 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setFotoOriginal(evt.target.result as string);
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
        setShowCropModal(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Funções de Pan / Arrastar
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(Math.max(prev + delta, 1), 3.5));
  };

  // Crop & Upload
  const handleConfirmCropAndUpload = async () => {
    if (!fotoOriginal) return;

    try {
      setUploadingPhoto(true);
      setErrorMessage(null);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const targetWidth = 360;
      const targetHeight = 480;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = fotoOriginal;
      });

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      const canvasCoverScale = Math.max(targetWidth / img.width, targetHeight / img.height);
      const drawWidth = img.width * canvasCoverScale * zoom;
      const drawHeight = img.height * canvasCoverScale * zoom;

      const scaleFactor = targetWidth / 224;
      const offsetX = position.x * scaleFactor;
      const offsetY = position.y * scaleFactor;

      ctx.drawImage(
        img,
        -drawWidth / 2 + offsetX,
        -drawHeight / 2 + offsetY,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );

      if (!blob) {
        setErrorMessage('Falha ao processar enquadramento da foto.');
        return;
      }

      const formDataUpload = new FormData();
      formDataUpload.append('file', blob, 'foto-membro.jpg');
      formDataUpload.append('institution', institution);

      const res = await fetch('/api/v1/public/members/upload-photo', {
        method: 'POST',
        body: formDataUpload,
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error || 'Erro ao enviar a foto enquadrada.');
        return;
      }

      setFormData((prev) => ({
        ...prev,
        foto_url: json.url,
      }));

      setShowCropModal(false);
      setFotoOriginal(null);
    } catch (err: any) {
      console.error('Erro no crop/upload da foto:', err);
      setErrorMessage('Erro de conexão ao salvar a foto enquadrada.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Mascarar CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
    setErrorMessage(null);
  };

  // Buscar CEP via ViaCEP
  const handleCepBlur = async () => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      setSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch {
      // Permite preenchimento manual
    } finally {
      setSearchingCep(false);
    }
  };

  // Etapa 2 -> Etapa 3
  const handleProceedCongregacao = () => {
    if (!selectedCongregacaoId) {
      setErrorMessage('Selecione a congregação à qual você pertence.');
      return;
    }
    setErrorMessage(null);
    setStage('cpf');
  };

  // Etapa 3: Verificar CPF via /check
  const handleCheckCpf = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setErrorMessage('Informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!selectedCongregacaoId) {
      setErrorMessage('Selecione a sua congregação antes de prosseguir.');
      setStage('congregacao');
      return;
    }

    try {
      setChecking(true);
      setErrorMessage(null);

      const res = await fetch('/api/v1/public/members/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution,
          congregacao_id: selectedCongregacaoId,
          cpf: cleanCpf,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error || 'Falha ao consultar CPF. Tente novamente.');
        return;
      }

      if (json.institution_name) {
        setInstitutionName(json.institution_name);
      }

      setIsExisting(!!json.exists);
      setStage('form');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro de conexão ao servidor.');
    } finally {
      setChecking(false);
    }
  };

  // Etapa 4: Salvar ou Atualizar Dados na API pública
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setErrorMessage('Nome completo é obrigatório.');
      return;
    }

    if (!formData.nome_pai.trim()) {
      setErrorMessage('Nome do Pai é obrigatório.');
      return;
    }

    if (!formData.nome_mae.trim()) {
      setErrorMessage('Nome da Mãe é obrigatório.');
      return;
    }

    if (!formData.data_batismo_aguas) {
      setErrorMessage('Data de Batismo é obrigatória.');
      return;
    }

    if (!selectedCongregacaoId) {
      setErrorMessage('Selecione a congregação.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const payload = {
        institution,
        congregacao_id: selectedCongregacaoId,
        cpf: cpf.replace(/\D/g, ''),
        name: formData.name.trim(),
        nome_pai: formData.nome_pai.trim(),
        nome_mae: formData.nome_mae.trim(),
        rg: formData.rg.trim(),
        data_batismo_aguas: formData.data_batismo_aguas,
        email: formData.email.trim(),
        phone: formData.phone.replace(/\D/g, ''),
        celular: formData.celular.replace(/\D/g, ''),
        whatsapp: formData.whatsapp.replace(/\D/g, ''),
        data_nascimento: formData.data_nascimento,
        sexo: formData.sexo,
        estado_civil: formData.estado_civil,
        nome_conjuge: formData.nome_conjuge.trim(),
        cpf_conjuge: formData.cpf_conjuge.replace(/\D/g, ''),
        data_nascimento_conjuge: formData.data_nascimento_conjuge,
        profissao: formData.profissao.trim(),
        cep: formData.cep.replace(/\D/g, ''),
        logradouro: formData.logradouro.trim(),
        numero: formData.numero.trim(),
        bairro: formData.bairro.trim(),
        complemento: formData.complemento.trim(),
        cidade: formData.cidade.trim(),
        estado: formData.estado.toUpperCase().trim(),
        escolaridade: formData.escolaridade,
        nacionalidade: formData.nacionalidade.trim(),
        naturalidade: formData.naturalidade.trim(),
        uf_naturalidade: formData.uf_naturalidade.toUpperCase().trim(),
        foto_url: formData.foto_url,
      };

      const res = await fetch('/api/v1/public/members/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error || 'Falha ao salvar dados. Tente novamente.');
        return;
      }

      setSuccessMessage(
        json.action === 'updated'
          ? 'Cadastro atualizado com sucesso!'
          : 'Cadastro realizado com sucesso!'
      );
      setStage('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro de conexão ao salvar cadastro.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCpf('');
    setFormData(EMPTY_FORM);
    setErrorMessage(null);
    setSuccessMessage('');
    setStage('welcome');
  };

  const selectedCongregacaoNome = congregacoes.find((c) => c.id === selectedCongregacaoId)?.nome || '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-6 px-4 sm:px-6 font-sans">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* Cabeçalho Institucional com Logo Dinâmica do Tenant */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white border border-slate-200 shadow-md p-1.5 mb-1 mx-auto overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={institutionName || 'Logo'}
                className="h-full w-full object-contain rounded-xl"
              />
            ) : (
              <div className="h-full w-full rounded-xl bg-[#123b63] text-white flex items-center justify-center">
                <Building2 className="h-7 w-7 text-white" />
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            {institutionName || 'Gestão Eklésia'}
          </h1>
          <p className="text-xs font-semibold text-[#123b63] bg-blue-50 border border-blue-100 rounded-full px-3 py-1 inline-block">
            Portal de Atualização Cadastral
          </p>
        </div>

        {/* ERRO GLOBAL BANNER */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 text-sm shadow-sm animate-in fade-in">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* ETAPA 1: BOAS-VINDAS */}
        {stage === 'welcome' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 text-center animate-in fade-in">
            <div className="space-y-3">
              <div className="inline-flex p-3 rounded-full bg-blue-50 text-[#123b63] border border-blue-100">
                <Church className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800">
                Bem-vindo ao seu Cadastro
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Este formulário é utilizado pela secretaria da <strong className="text-slate-800">{institutionName || 'igreja'}</strong> para atualização ou inclusão dos seus dados na base oficial de membros.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-left space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <span>Cadastro Seguro e Confidencial</span>
              </div>
              <p>
                Suas informações serão armazenadas de forma segura e utilizadas estritamente para o registro eclesiástico oficial.
              </p>
            </div>

            <button
              type="button"
              disabled={loadingInfo}
              onClick={() => {
                setErrorMessage(null);
                setStage('congregacao');
              }}
              className="w-full py-3.5 px-4 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl shadow-lg shadow-[#123b63]/25 active:scale-[0.99] transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loadingInfo ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando informações...
                </>
              ) : (
                <>
                  Começar Cadastro
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ETAPA 2: CONGREGAÇÃO */}
        {stage === 'congregacao' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStage('welcome');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <span className="text-xs font-semibold text-slate-400">Passo 1 de 3</span>
            </div>

            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold text-slate-800">
                Qual congregação você pertence?
              </h2>
              <p className="text-xs text-slate-500">
                Selecione a sua congregação pertencente a {institutionName || 'esta igreja'}.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Congregação *
                </label>
                <select
                  value={selectedCongregacaoId}
                  onChange={(e) => {
                    setSelectedCongregacaoId(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 text-slate-800 text-sm font-medium outline-none transition bg-white"
                >
                  <option value="">-- Selecione sua congregação --</option>
                  {congregacoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={!selectedCongregacaoId}
                onClick={handleProceedCongregacao}
                className="w-full py-3.5 px-4 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl shadow-lg shadow-[#123b63]/25 active:scale-[0.99] transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3: CPF */}
        {stage === 'cpf' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStage('congregacao');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <span className="text-xs font-semibold text-slate-400">Passo 2 de 3</span>
            </div>

            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold text-slate-800">Identificação por CPF</h2>
              <p className="text-xs text-slate-500">
                Informe o seu CPF para identificarmos seu cadastro na congregação <strong className="text-slate-700">{selectedCongregacaoNome}</strong>.
              </p>
            </div>

            <form onSubmit={handleCheckCpf} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  CPF *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    maxLength={14}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 text-slate-800 text-base font-medium outline-none transition"
                  />
                  <Search className="h-5 w-5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={checking || cpf.replace(/\D/g, '').length !== 11}
                className="w-full py-3.5 px-4 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl shadow-lg shadow-[#123b63]/25 active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {checking ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    Avançar para o Formulário
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Seus dados estão protegidos conforme as regras de privacidade da instituição.
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 4: FORMULÁRIO DE CADASTRO OU ATUALIZAÇÃO */}
        {stage === 'form' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-6 animate-in fade-in">
            
            {/* Header de navegação e resumo */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStage('cpf');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Alterar CPF / Congregação
              </button>
              <span className="text-xs font-semibold text-slate-400">Passo 3 de 3</span>
            </div>

            {/* Banner de status do CPF */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              isExisting 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="flex items-center gap-2">
                {isExisting ? (
                  <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <UserPlus className="h-4 w-4 text-blue-600 shrink-0" />
                )}
                <span>
                  {isExisting
                    ? 'Cadastro localizado. Preencha seus dados para atualizar sua ficha.'
                    : 'Vamos iniciar seu cadastro.'}
                </span>
              </div>
            </div>

            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700">Congregação:</span> {selectedCongregacaoNome}
              </div>
              <div className="font-mono font-medium text-slate-700">
                {cpf}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              
              {/* ── 1. DADOS PESSOAIS & FOTO ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-[#123b63]">
                  <User className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">1. Dados Pessoais</h3>
                </div>

                {/* Upload e Preview de Foto 3x4 */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                  <div className="relative w-24 h-32 bg-slate-200 rounded-lg overflow-hidden border-2 border-slate-300 flex items-center justify-center shrink-0 shadow-inner">
                    {formData.foto_url ? (
                      <img src={formData.foto_url} alt="Foto Membro" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <Camera className="h-7 w-7 mb-1" />
                        <span className="text-[10px] font-semibold">Foto 3x4</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Foto de Perfil (Opcional)</p>
                    <p className="text-[11px] text-slate-500">
                      Tire uma foto ou escolha uma imagem para sua ficha e carteirinha de membro.
                    </p>
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{formData.foto_url ? 'Alterar Foto' : 'Selecionar Foto'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleSelectFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sexo
                    </label>
                    <select
                      value={formData.sexo}
                      onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none bg-white"
                    >
                      <option value="">Selecione</option>
                      <option value="MASCULINO">MASCULINO</option>
                      <option value="FEMININO">FEMININO</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── 2. FILIAÇÃO E DADOS ECLESIÁSTICOS ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-[#123b63]">
                  <FileText className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">2. Filiação e Dados Eclesiásticos</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Pai *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo do pai"
                    value={formData.nome_pai}
                    onChange={(e) => setFormData({ ...formData, nome_pai: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Mãe *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo da mãe"
                    value={formData.nome_mae}
                    onChange={(e) => setFormData({ ...formData, nome_mae: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      RG (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Número do RG"
                      value={formData.rg}
                      onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Data de Batismo nas Águas *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.data_batismo_aguas}
                      onChange={(e) => setFormData({ ...formData, data_batismo_aguas: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* ── 3. CONTATOS ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-[#123b63]">
                  <Phone className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">3. Contato</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp / Celular
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="(00) 00000-0000"
                      value={formData.whatsapp || formData.celular}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        setFormData({ ...formData, whatsapp: formatted, celular: formatted });
                      }}
                      maxLength={15}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telefone Fixo
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="(00) 0000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                      maxLength={15}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                  />
                </div>
              </div>

              {/* ── 4. ENDEREÇO RESIDENCIAL ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-[#123b63]">
                  <MapPin className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">4. Endereço Residencial</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CEP
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: formatCep(e.target.value) })}
                        onBlur={handleCepBlur}
                        maxLength={9}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                      />
                      {searchingCep && (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400 absolute right-3 top-3" />
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Logradouro (Rua / Av.)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Rua das Flores"
                      value={formData.logradouro}
                      onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Número
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Centro"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Complemento
                    </label>
                    <input
                      type="text"
                      placeholder="Apto, Bloco..."
                      value={formData.complemento}
                      onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      placeholder="Cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      UF
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="UF"
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* ── 5. FAMÍLIA & ESTADO CIVIL ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-[#123b63]">
                  <Heart className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">5. Família & Estado Civil</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado Civil
                  </label>
                  <select
                    value={formData.estado_civil}
                    onChange={(e) => setFormData({ ...formData, estado_civil: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none bg-white"
                  >
                    <option value="">Selecione</option>
                    <option value="SOLTEIRO(A)">SOLTEIRO(A)</option>
                    <option value="CASADO(A)">CASADO(A)</option>
                    <option value="DIVORCIADO(A)">DIVORCIADO(A)</option>
                    <option value="VIUVO(A)">VIÚVO(A)</option>
                    <option value="UNIAO_ESTAVEL">UNIÃO ESTÁVEL</option>
                  </select>
                </div>

                {formData.estado_civil === 'CASADO(A)' && (
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome do Cônjuge
                      </label>
                      <input
                        type="text"
                        placeholder="Nome completo do cônjuge"
                        value={formData.nome_conjuge}
                        onChange={(e) => setFormData({ ...formData, nome_conjuge: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          CPF do Cônjuge
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="000.000.000-00"
                          value={formData.cpf_conjuge}
                          onChange={(e) => setFormData({ ...formData, cpf_conjuge: formatCpf(e.target.value) })}
                          maxLength={14}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nascimento do Cônjuge
                        </label>
                        <input
                          type="date"
                          value={formData.data_nascimento_conjuge}
                          onChange={(e) => setFormData({ ...formData, data_nascimento_conjuge: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── 6. PROFISSÃO & ESCOLARIDADE ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-[#123b63]">
                  <Briefcase className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">6. Profissão & Escolaridade</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Profissão
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Professor, Comerciante..."
                      value={formData.profissao}
                      onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Escolaridade
                    </label>
                    <select
                      value={formData.escolaridade}
                      onChange={(e) => setFormData({ ...formData, escolaridade: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none bg-white"
                    >
                      <option value="">Selecione</option>
                      <option value="ENSINO_FUNDAMENTAL">ENSINO FUNDAMENTAL</option>
                      <option value="ENSINO_MEDIO">ENSINO MÉDIO</option>
                      <option value="ENSINO_SUPERIOR">ENSINO SUPERIOR</option>
                      <option value="POS_GRADUACAO">PÓS-GRADUAÇÃO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nacionalidade
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: BRASILEIRA"
                      value={formData.nacionalidade}
                      onChange={(e) => setFormData({ ...formData, nacionalidade: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Naturalidade
                    </label>
                    <input
                      type="text"
                      placeholder="Cidade onde nasceu"
                      value={formData.naturalidade}
                      onChange={(e) => setFormData({ ...formData, naturalidade: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      UF Naturalidade
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="UF"
                      value={formData.uf_naturalidade}
                      onChange={(e) => setFormData({ ...formData, uf_naturalidade: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 outline-none uppercase text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStage('cpf')}
                  className="w-full sm:w-1/3 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-sm text-center"
                >
                  Voltar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-2/3 py-3.5 px-4 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl shadow-lg shadow-[#123b63]/25 active:scale-[0.99] transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Salvando dados...
                    </>
                  ) : (
                    <>
                      {isExisting ? 'Atualizar Meu Cadastro' : 'Finalizar Cadastro'}
                      <CheckCircle2 className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TELA DE SUCESSO */}
        {stage === 'success' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-800">
                {successMessage || 'Dados Salvos com Sucesso!'}
              </h2>
              <p className="text-sm text-slate-600">
                Agradecemos por atualizar suas informações junto à secretaria da <strong>{institutionName}</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1 text-left">
              <p>
                <strong>Congregação:</strong> {selectedCongregacaoNome}
              </p>
              <p>
                <strong>Membro:</strong> {formData.name}
              </p>
              <p>
                <strong>CPF:</strong> {cpf}
              </p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
            >
              Novo Preenchimento
            </button>
          </div>
        )}

      </div>

      {/* MODAL DE ENQUADRAMENTO E CORTE DA FOTO (3x4) */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Crop className="h-4 w-4 text-[#123b63]" />
                <span>Ajustar Foto 3x4</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCropModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Viewport de Crop (Proporção 3:4) */}
            <div
              className="relative w-56 h-72 mx-auto bg-slate-900 rounded-xl overflow-hidden border-2 border-[#123b63] shadow-lg select-none cursor-grab active:cursor-grabbing touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              onWheel={handleWheel}
            >
              {fotoOriginal && (
                <img
                  src={fotoOriginal}
                  alt="Ajuste de Foto"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                  className="w-full h-full object-cover pointer-events-none transition-transform duration-75"
                />
              )}
              {/* Overlay de Máscara de Enquadramento */}
              <div className="absolute inset-0 border border-white/40 pointer-events-none grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/20"></div>
                <div className="border-r border-b border-white/20"></div>
                <div className="border-b border-white/20"></div>
                <div className="border-r border-b border-white/20"></div>
                <div className="border-r border-b border-white/20"></div>
                <div className="border-b border-white/20"></div>
                <div className="border-r border-white/20"></div>
                <div className="border-r border-white/20"></div>
                <div></div>
              </div>
            </div>

            {/* Controles de Zoom e Rotação */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.2, 1))}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-slate-600 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90) % 360)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  title="Girar Esquerda"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  title="Girar Direita"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCropModal(false)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={handleConfirmCropAndUpload}
                  className="flex-1 py-2.5 px-3 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Confirmar Foto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
