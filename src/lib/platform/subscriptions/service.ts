import { SubscriptionPlan, SubscriptionInfo } from './types'

export class SubscriptionService {
  async getPlanBySlug(_slug: string): Promise<SubscriptionPlan | null> {
    // Esqueleto inicial para consulta futura
    return null
  }

  async activateSubscription(_ministryId: string, _planSlug: string, _months: number): Promise<SubscriptionInfo | null> {
    // Esqueleto inicial para ativação futura
    return null
  }

}
