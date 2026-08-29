'use client';

import { useState, use } from 'react';
import {
  UserCheck,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ArrowLeft,
  Lock,
  Phone,
  Mail,
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
} from 'lucide-react';

interface PageProps {
  params: Promise<{
    institution: string;
  }>;
}

interface MemberFormData {
  name: string;
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

  // Estados principais da página
  const [cpf, setCpf] = useState('');
  const [stage, setStage] = useState<'search' | 'form' | 'success'>('search');
  const [isExisting, setIsExisting] = useState(false);
  const [institutionName, setInstitutionName] = useState<string>('');
  
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
    // Reset do input file para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  // Funções de interação de Pan/Arrastar na foto
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

  // Suporte a Touch para Smartphones (Mobile-first)
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

  // Gerar o Canvas final enquadrado (300x400 px padrão 3x4) e subir para o storage
  const handleConfirmCropAndUpload = async () => {
    if (!fotoOriginal) return;

    try {
      setUploadingPhoto(true);
      setErrorMessage(null);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Resolução padrão do avatar/credencial (300x400 px)
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

      // Fundo neutro
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      // Mover origem para o centro do canvas (180, 240)
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Proporção de escala cover da imagem para caber no Canvas de 360x480 (3:4):
      const canvasCoverScale = Math.max(targetWidth / img.width, targetHeight / img.height);

      // Largura e altura desenhadas com zoom
      const drawWidth = img.width * canvasCoverScale * zoom;
      const drawHeight = img.height * canvasCoverScale * zoom;

      // Na preview, a div tem 224px de largura e o canvas tem 360px.
      // O fator de escala dos controles em relação ao canvas é (360 / 224)
      const scaleFactor = targetWidth / 224;

      // No CSS transform, quando a imagem está rotacionada ou ampliada (scale(zoom)),
      // o translateX e translateY aplicados em pixels do preview são multiplicados pelo fator de tela e pelo zoom da imagem.
      const offsetX = position.x * scaleFactor;
      const offsetY = position.y * scaleFactor;

      // Desenhar centralizado com o deslocamento exato
      ctx.drawImage(
        img,
        -drawWidth / 2 + offsetX,
        -drawHeight / 2 + offsetY,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      // Converter o canvas processado para Blob PNG/JPEG
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );

      if (!blob) {
        setErrorMessage('Falha ao processar enquadramento da foto.');
        return;
      }

      // Enviar Blob via FormData para a API pública
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

  // Mascarar CPF no input
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
      // Ignora falha de busca de CEP e permite preenchimento manual
    } finally {
      setSearchingCep(false);
    }
  };

  // Passo 1: Verificar CPF na API pública
  const handleCheckCpf = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setErrorMessage('Informe um CPF válido com 11 dígitos.');
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

      if (json.exists && json.data) {
        setIsExisting(true);
        setFormData({
          name: json.data.name || '',
          email: json.data.email || '',
          phone: json.data.phone ? formatPhone(json.data.phone) : '',
          celular: json.data.celular ? formatPhone(json.data.celular) : '',
          whatsapp: json.data.whatsapp ? formatPhone(json.data.whatsapp) : '',
          data_nascimento: json.data.data_nascimento || '',
          sexo: json.data.sexo || '',
          estado_civil: json.data.estado_civil || '',
          nome_conjuge: json.data.nome_conjuge || '',
          cpf_conjuge: json.data.cpf_conjuge ? formatCpf(json.data.cpf_conjuge) : '',
          data_nascimento_conjuge: json.data.data_nascimento_conjuge || '',
          profissao: json.data.profissao || '',
          cep: json.data.cep ? formatCep(json.data.cep) : '',
          logradouro: json.data.logradouro || '',
          numero: json.data.numero || '',
          bairro: json.data.bairro || '',
          complemento: json.data.complemento || '',
          cidade: json.data.cidade || '',
          estado: json.data.estado || '',
          escolaridade: json.data.escolaridade || '',
          nacionalidade: json.data.nacionalidade || '',
          naturalidade: json.data.naturalidade || '',
          uf_naturalidade: json.data.uf_naturalidade || '',
          foto_url: json.data.foto_url || '',
        });
      } else {
        setIsExisting(false);
        setFormData(EMPTY_FORM);
      }

