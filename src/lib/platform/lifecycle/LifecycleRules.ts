import { TRIAL_EXPIRING_DAYS, RENEWAL_WINDOW_DAYS, PAYMENT_GRACE_DAYS } from './constants';

export class LifecycleRules {
  /**
   * Concentra regras lógicas e validações estáticas do ciclo de vida.
   */
  static readonly TrialExpiringThreshold = TRIAL_EXPIRING_DAYS;
  static readonly RenewalWindow = RENEWAL_WINDOW_DAYS;
  static readonly PaymentGrace = PAYMENT_GRACE_DAYS;
}
