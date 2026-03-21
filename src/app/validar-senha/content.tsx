'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validarToken, removerTokenValidacao } from '@/lib/email-service';
import { ministeriiosSimulados } from '@/config/mock-data';

export default function ValidarSenhaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const ministryId = searchParams.get('ministry_id');
  const token = searchParams.get('token');
  
  const [etapa, setEtapa] = useState<'validando' | 'formulario' | 'sucesso' | 'erro'>('validando');
  const [nomeMinisterio, setNomeMinisterio] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [nova_senha, setNovaSenha] = useState('');
  const [confirmar_senha, setConfirmarSenha] = useState('');
  const [mensagem_erro, setMensagemErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // Validar token
    if (!ministryId || !token) {
      setMensagemErro('Link inválido ou expirado. Parâmetros ausentes.');
      setEtapa('erro');
      return;
    }

    if (!validarToken(ministryId, token)) {
      setMensagemErro('Link expirado ou inválido. Por favor, solicite um novo email de confirmação.');
      setEtapa('erro');
      return;
    }

    // Buscar informações do ministério
    const ministry = ministeriiosSimulados.find(m => m.id === ministryId);
    if (!ministry) {
      setMensagemErro('Ministério não encontrado.');
      setEtapa('erro');
      return;
    }

    setNomeMinisterio(ministry.nome);
    setEmailAdmin(ministry.email_admin);
    setEtapa('formulario');
  }, [ministryId, token]);

  const validarSenha = (senha: string): { valida: boolean; mensagens: string[] } => {
    const mensagens: string[] = [];

    if (senha.length < 6) {
      mensagens.push('❌ Mínimo de 6 caracteres');
    } else {
      mensagens.push('✅ Mínimo de 6 caracteres');
    }

    if (/[A-Z]/.test(senha)) {
      mensagens.push('✅ Contém letra maiúscula');
    } else {
      mensagens.push('❌ Contém letra maiúscula');
    }

    if (/[0-9]/.test(senha)) {
      mensagens.push('✅ Contém número');
    } else {
      mensagens.push('❌ Contém número');
    }

    return {
      valida: mensagens.filter(m => m.startsWith('✅')).length >= 3 && senha.length >= 6,
      mensagens
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro('');

    // Validação básica
    if (!nova_senha.trim()) {
      setMensagemErro('Por favor, insira uma senha');
      return;
    }

    const validacao = validarSenha(nova_senha);
    if (!validacao.valida) {
      setMensagemErro('A senha não atende aos critérios de segurança');
      return;
    }

    if (nova_senha !== confirmar_senha) {
      setMensagemErro('As senhas não coincidem');
      return;
    }

    setCarregando(true);

    try {
      // Simular salvamento da senha (em produção seria API)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Remover token após uso
      removerTokenValidacao(token!);

      // Mostrar sucesso
      setEtapa('sucesso');

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (erro) {
      setMensagemErro('Erro ao salvar senha. Tente novamente.');
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#123b63] to-[#0284c7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ETAPA: VALIDANDO */}
        {etapa === 'validando' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="animate-spin w-16 h-16 border-4 border-[#0284c7] border-t-green-500 rounded-full mx-auto mb-6"></div>
            <p className="text-[#123b63] font-semibold">Validando link...</p>
            <p className="text-sm text-gray-600 mt-2">Por favor, aguarde</p>
          </div>
        )}

        {/* ETAPA: FORMULÁRIO */}
        {etapa === 'formulario' && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="bg-gradient-to-r from-[#123b63] to-[#0284c7] px-8 py-10 text-center">
              <div className="text-5xl mb-4">🔐</div>
              <h1 className="text-3xl font-bold text-white mb-2">Validar Senha</h1>
              <p className="text-blue-100">Crie uma senha segura para acessar o sistema</p>
            </div>

            {/* CONTEÚDO */}
            <div className="p-8">
              <div className="bg-blue-50 rounded-lg p-4 mb-6 border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-2">Ministério:</p>
                <p className="text-lg font-bold text-[#123b63]">{nomeMinisterio}</p>
                <p className="text-xs text-gray-600 mt-2">Email: {emailAdmin}</p>
              </div>

              {mensagem_erro && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                  <p className="text-red-700 font-semibold text-sm">{mensagem_erro}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* NOVA SENHA */}
                <div>
                  <label className="block text-sm font-semibold text-[#123b63] mb-2">
                    Nova Senha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={nova_senha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Digite uma senha segura"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#0284c7] focus:bg-blue-50 focus:outline-none text-sm transition"
                  />
                </div>

                {/* CRITÉRIOS DE SENHA */}
                {nova_senha && (
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#0284c7]">
                    <p className="text-xs font-bold text-[#123b63] mb-3">Requisitos de segurança:</p>
                    <div className="space-y-2">
                      {validarSenha(nova_senha).mensagens.map((msg, idx) => (
                        <p key={idx} className="text-xs text-gray-700">{msg}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* CONFIRMAR SENHA */}
                <div>
                  <label className="block text-sm font-semibold text-[#123b63] mb-2">
                    Confirmar Senha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmar_senha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Confirme sua senha"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#0284c7] focus:bg-blue-50 focus:outline-none text-sm transition"
                  />
                </div>

                {/* BOTÕES */}
                <button
                  type="submit"
                  disabled={carregando || !nova_senha || !confirmar_senha}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 transition font-bold mt-6"
                >
                  {carregando ? '⏳ Salvando...' : '✅ Validar Senha'}
                </button>
              </form>

              <p className="text-xs text-gray-600 text-center mt-4">
                Sua senha será criptografada e armazenada com segurança
              </p>
            </div>
          </div>
        )}

        {/* ETAPA: SUCESSO */}
        {etapa === 'sucesso' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-6xl mb-4 animate-bounce">✅</div>
            <h2 className="text-3xl font-bold text-[#123b63] mb-2">Sucesso!</h2>
            <p className="text-gray-600 mb-4">Sua senha foi validada com sucesso!</p>
            
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                <strong>🎉 Seu ministério está pronto para usar!</strong>
              </p>
              <p className="text-xs text-gray-600">
                Você será redirecionado para a página de login em alguns segundos...
              </p>
            </div>

            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-gradient-to-r from-[#123b63] to-[#0284c7] text-white rounded-lg hover:opacity-90 transition font-bold"
            >
              🔑 Ir para Login
            </button>
          </div>
        )}

        {/* ETAPA: ERRO */}
        {etapa === 'erro' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-3xl font-bold text-red-600 mb-2">Link Inválido</h2>
            
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">{mensagem_erro}</p>
            </div>

            <p className="text-gray-600 mb-6">
              Se recebeu este email, solicite um novo link de validação ao administrador do sistema.
            </p>

            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-gradient-to-r from-[#123b63] to-[#0284c7] text-white rounded-lg hover:opacity-90 transition font-bold"
            >
              🏠 Voltar para Login
            </button>

            <p className="text-xs text-gray-600 mt-4">
              Dúvidas? Entre em contato: <strong>suporte@gestaoeclesial.com.br</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
