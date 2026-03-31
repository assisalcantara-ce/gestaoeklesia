const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

const asaasFetch = async (path: string, init: RequestInit) => {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS não configurado');
  }

  const response = await fetch(`${ASAAS_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: ASAAS_API_KEY,
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.errors?.[0]?.detail || data?.message || 'Erro ASAAS';
    throw new Error(detail);
  }

  return data;
};

type AsaasCustomerInput = {
  name: string;
  email: string;
  cpfCnpj?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

export const createAsaasCustomer = async (payload: AsaasCustomerInput) => {
  return asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createAsaasPayment = async (payload: {
  customer: string;
  value: number;
  dueDate: string;
  description: string;
  billingType: string;
  externalReference?: string;
}) => {
  return asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const ensureAsaasCustomer = async (supabase: any, ministry: any) => {
  if (ministry.asaas_customer_id) {
    return ministry.asaas_customer_id as string;
  }

  const customerPayload: AsaasCustomerInput = {
    name: ministry.name,
    email: ministry.email_admin,
    cpfCnpj: ministry.cnpj_cpf || null,
    phone: ministry.phone || null,
    mobilePhone: ministry.whatsapp || null,
    address: ministry.address_street || null,
    addressNumber: ministry.address_number || null,
    complement: ministry.address_complement || null,
    province: ministry.address_city || null,
    postalCode: ministry.address_zip || null,
  };

  const customer = await createAsaasCustomer(customerPayload);

  if (customer?.id) {
    await supabase
      .from('ministries')
      .update({ asaas_customer_id: customer.id })
      .eq('id', ministry.id);
  }

  return customer.id as string;
};

export const buildMonthlyInstallments = (startDate: string, count: number) => {
  const installments: string[] = [];
  const base = new Date(`${startDate}T00:00:00`);

  for (let i = 0; i < count; i += 1) {
    const date = new Date(base);
    date.setMonth(base.getMonth() + i);
    const iso = date.toISOString().slice(0, 10);
    installments.push(iso);
  }

  return installments;
};
