export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  price_monthly: number
  is_active: boolean
  created_at: string
}

export interface SubscriptionInfo {
  ministry_id: string
  plan_slug: string
  plan_id: string
  start_date: string
  end_date: string
  status: 'active' | 'inactive' | 'expired' | 'canceled'
}
