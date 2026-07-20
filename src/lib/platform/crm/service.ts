import { OportunidadeComercial, HistoricoComercial } from './types'

export class CrmService {
  async getOportunidade(_id: string): Promise<OportunidadeComercial | null> {
    // Esqueleto para obter oportunidade comercial no futuro
    return null
  }

  async recordHistory(_oportunidadeId: string, _statusAnterior: string, _statusNovo: string, _usuario: string, _obs: string): Promise<HistoricoComercial | null> {
    // Esqueleto para persistir histórico comercial no futuro
    return null
  }

}
