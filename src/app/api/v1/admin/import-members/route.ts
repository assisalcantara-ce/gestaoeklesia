/**
 * API ROUTE: Importar membros via CSV (Admin)
 * POST /api/v1/admin/import-members
 *
 * multipart/form-data:
 *   - file: arquivo CSV
 *   - ministry_id: UUID do ministério destino
 *
 * Retorna:
 *   { inserted, skipped, errors: [{ row, name, reason }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

// Colunas obrigatórias no CSV
const REQUIRED_COLS = ['name'] as const

// Mapeamento de cabeçalho CSV → coluna do banco
// Aceita variações comuns de nomes de coluna
const COL_MAP: Record<string, string> = {
  // Identificação
  name:                       'name',
  nome:                       'name',
  email:                      'email',
  phone:                      'phone',
  telefone:                   'phone',
  celular:                    'celular',
  whatsapp:                   'whatsapp',
  cpf:                        'cpf',
  rg:                         'rg',
  orgao_emissor:              'orgao_emissor',
  matricula:                  'matricula',
  tipo_cadastro:              'tipo_cadastro',
  // Dados pessoais
  data_nascimento:            'data_nascimento',
  sexo:                       'sexo',
  tipo_sanguineo:             'tipo_sanguineo',
  escolaridade:               'escolaridade',
  estado_civil:               'estado_civil',
  nacionalidade:              'nacionalidade',
  naturalidade:               'naturalidade',
  uf_naturalidade:            'uf_naturalidade',
  nome_pai:                   'nome_pai',
  nome_mae:                   'nome_mae',
  nome_conjuge:               'nome_conjuge',
  cpf_conjuge:                'cpf_conjuge',
  data_nascimento_conjuge:    'data_nascimento_conjuge',
  titulo_eleitoral:           'titulo_eleitoral',
  zona_eleitoral:             'zona_eleitoral',
  secao_eleitoral:            'secao_eleitoral',
  profissao:                  'profissao',
  // Endereço
  cep:                        'cep',
  logradouro:                 'logradouro',
  numero:                     'numero',
  bairro:                     'bairro',
  complemento:                'complemento',
  cidade:                     'cidade',
  estado:                     'estado',
  // Ministerial
  data_batismo_aguas:         'data_batismo_aguas',
  data_batismo_espirito_santo:'data_batismo_espirito_santo',
  data_consagracao:           'data_consagracao',
  data_emissao:               'data_emissao',
  data_validade_credencial:   'data_validade_credencial',
  cargo_ministerial:          'cargo_ministerial',
  curso_teologico:            'curso_teologico',
  instituicao_teologica:      'instituicao_teologica',
  procedencia:                'procedencia',
  procedencia_local:          'procedencia_local',
  pastor_auxiliar:            'pastor_auxiliar',
  tem_funcao_igreja:          'tem_funcao_igreja',
  qual_funcao:                'qual_funcao',
  setor_departamento:         'setor_departamento',
  observacoes_ministeriais:   'observacoes_ministeriais',
  // Status / outros
  status:                     'status',
  is_dizimista:               'is_dizimista',
  observacoes:                'observacoes',
  member_since:               'member_since',
}

// Colunas booleanas
const BOOL_COLS = new Set(['pastor_auxiliar', 'tem_funcao_igreja', 'is_dizimista'])
// Colunas de data (precisam estar no formato YYYY-MM-DD)
const DATE_COLS = new Set([
  'data_nascimento', 'data_nascimento_conjuge', 'data_batismo_aguas',
  'data_batismo_espirito_santo', 'data_consagracao', 'data_emissao',
  'data_validade_credencial', 'member_since',
])

function parseBool(v: string): boolean {
  return ['true', '1', 'sim', 's', 'yes', 'y'].includes(v.toLowerCase().trim())
}

function parseDate(v: string): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null
  // Aceita YYYY-MM-DD ou DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/')
    return `${y}-${m}-${d}`
  }
  return null
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  const rawHeaders = parseRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseRow(line)
    const row: Record<string, string> = {}
    rawHeaders.forEach((h, idx) => { row[h] = (cols[idx] ?? '').trim() })
    rows.push(row)
  }

  return { headers: rawHeaders, rows }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ministryId = (formData.get('ministry_id') as string | null)?.trim()

    if (!file) {
      return NextResponse.json({ error: 'Arquivo CSV é obrigatório.' }, { status: 400 })
    }
    if (!ministryId) {
      return NextResponse.json({ error: 'ministry_id é obrigatório.' }, { status: 400 })
    }

    // Verificar que o ministério existe
    const { data: ministry } = await supabaseAdmin
      .from('ministries')
      .select('id, name')
      .eq('id', ministryId)
      .maybeSingle()
    if (!ministry) {
      return NextResponse.json({ error: 'Ministério não encontrado.' }, { status: 404 })
    }

    const text = await file.text()
    const { headers, rows } = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV vazio ou sem linhas de dados.' }, { status: 400 })
    }

    // Validar que a coluna obrigatória existe
    for (const col of REQUIRED_COLS) {
      const found = headers.some(h => COL_MAP[h] === col)
      if (!found) {
        return NextResponse.json(
          { error: `Coluna obrigatória ausente: "${col}". Verifique o modelo CSV.` },
          { status: 400 }
        )
      }
    }

    // Buscar congregações do ministério para mapear nome→id
    const { data: congregacoes } = await supabaseAdmin
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', ministryId)
    const congMapByName = new Map(
      (congregacoes || []).map(c => [c.nome.toLowerCase().trim(), c.id])
    )

    let inserted = 0
    const errors: { row: number; name: string; reason: string }[] = []
    const BATCH_SIZE = 50

    // Processar em lotes
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE)
      const records: Record<string, any>[] = []

      for (let i = 0; i < batch.length; i++) {
        const rowIndex = batchStart + i + 2 // linha 1 = cabeçalho, +1 para 1-based
        const rawRow = batch[i]

        // Construir registro mapeando colunas
        const record: Record<string, any> = {
          ministry_id: ministryId,
          status: 'active',
          custom_fields: {},
          dados_cargos: {},
          pastor_auxiliar: false,
          tem_funcao_igreja: false,
          is_dizimista: false,
        }

        for (const [csvCol, rawValue] of Object.entries(rawRow)) {
          const dbCol = COL_MAP[csvCol]
          if (!dbCol) continue // coluna desconhecida → ignora
          const value = rawValue.trim()
          if (!value) continue // vazio → deixa o default

          if (BOOL_COLS.has(dbCol)) {
            record[dbCol] = parseBool(value)
          } else if (DATE_COLS.has(dbCol)) {
            const parsed = parseDate(value)
            if (parsed) record[dbCol] = parsed
          } else {
            record[dbCol] = value
          }
        }

        // Validação mínima
        if (!record.name) {
          errors.push({ row: rowIndex, name: '(sem nome)', reason: 'Coluna "name"/"nome" está vazia.' })
          continue
        }

        // Resolver congregação por nome se vier como texto
        if (record.congregacao_nome && !record.congregacao_id) {
          const congId = congMapByName.get(String(record.congregacao_nome).toLowerCase().trim())
          if (congId) record.congregacao_id = congId
          delete record.congregacao_nome
        }

        // Garantir tipo_cadastro válido
        if (!record.tipo_cadastro) record.tipo_cadastro = 'membro'
        const tiposValidos = ['membro', 'congregado', 'ministro', 'funcionario', 'crianca']
        if (!tiposValidos.includes(String(record.tipo_cadastro).toLowerCase())) {
          record.tipo_cadastro = 'membro'
        }

        // Ministros são automaticamente dizimistas
        if (record.tipo_cadastro === 'ministro') record.is_dizimista = true

        records.push(record)
      }

      if (records.length === 0) continue

      const { data: insertedRows, error: insertError } = await supabaseAdmin
        .from('members')
        .insert(records)
        .select('id')

      if (insertError) {
        // Falha em batch → registrar como erros
        const start = batchStart + 2
        for (let i = 0; i < records.length; i++) {
          errors.push({
            row: start + i,
            name: String(records[i].name ?? ''),
            reason: insertError.message,
          })
        }
      } else {
        inserted += (insertedRows?.length ?? records.length)
      }
    }

    return NextResponse.json({
      ministry_name: ministry.name,
      total_rows: rows.length,
      inserted,
      skipped: rows.length - inserted - errors.length,
      errors,
    })
  } catch (err: any) {
    console.error('POST /api/v1/admin/import-members:', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

/**
 * GET /api/v1/admin/import-members
 * Retorna o modelo CSV para download
 */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
  if (!result.ok) return result.response

  const headers = [
    'name', 'email', 'phone', 'celular', 'whatsapp', 'cpf', 'rg', 'orgao_emissor',
    'matricula', 'tipo_cadastro', 'data_nascimento', 'sexo', 'tipo_sanguineo',
    'escolaridade', 'estado_civil', 'nacionalidade', 'naturalidade', 'uf_naturalidade',
    'nome_pai', 'nome_mae', 'nome_conjuge', 'cpf_conjuge', 'data_nascimento_conjuge',
    'titulo_eleitoral', 'zona_eleitoral', 'secao_eleitoral', 'profissao',
    'cep', 'logradouro', 'numero', 'bairro', 'complemento', 'cidade', 'estado',
    'data_batismo_aguas', 'data_batismo_espirito_santo', 'data_consagracao',
    'data_emissao', 'data_validade_credencial', 'cargo_ministerial',
    'curso_teologico', 'instituicao_teologica', 'procedencia', 'procedencia_local',
    'pastor_auxiliar', 'tem_funcao_igreja', 'qual_funcao', 'setor_departamento',
    'observacoes_ministeriais', 'is_dizimista', 'status', 'member_since', 'observacoes',
  ]

  const example = [
    'João da Silva', 'joao@exemplo.com', '11999998888', '11999998888', '11999998888',
    '12345678901', '1234567', 'SSP/SP',
    '001', 'membro', '1985-06-15', 'MASCULINO', 'A+',
    'ENSINO MEDIO', 'CASADO', 'BRASILEIRA', 'São Paulo', 'SP',
    'José da Silva', 'Maria da Silva', 'Ana da Silva', '98765432100', '1987-03-10',
    '123456789', '001', '0001', 'PROFESSOR',
    '01310100', 'Av. Paulista', '1000', 'Bela Vista', 'Apto 101', 'São Paulo', 'SP',
    '2010-03-15', '2011-07-20', '2015-01-10',
    '2015-01-10', '2020-01-10', 'Pastor',
    'Teologia', 'Faculdade X', 'transferido', 'Igreja Anterior',
    'false', 'false', '', '',
    '', 'false', 'active', '2015-01-10', '',
  ]

  const csvContent = [
    headers.join(','),
    example.map(v => `"${v}"`).join(','),
  ].join('\n')

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo_importacao_membros.csv"',
    },
  })
}
