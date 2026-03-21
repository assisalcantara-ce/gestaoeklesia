/**
 * Context para armazenar dados do usuário logado e suas permissões
 */

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { NivelAcesso } from '@/hooks/usePermissions';

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  nivel: NivelAcesso;
  congregacao?: string; // Para operadores
  supervisao?: string; // Para supervisores
  status: 'ativo' | 'inativo';
}

interface UsuarioContextType {
  usuario: UsuarioLogado | null;
  setUsuario: (usuario: UsuarioLogado | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  logout: () => void;
}

const UsuarioContext = createContext<UsuarioContextType | undefined>(undefined);

export function UsuarioProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    setIsLoading(false);
  }, []);

  const logout = () => {
    setUsuario(null);
  };

  return (
    <UsuarioContext.Provider value={{ usuario, setUsuario, isLoading, setIsLoading, logout }}>
      {children}
    </UsuarioContext.Provider>
  );
}

export function useUsuario() {
  const context = useContext(UsuarioContext);
  if (context === undefined) {
    throw new Error('useUsuario must be used within UsuarioProvider');
  }
  return context;
}
