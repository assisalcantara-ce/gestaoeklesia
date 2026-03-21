/*
 * Auditoria: Formularios vs Schema do Supabase
 * - Usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (server-only)
 * - Nao usa DB_URL
 * - Gera relatorio em /reports/forms-vs-db.md
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

type SchemaColumn = {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

type FormAudit = {
  name: string
  route: string
  apiEndpoint?: string
  table: string
  payloadFields: Array<{ field: string; required?: boolean; type?: string }>
  notes?: string
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const FORMS: FormAudit[] = [
  {
    name: 'Membros (Cadastro/Edicao)',
    route: '/secretaria/membros',
    apiEndpoint: '/api/v1/members (POST/PUT)',
    table: 'members',
    payloadFields: [
      { field: 'name', required: true, type: 'text' },
      { field: 'cpf', type: 'text' },
      { field: 'birth_date', type: 'date' },
      { field: 'gender', type: 'text' },
      { field: 'role', type: 'text' },
      { field: 'status', type: 'text' },
      { field: 'custom_fields', type: 'jsonb' }
    ]
  },
  {
    name: 'Funcionarios',
    route: '/secretaria/funcionarios',
    apiEndpoint: '/api/v1/employees (POST/PATCH)',
    table: 'employees',
    payloadFields: [
      { field: 'member_id', required: true, type: 'uuid' },
      { field: 'grupo', required: true, type: 'text' },
      { field: 'funcao', required: true, type: 'text' },
      { field: 'data_admissao', required: true, type: 'date' },
      { field: 'status', type: 'text' }
    ]
  },
  {
    name: 'Batismo - Agendamentos',
    route: '/secretaria/batismo',
    table: 'batismo_agendamentos',
    payloadFields: [
      { field: 'data_evento', required: true, type: 'date' },
      { field: 'hora_evento', type: 'time' },
      { field: 'status', type: 'text' }
    ],
    notes: 'Gravacao direta via supabase client (sem API).'
  },
  {
    name: 'Batismo - Cadastros',
    route: '/secretaria/batismo',
    table: 'batismo_cadastros',
    payloadFields: [
      { field: 'member_id', required: true, type: 'uuid' },
      { field: 'pessoa_nome', required: true, type: 'text' }
    ],
    notes: 'Gravacao direta via supabase client (sem API).'
  },
  {
    name: 'Batismo - Registros',
    route: '/secretaria/batismo',
    table: 'batismo_registros',
    payloadFields: [
      { field: 'cadastro_id', type: 'uuid' },
      { field: 'agendamento_id', type: 'uuid' },
      { field: 'data_batismo', type: 'date' }
    ],
    notes: 'Gravacao direta via supabase client (sem API).'
  },
  {
    name: 'Apresentacao de Criancas',
    route: '/secretaria/criancas',
    table: 'apresentacao_criancas_registros',
    payloadFields: [
      { field: 'crianca_nome', required: true, type: 'text' },
      { field: 'data_apresentacao', type: 'date' },
      { field: 'status', type: 'text' }
    ],
    notes: 'Gravacao direta via supabase client (sem API).'
  }
]

function compareSchema(schema: SchemaColumn[], payloadFields: FormAudit['payloadFields']) {
  const dbCols = new Set(schema.map((c) => c.column_name))
  const payloadCols = new Set(payloadFields.map((f) => f.field))

  const missingInPayload = schema
    .filter((c) => c.is_nullable === 'NO')
    .map((c) => c.column_name)
    .filter((c) => !payloadCols.has(c))

  const extraInPayload = payloadFields
    .map((f) => f.field)
    .filter((f) => !dbCols.has(f))

  return { missingInPayload, extraInPayload }
}

async function getTableSchema(table: string) {
  const { data, error } = await supabase.rpc('get_table_schema', { p_table: table })
  if (error) throw error
  return (data || []) as SchemaColumn[]
}

async function run() {
  const reportLines: string[] = []
  reportLines.push('# Auditoria: Formularios vs Supabase')
  reportLines.push('')
  reportLines.push(`Data: ${new Date().toISOString()}`)
  reportLines.push('')

  for (const form of FORMS) {
    reportLines.push(`## ${form.name}`)
    reportLines.push(`- Rota: ${form.route}`)
    reportLines.push(`- Endpoint: ${form.apiEndpoint || 'N/A'}`)
    reportLines.push(`- Tabela: ${form.table}`)
    if (form.notes) reportLines.push(`- Notas: ${form.notes}`)

    try {
      const schema = await getTableSchema(form.table)
      const { missingInPayload, extraInPayload } = compareSchema(schema, form.payloadFields)

      if (missingInPayload.length === 0 && extraInPayload.length === 0) {
        reportLines.push('- Status: OK')
      } else {
        reportLines.push('- Status: WARN')
      }

      if (missingInPayload.length > 0) {
        reportLines.push(`- Colunas obrigatorias fora do payload: ${missingInPayload.join(', ')}`)
      }
      if (extraInPayload.length > 0) {
        reportLines.push(`- Campos do payload sem coluna na tabela: ${extraInPayload.join(', ')}`)
      }
    } catch (err: any) {
      reportLines.push('- Status: FAIL')
      reportLines.push(`- Erro: ${err?.message || 'Falha ao inspecionar schema'}`)
    }

    reportLines.push('')
  }

  const outPath = path.resolve(process.cwd(), 'reports', 'forms-vs-db.md')
  fs.writeFileSync(outPath, reportLines.join('\n'), 'utf8')
  // Nao logar chaves em output
  console.log(`Relatorio gerado em: ${outPath}`)
}

run().catch((err) => {
  console.error('Falha na auditoria:', err?.message || err)
  process.exit(1)
})
