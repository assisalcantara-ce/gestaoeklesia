const ASAAS_API_URL = 'https://api.asaas.com/v3';

const getAsaasApiKey = () => {
  // Lida a cada chamada para pegar o valor atualizado do processo
  // Remove eventual barra invertida caso a chave esteja escapada no .env (\$aact → $aact)
  return process.env.ASAAS_API_KEY?.replace(/^\\/, '');
};

const asaasFetch = async (path: string, init: RequestInit) => {
  const ASAAS_API_KEY = getAsaasApiKey();
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
    console.error('[ASAAS] Erro na requisição:', {
      path,
      status: response.status,
      detail,
      fullResponse: data,
    });
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

export const deleteAsaasPayment = async (asaasPaymentId: string) => {
  return asaasFetch(`/payments/${asaasPaymentId}`, { method: 'DELETE' });
};

export const createAsaasPayment = async (payload: {
  customer: string;
  value: number;
  dueDate: string;
  description: string;
  billingType: string;
  externalReference?: string;
}) => {
  try {
    console.log('[ASAAS] Criando pagamento:', {
      customer: payload.customer,
      value: payload.value,
      dueDate: payload.dueDate,
      billingType: payload.billingType,
    });

    const result = await asaasFetch('/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log('[ASAAS] Pagamento criado com sucesso:', result.id);
    return result;
  } catch (err) {
    console.error('[ASAAS] Erro ao criar pagamento:', {
      customer: payload.customer,
      value: payload.value,
      error: (err as Error).message,
    });
    throw err;
  }
};

export const ensureAsaasCustomer = async (supabase: any, ministry: any) => {
  if (ministry.asaas_customer_id) {
    return ministry.asaas_customer_id as string;
  }

  // Limpar CNPJ/CPF removendo caracteres especiais
  const cleanCpfCnpj = ministry.cnpj_cpf 
    ? String(ministry.cnpj_cpf).replace(/[^\d]/g, '')
    : null;

  const customerPayload: AsaasCustomerInput = {
    name: ministry.name || 'Ministério Sem Nome',
    email: ministry.email_admin || `no-email-${ministry.id}@gestoservus.local`,
    cpfCnpj: cleanCpfCnpj || null,
    phone: ministry.phone || null,
    mobilePhone: ministry.whatsapp || null,
    address: ministry.address_street || null,
    addressNumber: ministry.address_number || null,
    complement: ministry.address_complement || null,
    province: ministry.address_city || null,
    postalCode: ministry.address_zip || null,
  };

  console.log('[ASAAS] Criando cliente com payload:', {
    name: customerPayload.name,
    email: customerPayload.email,
    cpfCnpj: customerPayload.cpfCnpj,
  });

  try {
    const customer = await createAsaasCustomer(customerPayload);

    if (customer?.id) {
      await supabase
        .from('ministries')
        .update({ asaas_customer_id: customer.id })
        .eq('id', ministry.id);
      console.log('[ASAAS] Cliente criado com sucesso:', customer.id);
    }

    return customer.id as string;
  } catch (err) {
    console.error('[ASAAS] Erro ao criar/obter cliente:', {
      ministryId: ministry.id,
      ministryName: ministry.name,
      error: (err as Error).message,
    });
    throw err;
  }
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
