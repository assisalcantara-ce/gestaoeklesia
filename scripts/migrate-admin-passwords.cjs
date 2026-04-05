/**
 * SCRIPT DE MIGRAÇÃO ONE-TIME: Hash de senhas em admin_users
 *
 * O que faz:
 *   - Lê todos os registros de admin_users onde password_hash NÃO é bcrypt
 *   - Aplica bcrypt.hash() em cada um e atualiza o banco
 *   - Idempotente: registros já hasheados são ignorados
 *   - Não remove colunas, não altera schema, não afeta login (auth é via Supabase token)
 *
 * Uso:
 *   node scripts/migrate-admin-passwords.cjs
 *
 * Requer variáveis no .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

'use strict'

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const bcrypt = require('bcrypt')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BCRYPT_ROUNDS = 10

// Prefixos que identificam um hash bcrypt legítimo
function isBcryptHash(value) {
  return typeof value === 'string' && (value.startsWith('$2b$') || value.startsWith('$2a$'))
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  console.log('🔍 Buscando registros em admin_users...')

  const { data: users, error } = await supabase
    .from('admin_users')
    .select('id, email, password_hash')
    .order('criado_em', { ascending: true })

  if (error) {
    console.error('❌ Erro ao buscar admin_users:', error.message)
    process.exit(1)
  }

  const total = users.length
  const toMigrate = users.filter(u => !isBcryptHash(u.password_hash))
  const alreadyHashed = total - toMigrate.length

  console.log(`\n📊 Total de registros: ${total}`)
  console.log(`✅ Já hasheados (bcrypt): ${alreadyHashed}`)
  console.log(`⚠️  Pendentes de migração: ${toMigrate.length}\n`)

  if (toMigrate.length === 0) {
    console.log('✨ Nenhuma migração necessária. Banco já está seguro.')
    return
  }

  let success = 0
  let failed = 0

  for (const user of toMigrate) {
    const rawPassword = user.password_hash

    if (!rawPassword || rawPassword.trim() === '') {
      console.warn(`⚠️  [${user.email}] password_hash vazio — pulando (não há senha para hashar)`)
      continue
    }

    try {
      const hashed = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS)

      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ password_hash: hashed })
        .eq('id', user.id)

      if (updateError) {
        console.error(`❌ [${user.email}] Falha ao atualizar: ${updateError.message}`)
        failed++
      } else {
        console.log(`✅ [${user.email}] Senha migrada com sucesso`)
        success++
      }
    } catch (err) {
      console.error(`❌ [${user.email}] Erro inesperado: ${err.message}`)
      failed++
    }
  }

  console.log('\n─────────────────────────────────')
  console.log(`✅ Migrados com sucesso: ${success}`)
  console.log(`❌ Falhas: ${failed}`)
  console.log('─────────────────────────────────')

  if (failed > 0) {
    console.error('\n⚠️  Alguns registros falharam. Verifique os erros acima e reexecute o script.')
    process.exit(1)
  } else {
    console.log('\n🎉 Migração concluída. Todos os admin_users agora têm senha hasheada com bcrypt.')
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
