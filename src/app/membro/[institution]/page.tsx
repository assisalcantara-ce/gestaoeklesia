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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

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
                  <span>Dados Pessoais</span>
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

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">CEP</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: formatCep(e.target.value) })}
                        onBlur={handleCepBlur}
                        maxLength={9}
                        className="w-full pl-3 pr-9 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#123b63]"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          // Blur no input ativo para remover o foco e disparar a busca
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                          handleCepBlur();
                        }}
                        disabled={searchingCep || formData.cep.replace(/\D/g, '').length !== 8}
                        title="Buscar endereço pelo CEP"
                        className="absolute right-1.5 p-1.5 text-slate-400 hover:text-[#123b63] hover:bg-slate-100 rounded-lg transition active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {searchingCep ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#123b63]" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
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
    </div>
  );
}
