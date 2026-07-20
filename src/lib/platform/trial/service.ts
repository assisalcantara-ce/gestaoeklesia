import { PreRegistration, TrialStatus } from './types'

export class TrialService {
  async getTrialStatus(_userId: string): Promise<TrialStatus | null> {
    // Esqueleto para obter status do trial no futuro
    return null
  }

  async activateTrial(_userId: string): Promise<PreRegistration | null> {
    // Esqueleto para ativação de período de testes no futuro
    return null
  }

}
