'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-client';
import { fetchConfiguracaoIgrejaFromSupabase, updateConfiguracaoIgrejaInSupabase } from '@/lib/igreja-config-utils';

export default function BrandingPage() {
  const [activeMenu, setActiveMenu] = useState('branding');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchConfiguracaoIgrejaFromSupabase(supabase)
      .then((config) => setLogoPreview(config.logo || null))
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          setLogoFile(file);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogo = async () => {
    if (logoPreview) {
      await updateConfiguracaoIgrejaInSupabase(supabase, { logo: logoPreview });
      alert('Logo salva com sucesso! Será utilizada em todos os documentos gerados.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

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
    </div>
  );
}