      setStage('form');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro de conexão ao servidor.');
    } finally {
      setChecking(false);
    }
  };

  // Passo 2: Salvar ou Atualizar Dados na API pública
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isExisting && !formData.name.trim()) {
      setErrorMessage('Nome completo é obrigatório para novos cadastros.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const payload = {
        institution,
        cpf: cpf.replace(/\D/g, ''),
        name: formData.name.trim(),
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
    setStage('search');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-6 px-4 sm:px-6 font-sans">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* Cabeçalho da Marca Gestão Eklésia / Instituição */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#123b63] text-white shadow-lg shadow-[#123b63]/20 mb-1">
            <Building2 className="h-7 w-7" />
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

        {/* TELA 1: CONSULTA DE CPF */}
        {stage === 'search' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold text-slate-800">Identificação do Membro</h2>
              <p className="text-xs text-slate-500">
                Informe o seu CPF para iniciar ou atualizar o seu cadastro na igreja.
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
                    Consultando CPF...
                  </>
                ) : (
                  <>
                    Continuar
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

        {/* TELA 2: FORMULÁRIO DE CADASTRO OU ATUALIZAÇÃO */}
        {stage === 'form' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-6">
            
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
                  {isExisting ? 'Cadastro localizado!' : 'Novo cadastro'}
                </span>
              </div>
              <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                CPF: {cpf}
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              
              {/* BLOCO 1: DADOS PESSOAIS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#123b63] border-b pb-1.5 uppercase tracking-wider">
                  <UserCheck className="h-4 w-4" />
                  <span>Dados Pessoais & Foto</span>
                </div>

                {/* UPLOAD / EXIBIÇÃO DA FOTO DE PERFIL */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="relative group shrink-0">
                    <div className="w-24 h-32 rounded-2xl overflow-hidden bg-slate-200 border-2 border-[#123b63]/30 shadow-md flex items-center justify-center relative">
                      {formData.foto_url ? (
                        <img
                          src={formData.foto_url}
                          alt="Foto de perfil do membro"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-12 h-12 text-slate-400" />
                      )}
                      
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>

                    <label className="absolute -bottom-2 -right-2 p-2 bg-[#123b63] hover:bg-[#0d2a47] text-white rounded-xl shadow-lg cursor-pointer transition active:scale-95">
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleSelectFile}
                        disabled={uploadingPhoto}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="text-center sm:text-left space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Foto de Perfil
                    </h4>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Selecione a foto do celular e ajuste o enquadramento perfeito (JPG, PNG ou WEBP até 10MB).
                    </p>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#123b63] hover:underline cursor-pointer pt-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formData.foto_url ? 'Alterar foto de perfil' : 'Enviar e ajustar foto'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleSelectFile}
                        disabled={uploadingPhoto}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Nome Completo {isExisting ? '(Protegido)' : '*'}
                  </label>
                  {isExisting ? (
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        value={formData.name}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm cursor-not-allowed"
                      />
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Seu nome completo"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 text-sm outline-none font-medium"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:border-[#123b63] text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Sexo</label>
                    <select
                      value={formData.sexo}
                      onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:border-[#123b63] text-sm bg-white outline-none"
                    >
                      <option value="">Selecione...</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMININO">Feminino</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nacionalidade</label>
                    <input
                      type="text"
                      placeholder="Ex: BRASILEIRA"
                      value={formData.nacionalidade}
                      onChange={(e) => setFormData({ ...formData, nacionalidade: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Naturalidade / UF</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Cidade"
                        value={formData.naturalidade}
                        onChange={(e) => setFormData({ ...formData, naturalidade: e.target.value })}
                        className="col-span-2 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none min-w-0"
                      />
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="UF"
                        value={formData.uf_naturalidade}
                        onChange={(e) => setFormData({ ...formData, uf_naturalidade: e.target.value.toUpperCase() })}
                        className="col-span-1 w-full px-2 py-2.5 border border-slate-300 rounded-xl text-sm uppercase text-center outline-none min-w-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO 2: CONTATO */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs font-bold text-[#123b63] border-b pb-1.5 uppercase tracking-wider">
                  <Phone className="h-4 w-4" />
                  <span>Contato</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">E-mail</label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="seuemail@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Celular / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(00) 90000-0000"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: formatPhone(e.target.value) })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Telefone Fixo / Recado</label>
                    <input
                      type="text"
                      placeholder="(00) 0000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 3: ENDEREÇO */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#123b63] uppercase tracking-wider">
                    <MapPin className="h-4 w-4" />
                    <span>Endereço Residencial</span>
                  </div>
                  {searchingCep && (
                    <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Buscando CEP...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="col-span-1 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">CEP</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: formatCep(e.target.value) })}
                        onBlur={handleCepBlur}
                        maxLength={9}
                        className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#123b63]"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                          handleCepBlur();
                        }}
                        disabled={searchingCep || formData.cep.replace(/\D/g, '').length !== 8}
                        title="Buscar CEP"
                        className="px-3 py-2.5 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {searchingCep ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Logradouro / Rua</label>
                    <input
                      type="text"
                      placeholder="Rua, Avenida, Praça..."
                      value={formData.logradouro}
                      onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Número</label>
                    <input
                      type="text"
                      placeholder="123"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Bairro</label>
                    <input
                      type="text"
                      placeholder="Bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label>
                    <input
                      type="text"
                      placeholder="Cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Estado (UF)</label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="UF"
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm uppercase text-center outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Complemento</label>
                  <input
                    type="text"
                    placeholder="Apto, Bloco, Casa B..."
                    value={formData.complemento}
                    onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              {/* BLOCO 4: FAMÍLIA E ESTADO CIVIL */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs font-bold text-[#123b63] border-b pb-1.5 uppercase tracking-wider">
                  <Heart className="h-4 w-4" />
                  <span>Família & Estado Civil</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Estado Civil</label>
                    <select
                      value={formData.estado_civil}
                      onChange={(e) => setFormData({ ...formData, estado_civil: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none"
                    >
                      <option value="">Selecione...</option>
                      <option value="SOLTEIRO">Solteiro(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUVO">Viúvo(a)</option>
                      <option value="UNIAO_ESTAVEL">União Estável</option>
                    </select>
                  </div>

                  {formData.estado_civil === 'CASADO' || formData.estado_civil === 'UNIAO_ESTAVEL' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Nome do Cônjuge</label>
                      <input
                        type="text"
                        placeholder="Nome do esposo(a)"
                        value={formData.nome_conjuge}
                        onChange={(e) => setFormData({ ...formData, nome_conjuge: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* BLOCO 5: PROFISSÃO E ESCOLARIDADE */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs font-bold text-[#123b63] border-b pb-1.5 uppercase tracking-wider">
                  <Briefcase className="h-4 w-4" />
                  <span>Profissão & Escolaridade</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Profissão / Ocupação</label>
                    <input
                      type="text"
                      placeholder="Sua profissão"
                      value={formData.profissao}
                      onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Escolaridade</label>
                    <select
                      value={formData.escolaridade}
                      onChange={(e) => setFormData({ ...formData, escolaridade: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none"
                    >
                      <option value="">Selecione...</option>
                      <option value="FUNDAMENTAL">Ensino Fundamental</option>
                      <option value="MEDIO">Ensino Médio</option>
                      <option value="SUPERIOR">Ensino Superior</option>
                      <option value="POS_GRADUACAO">Pós-Graduação / Especialização</option>
                      <option value="MESTRADO_DOUTORADO">Mestrado / Doutorado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="pt-4 space-y-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 active:scale-[0.99] transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Salvando dados...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      {isExisting ? 'Atualizar cadastro' : 'Finalizar cadastro'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStage('search')}
                  disabled={saving}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar e consultar outro CPF
                </button>
              </div>

            </form>
          </div>
        )}

        {/* TELA 3: SUCESSO CONFIRMAÇÃO */}
        {stage === 'success' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-5 animate-in zoom-in-95">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800">
                {successMessage}
              </h2>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Suas informações foram registradas com segurança no sistema da igreja.
              </p>
            </div>

            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3 px-4 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl text-sm shadow-md transition"
              >
                Concluir
              </button>
            </div>
          </div>
        )}

        {/* Rodapé institucional */}
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium text-slate-400">
            © Gestão Eklésia — Plataforma de Gestão Eclesiástica
          </p>
        </div>

      </div>

      {/* ── MODAL INTERATIVO DE CORTE E ENQUADRAMENTO DA FOTO (MOBILE & DESKTOP) ── */}
      {showCropModal && fotoOriginal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            
            {/* Header do Modal de Corte */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#123b63]/10 text-[#123b63]">
                  <Crop className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-800">Enquadrar Foto de Perfil</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setFotoOriginal(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ÁREA DE CROP INTERATIVA COM CANVAS / TOUCH / MOUSE */}
            <div className="p-5 space-y-4 text-center bg-slate-100/60">
              <p className="text-xs text-slate-500 font-medium">
                Arraste a imagem para centralizar o rosto no enquadramento
              </p>

              {/* Viewport do Crop (3:4 ratio) */}
              <div className="flex justify-center">
                <div
                  className="relative w-56 h-72 rounded-2xl overflow-hidden bg-slate-900 border-4 border-[#123b63] shadow-2xl cursor-grab active:cursor-grabbing select-none touch-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                  onWheel={handleWheel}
                >
                  <div className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                      src={fotoOriginal}
                      alt="Ajuste de enquadramento da foto"
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                        transformOrigin: 'center',
                        transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                      }}
                    />
                  </div>

                  {/* Guia de enquadramento facial tipo oval/3x4 */}
                  <div className="absolute inset-0 border-2 border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-52 border border-dashed border-white/60 rounded-full opacity-60"></div>
                  </div>
                </div>
              </div>

              {/* CONTROLES DE ZOOM E ROTAÇÃO */}
              <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 text-left">
                {/* Controle de Zoom */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5 text-[#123b63]" />
                      <span>Zoom: {zoom.toFixed(1)}x</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(z - 0.15, 0.6))}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min="0.6"
                      max="3.5"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="flex-1 accent-[#123b63] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(z + 0.15, 3.5))}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Controle de Posição / Ajuste Fino */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Ajustar posição:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPosition((p) => ({ ...p, y: p.y - 30 }))}
                      title="Mover para cima"
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosition((p) => ({ ...p, y: p.y + 30 }))}
                      title="Mover para baixo (descer foto)"
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosition((p) => ({ ...p, x: p.x - 30 }))}
                      title="Mover para esquerda"
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosition((p) => ({ ...p, x: p.x + 30 }))}
                      title="Mover para direita"
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosition({ x: 0, y: 0 })}
                      title="Centralizar foto"
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded ml-1"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Controle de Rotação */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Girar foto:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r - 90) % 360)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> 90° Esq
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> 90° Dir
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Rodapé com Ação de Confirmar Enquadramento */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setFotoOriginal(null);
                }}
                disabled={uploadingPhoto}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmCropAndUpload}
                disabled={uploadingPhoto}
                className="flex-1 py-2.5 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Confirmar Foto
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
