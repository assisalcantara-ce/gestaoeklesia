/*
 * Verificacao simples: Formularios -> Supabase
 * - Sem DB_URL
 * - Sem RPC
 * - Nao loga chaves
 */

import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL || ''
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD || ''
const RAW_BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Missing ADMIN_TEST_EMAIL or ADMIN_TEST_PASSWORD in .env.local')
}

function getOrigin(input) {
  try {
    const u = new URL(input)
    return u.origin
  } catch {
    return 'http://localhost:3000'
  }
}

const BASE_URL = getOrigin(RAW_BASE_URL)

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function getAccessToken() {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  })
  if (error || !data?.session?.access_token) {
    throw new Error('Failed to authenticate test user')
  }
  return { token: data.session.access_token, userId: data.user?.id }
}

async function resolveMinistryId(userId) {
  if (!userId) return null
  const { data: mu, error: muErr } = await supabaseAdmin
    .from('ministry_users')
    .select('ministry_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!muErr && mu?.ministry_id) return String(mu.ministry_id)

  const { data: m, error: mErr } = await supabaseAdmin
    .from('ministries')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!mErr && m?.id) return String(m.id)
  return null
}

async function httpRequest(url, method, token, body) {
  const headers = {
    'Content-Type': 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function checkMembers(token) {
  const form = { route: '/secretaria/membros', endpoint: '/api/v1/members', table: 'members' }
  const payload = { name: `Audit Member ${Date.now()}`, status: 'active' }

  const create = await httpRequest(`${BASE_URL}${form.endpoint}`, 'POST', token, payload)
  if (!create.ok) return { ...form, result: 'FALHOU', error: create.data?.error || 'POST failed' }

  const member = create.data
  const id = member?.id
  if (!id) return { ...form, result: 'FALHOU', error: 'No id returned' }

  const { data: row } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
  const missing = []
  if (row?.name !== payload.name) missing.push('name')

  const update = await httpRequest(`${BASE_URL}${form.endpoint}/${id}`, 'PUT', token, { name: `${payload.name} Updated` })
  if (!update.ok) return { ...form, result: 'FALHOU', error: update.data?.error || 'PUT failed' }

  const { data: updated } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
  if (updated?.name !== `${payload.name} Updated`) missing.push('name(updated)')

  const del = await httpRequest(`${BASE_URL}${form.endpoint}/${id}`, 'DELETE', token)
  if (!del.ok) return { ...form, result: 'FALHOU', error: del.data?.error || 'DELETE failed' }

  return { ...form, result: missing.length ? 'FALHOU' : 'OK', missing }
}

async function checkEmployees(token, memberId) {
  const form = { route: '/secretaria/funcionarios', endpoint: '/api/v1/employees', table: 'employees' }
  const payload = {
    member_id: memberId,
    grupo: 'AUDITORIA',
    funcao: 'Teste',
    data_admissao: new Date().toISOString().slice(0, 10),
    status: 'ATIVO'
  }

  const create = await httpRequest(`${BASE_URL}${form.endpoint}`, 'POST', token, payload)
  if (!create.ok) return { ...form, result: 'FALHOU', error: create.data?.error || 'POST failed' }

  const created = Array.isArray(create.data?.data) ? create.data.data[0] : create.data?.data
  const id = created?.id
  if (!id) return { ...form, result: 'FALHOU', error: 'No id returned' }

  const { data: row } = await supabaseAdmin.from('employees').select('*').eq('id', id).single()
  const missing = []
  if (row?.grupo !== payload.grupo) missing.push('grupo')

  const patch = await httpRequest(`${BASE_URL}${form.endpoint}/${id}`, 'PATCH', token, { funcao: 'Teste Updated' })
  if (!patch.ok) return { ...form, result: 'FALHOU', error: patch.data?.error || 'PATCH failed' }

  const { data: updated } = await supabaseAdmin.from('employees').select('*').eq('id', id).single()
  if (updated?.funcao !== 'Teste Updated') missing.push('funcao(updated)')

  const del = await httpRequest(`${BASE_URL}${form.endpoint}/${id}`, 'DELETE', token)
  if (!del.ok) return { ...form, result: 'FALHOU', error: del.data?.error || 'DELETE failed' }

  return { ...form, result: missing.length ? 'FALHOU' : 'OK', missing }
}

async function checkPreRegistrations() {
  const form = { route: '/pre-cadastro', endpoint: '/api/v1/contact', table: 'pre_registrations' }
  const ts = Date.now()
  const payload = {
    ministerio: `Audit Ministry ${ts}`,
    pastor: `Audit Pastor ${ts}`,
    cpf: `000000000${String(ts).slice(-2)}`,
    whatsapp: '11999999999',
    email: `audit-${ts}@example.com`
  }

  const create = await httpRequest(`${BASE_URL}${form.endpoint}`, 'POST', null, payload)
  if (!create.ok) return { ...form, result: 'FALHOU', error: create.data?.error || 'POST failed' }

  const id = create.data?.data?.id
  if (!id) return { ...form, result: 'FALHOU', error: 'No id returned' }

  const { data: row } = await supabaseAdmin.from('pre_registrations').select('*').eq('id', id).single()
  const missing = []
  if (row?.email !== payload.email) missing.push('email')
  if (row?.ministry_name !== payload.ministerio) missing.push('ministry_name')

  return { ...form, result: missing.length ? 'FALHOU' : 'OK', missing }
}

async function checkChildPresentations(ministryId) {
  const form = { route: '/secretaria/criancas', endpoint: 'N/A (client supabase)', table: 'apresentacao_criancas_registros' }
  if (!ministryId) return { ...form, result: 'FALHOU', error: 'No ministry_id' }

  const payload = {
    ministry_id: ministryId,
    crianca_nome: `Audit Child ${Date.now()}`,
    status: 'agendado'
  }

  const { data: created, error } = await supabaseAdmin
    .from('apresentacao_criancas_registros')
    .insert(payload)
    .select()
    .single()

  if (error || !created?.id) {
    return { ...form, result: 'FALHOU', error: error?.message || 'Insert failed' }
  }

  const { data: row } = await supabaseAdmin
    .from('apresentacao_criancas_registros')
    .select('*')
    .eq('id', created.id)
    .single()

  const missing = []
  if (row?.crianca_nome !== payload.crianca_nome) missing.push('crianca_nome')

  await supabaseAdmin.from('apresentacao_criancas_registros').delete().eq('id', created.id)

  return { ...form, result: missing.length ? 'FALHOU' : 'OK', missing }
}

async function run() {
  const { token, userId } = await getAccessToken()
  const ministryId = await resolveMinistryId(userId)

  const results = []

  const memberCheck = await checkMembers(token)
  results.push(memberCheck)

  let memberIdForEmployee = null
  if (memberCheck.result === 'OK' || memberCheck.result === 'FALHOU') {
    // Create a new member for employee test to avoid missing id after delete
    const create = await httpRequest(`${BASE_URL}/api/v1/members`, 'POST', token, {
      name: `Audit Employee Person ${Date.now()}`,
      status: 'active'
    })
    memberIdForEmployee = create?.data?.id || null
  }

  if (memberIdForEmployee) {
    const empCheck = await checkEmployees(token, memberIdForEmployee)
    results.push(empCheck)
  } else {
    results.push({
      route: '/secretaria/funcionarios',
      endpoint: '/api/v1/employees',
      table: 'employees',
      result: 'FALHOU',
      error: 'No member_id available for employees test'
    })
  }

  results.push(await checkPreRegistrations())
  results.push(await checkChildPresentations(ministryId))

  for (const r of results) {
    const missing = r.missing && r.missing.length ? ` | Campos nao persistidos: ${r.missing.join(', ')}` : ''
    const err = r.error ? ` | Erro: ${r.error}` : ''
    console.log(`Form: ${r.route} | Endpoint: ${r.endpoint} | Table: ${r.table} | Result: ${r.result}${missing}${err}`)
  }
}

run().catch((err) => {
  console.error('Falha na verificacao:', err?.message || err)
  process.exit(1)
})
