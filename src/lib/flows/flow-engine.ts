export type FlowTransition = {
  action: string;
  from: string;
  to: string;
  roles: string[];
  next_role?: string | null;
  required_fields?: string[];
  require_note?: boolean;
};

export type FlowDefinition = {
  initial_status: string;
  statuses: string[];
  transitions: FlowTransition[];
  final_statuses?: string[];
  initial_assignee_role?: string | null;
};

export type FlowInstance = {
  id: string;
  status: string;
  data_json: Record<string, any>;
  current_assignee_role?: string | null;
};

export type FlowApplyResult = {
  nextStatus: string;
  nextAssigneeRole?: string | null;
  nextData: Record<string, any>;
  closedAt?: string | null;
};

function normalizeRoles(roles: string[]): Set<string> {
  return new Set(roles.map(r => String(r).toUpperCase()));
}

export function getAvailableActions(instance: FlowInstance, definition: FlowDefinition, userRoles: string[]): FlowTransition[] {
  const roleSet = normalizeRoles(userRoles);
  return definition.transitions.filter(t => {
    if (t.from !== instance.status) return false;
    if (roleSet.has('ADMINISTRADOR')) return true;
    return t.roles.some(r => roleSet.has(String(r).toUpperCase()));
  });
}

export function applyAction(
  instance: FlowInstance,
  definition: FlowDefinition,
  action: string,
  userRoles: string[],
  payload: { data?: Record<string, any>; note?: string }
): FlowApplyResult {
  const available = getAvailableActions(instance, definition, userRoles);
  const transition = available.find(t => t.action === action);
  if (!transition) {
    throw new Error('ACTION_NOT_ALLOWED');
  }

  const nextData = { ...(instance.data_json || {}), ...(payload.data || {}) };

  if (transition.required_fields && transition.required_fields.length > 0) {
    const missing = transition.required_fields.filter(f => {
      const v = nextData[f];
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) {
      throw new Error('MISSING_FIELDS');
    }
  }

  if (transition.require_note && !payload.note) {
    throw new Error('NOTE_REQUIRED');
  }

  const finalStatuses = new Set((definition.final_statuses || []).map(s => s.toLowerCase()));
  const shouldClose = finalStatuses.has(String(transition.to).toLowerCase());

  return {
    nextStatus: transition.to,
    nextAssigneeRole: transition.next_role || null,
    nextData,
    closedAt: shouldClose ? new Date().toISOString() : null,
  };
}
