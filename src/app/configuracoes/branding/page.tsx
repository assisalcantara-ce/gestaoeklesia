'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { fetchConfiguracaoIgrejaFromSupabase, updateConfiguracaoIgrejaInSupabase } from '@/lib/igreja-config-utils';
import { useUserContext } from '@/hooks/useUserContext';

export default function BrandingPage() {

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [assinaturaPresidente, setAssinaturaPresidente] = useState<string | null>(null);
  const [assinaturaSecretarioGeral, setAssinaturaSecretarioGeral] = useState<string | null>(null);
  const [salvandoAssinaturas, setSalvandoAssinaturas] = useState(false);
  const supabase = createClient();
  // Fonte oficial do tenant — garantida pelo contexto da aplicação.
  // Em sessões de impersonação reflete o ministério impersonado, não o Super Admin.
  const { ministryId } = useUserContext();

  useEffect(() => {
    console.log('[DIAGNOSTICO ROTA DEDICADA BRANDING] useEffect disparado. ministryId:', ministryId);
    if (!ministryId) return;
    fetchConfiguracaoIgrejaFromSupabase(supabase, ministryId)
      .then((config) => {
        console.log('[DIAGNOSTICO ROTA DEDICADA BRANDING] Config recebido:', config);
        console.log('[DIAGNOSTICO ROTA DEDICADA BRANDING] setLogoPreview com:', config.logo || null);
        setLogoPreview(config.logo || null);
        setAssinaturaPresidente(config.assinatura_presidente || null);
        setAssinaturaSecretarioGeral(config.assinatura_secretario_geral || null);
      })
      .catch((err) => console.error('[DIAGNOSTICO ROTA DEDICADA BRANDING] Erro:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministryId]);

  console.log('[DIAGNOSTICO ROTA DEDICADA BRANDING] Render de BrandingPage. logoPreview atual:', logoPreview ? `${logoPreview.substring(0, 30)}...` : null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar dimensões e tamanho
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          if (img.width < 200 || img.height < 200) {
            alert('A imagem deve ter no mínimo 200x200 pixels');
            return;
          }
          setLogoPreview(event.target?.result as string);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogo = async () => {
    if (logoPreview) {
      await updateConfiguracaoIgrejaInSupabase(supabase, { logo: logoPreview }, ministryId);
      alert('Logo salva com sucesso! Será utilizada em todos os documentos gerados.');
    }
  };

  const processarArquivoAssinatura = (
    file: File,
    onSuccess: (base64: string) => void
  ) => {
    if (file.type !== 'image/png') {
      alert('Envie a assinatura exclusivamente em formato PNG com fundo transparente.');
      return;
    }
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('A assinatura deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        if (img.width < 100 || img.height < 30) {
          alert('A assinatura deve possuir no mínimo 100x30 pixels para garantir nitidez em impressões.');
          return;
        }
        onSuccess(base64);
      };
      img.onerror = () => {
        alert('Não foi possível ler o arquivo da assinatura.');
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const handleSalvarAssinatura = async (
    tipo: 'assinatura_presidente' | 'assinatura_secretario_geral',
    novaImagem: string | null
  ) => {
    setSalvandoAssinaturas(true);
    try {
      await updateConfiguracaoIgrejaInSupabase(
        supabase,
        { [tipo]: novaImagem },
        ministryId
      );

      if (tipo === 'assinatura_presidente') {
        setAssinaturaPresidente(novaImagem);
      } else {
        setAssinaturaSecretarioGeral(novaImagem);
      }

      alert(novaImagem ? 'Assinatura salva com sucesso!' : 'Assinatura removida com sucesso.');
    } catch (err: any) {
      alert(err?.message || 'Falha ao salvar assinatura. Tente novamente.');
    } finally {
      setSalvandoAssinaturas(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <h1 className="text-3xl font-bold text-gray-800 mb-6">🎨 Branding - Logomarca</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Upload da Logomarca</h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 mb-4">
                <div className="text-5xl mb-3">📤</div>
                <p className="text-gray-600 text-sm mb-3">
                  Clique ou arraste a imagem da logomarca aqui
                </p>
                <p className="text-gray-500 text-xs mb-4">
                  Dimensões recomendadas: 500x500px ou superior<br/>
                  Formatos: PNG, JPG, SVG<br/>
                  Tamanho máximo: 5MB
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  id="logo-input"
                />
                <label
                  htmlFor="logo-input"
                  className="inline-block px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer font-semibold"
                >
                  📁 Escolher Imagem
                </label>
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                <p>✓ A imagem será redimensionada automaticamente</p>
                <p>✓ Será utilizada em todos os documentos gerados</p>
                <p>✓ Máximo de 5MB</p>
              </div>
            </div>

            {/* Preview Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Prévia da Logomarca</h2>
              
              <div className="border border-gray-300 rounded-lg p-8 text-center bg-gray-50 mb-4 h-64 flex items-center justify-center">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-gray-400">
                    <div className="text-5xl mb-2">🖼️</div>
                    <p>Nenhuma imagem selecionada</p>
                  </div>
                )}
              </div>

              {logoPreview && (
                <button
                  onClick={handleSaveLogo}
                  className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                >
                  ✓ Salvar Logomarca
                </button>
              )}
            </div>
          </div>

          {/* ── SEÇÃO DE ASSINATURAS INSTITUCIONAIS ── */}
          <div className="mt-10 max-w-4xl">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <span>✍️</span> Assinaturas Institucionais
              </h2>
              <p className="text-sm text-gray-600">
                Cadastre as assinaturas digitais dos representantes institucionais para inclusão automática e governança em documentos oficiais, cartas e credenciais.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Pastor Presidente */}
              <div className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-gray-800">Assinatura do Pastor Presidente</h3>
                    {assinaturaPresidente ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Cadastrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
                        Não cadastrada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Envie a assinatura com fundo transparente, preferencialmente em PNG.
                  </p>
                  <div
                    className="w-full h-36 rounded-lg border border-gray-300 flex items-center justify-center p-3 relative overflow-hidden mb-4"
                    style={{
                      backgroundColor: '#ffffff',
                      backgroundImage: `
                        linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                        linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                        linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
                      `,
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  >
                    {assinaturaPresidente ? (
                      <img
                        src={assinaturaPresidente}
                        alt="Assinatura Pastor Presidente"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <div className="text-3xl mb-1">✍️</div>
                        <span className="text-xs">Nenhuma assinatura cadastrada</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <input
                    type="file"
                    accept="image/png"
                    id="branding-assinatura-presidente"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        processarArquivoAssinatura(file, (base64) => {
                          handleSalvarAssinatura('assinatura_presidente', base64);
                        });
                      }
                      e.target.value = '';
                    }}
                  />
                  <div className="flex gap-2">
                    <label
                      htmlFor="branding-assinatura-presidente"
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        salvandoAssinaturas
                          ? 'opacity-50 pointer-events-none bg-gray-300 text-gray-600'
                          : assinaturaPresidente
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                            : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                      }`}
                    >
                      {salvandoAssinaturas ? '⏳ Salvando...' : assinaturaPresidente ? '🔄 Substituir' : '📤 Enviar Assinatura'}
                    </label>
                    {assinaturaPresidente && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Deseja realmente remover a assinatura do Pastor Presidente?')) {
                            handleSalvarAssinatura('assinatura_presidente', null);
                          }
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        🗑️ Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Secretário-Geral */}
              <div className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-gray-800">Assinatura do Secretário-Geral</h3>
                    {assinaturaSecretarioGeral ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Cadastrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
                        Não cadastrada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Envie a assinatura com fundo transparente, preferencialmente em PNG.
                  </p>
                  <div
                    className="w-full h-36 rounded-lg border border-gray-300 flex items-center justify-center p-3 relative overflow-hidden mb-4"
                    style={{
                      backgroundColor: '#ffffff',
                      backgroundImage: `
                        linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                        linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                        linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
                      `,
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  >
                    {assinaturaSecretarioGeral ? (
                      <img
                        src={assinaturaSecretarioGeral}
                        alt="Assinatura Secretário-Geral"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <div className="text-3xl mb-1">✍️</div>
                        <span className="text-xs">Nenhuma assinatura cadastrada</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <input
                    type="file"
                    accept="image/png"
                    id="branding-assinatura-secretario"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        processarArquivoAssinatura(file, (base64) => {
                          handleSalvarAssinatura('assinatura_secretario_geral', base64);
                        });
                      }
                      e.target.value = '';
                    }}
                  />
                  <div className="flex gap-2">
                    <label
                      htmlFor="branding-assinatura-secretario"
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        salvandoAssinaturas
                          ? 'opacity-50 pointer-events-none bg-gray-300 text-gray-600'
                          : assinaturaSecretarioGeral
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                            : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                      }`}
                    >
                      {salvandoAssinaturas ? '⏳ Salvando...' : assinaturaSecretarioGeral ? '🔄 Substituir' : '📤 Enviar Assinatura'}
                    </label>
                    {assinaturaSecretarioGeral && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Deseja realmente remover a assinatura do Secretário-Geral?')) {
                            handleSalvarAssinatura('assinatura_secretario_geral', null);
                          }
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        🗑️ Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dimensões Recomendadas */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6 max-w-4xl">
            <h3 className="text-lg font-bold text-blue-900 mb-3">📐 Dimensões Recomendadas por Uso</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-semibold text-blue-900">Documentos Impressos</p>
                <p className="text-blue-700">500x500px (mínimo)</p>
              </div>
              <div>
                <p className="font-semibold text-blue-900">Digital</p>
                <p className="text-blue-700">300x300px (mínimo)</p>
              </div>
              <div>
                <p className="font-semibold text-blue-900">Certificados</p>
                <p className="text-blue-700">800x800px (recomendado)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
