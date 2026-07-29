import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PermanentTechnicalUser {
  id: string;
  ministry_id: string;
  user_id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TechnicalAccessGrant {
  id: string;
  ministry_id: string;
  technical_user_id: string;
  admin_id: string;
  reason: string;
  ticket_reference?: string | null;
  role: string;
  status: 'active' | 'expired' | 'revoked';
  starts_at: string;
  expires_at: string;
  revoked_at?: string | null;
  revoked_by?: string | null;
  created_at: string;
}

export class TechnicalAccessService {
  /**
   * Domínio interno não-roteável para emails de contas técnicas.
   * Impede recebimento de emails reais da plataforma.
   */
  private static readonly TECH_EMAIL_DOMAIN = 'technical.eklesia.internal';

  /**
   * Gera o email padrão determinístico para o Usuário Técnico de um tenant.
   */
  public static buildTechnicalEmail(tenantId: string): string {
    const cleanId = tenantId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `tech.suporte.${cleanId}@${this.TECH_EMAIL_DOMAIN}`;
  }

  /**
   * Obtém ou cria o Usuário Técnico Permanente de um tenant.
   * GARANTIA DE ARQUITETURA: Existe no máximo 1 usuário técnico por tenant.
   * Se já existir, a função REUTILIZA o registro cadastrado sem criar novas contas.
   *
   * @param adminClient Cliente Supabase com permissão de service_role.
   * @param tenantId ID do ministério / tenant alvo.
   */
  public static async getOrCreateTechnicalUser(
    adminClient: SupabaseClient,
    tenantId: string
  ): Promise<PermanentTechnicalUser> {
    if (!tenantId) {
      throw new Error('[TechnicalAccessService] tenantId é obrigatório.');
    }

    // 1. Verificar se já existe o Usuário Técnico Permanente para este tenant
    const { data: existingRecord, error: fetchErr } = await adminClient
      .from('permanent_technical_users')
      .select('*')
      .eq('ministry_id', tenantId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[TechnicalAccessService] Erro ao buscar permanent_technical_users:', fetchErr);
      throw new Error(`Erro ao verificar usuário técnico do tenant: ${fetchErr.message}`);
    }

    // Se já existir, REUTILIZAR obrigatoriamente
    if (existingRecord) {
      return existingRecord as PermanentTechnicalUser;
    }

    // 2. Se não existir, criar a conta técnica permanente no Supabase Auth
    const email = this.buildTechnicalEmail(tenantId);
    
    // Senha aleatória de 64 caracteres hexadecimais (impossível de adivinhar ou fazer login manual por form)
    const secureUnusablePassword = crypto.randomBytes(32).toString('hex') + 'A1!';

    const { data: authUser, error: createAuthErr } = await adminClient.auth.admin.createUser({
      email,
      password: secureUnusablePassword,
      email_confirm: true,
      user_metadata: {
        is_technical_user: true,
        ministry_id: tenantId,
        full_name: 'Usuário Técnico de Suporte',
      },
      app_metadata: {
        is_technical_user: true,
        provider: 'technical_access',
      },
      // Criado desabilitado por padrão (banido por 100 anos até que haja concessão ativa)
      ban_duration: '876000h',
    });

    if (createAuthErr || !authUser.user) {
      console.error('[TechnicalAccessService] Erro ao criar conta de usuário técnico no Supabase Auth:', createAuthErr);
      throw new Error(`Falha ao criar usuário técnico no Auth: ${createAuthErr?.message}`);
    }

    const userId = authUser.user.id;

    try {
      // 3. Registrar em public.profiles
      await adminClient.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'Usuário Técnico de Suporte',
        updated_at: new Date().toISOString(),
      });

      // 4. Registrar em public.ministry_users com is_technical = true
      // (Permite que o usuário técnico tenha papéis normais de RLS quando ativo, mas fique oculto em listagens de usuários do ministério)
      await adminClient.from('ministry_users').upsert({
        user_id: userId,
        ministry_id: tenantId,
        role: 'ADMINISTRADOR',
        permissions: ['ADMINISTRADOR'],
        is_technical: true,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,ministry_id' });

      // 5. Inserir mapeamento único na tabela permanent_technical_users
      const { data: newTechRecord, error: insertRecordErr } = await adminClient
        .from('permanent_technical_users')
        .insert({
          ministry_id: tenantId,
          user_id: userId,
          email,
          is_active: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (insertRecordErr || !newTechRecord) {
        console.error('[TechnicalAccessService] Erro ao registrar permanent_technical_users:', insertRecordErr);
        throw new Error(`Falha ao salvar mapeamento do usuário técnico: ${insertRecordErr?.message}`);
      }

      return newTechRecord as PermanentTechnicalUser;
    } catch (err: any) {
      // Cleanup de segurança caso haja falha intermediária
      await adminClient.auth.admin.deleteUser(userId).catch(() => null);
      throw err;
    }
  }

  /**
   * Garante que o Usuário Técnico do tenant permaneça desabilitado / inativo.
   *
   * @param adminClient Cliente Supabase com permissão de service_role.
   * @param tenantId ID do ministério / tenant alvo.
   */
  public static async disableTechnicalUser(
    adminClient: SupabaseClient,
    tenantId: string
  ): Promise<void> {
    const { data: record } = await adminClient
      .from('permanent_technical_users')
      .select('user_id')
      .eq('ministry_id', tenantId)
      .maybeSingle();

    if (!record?.user_id) return;

    // Desabilitar conta no Supabase Auth via ban_duration de 100 anos
    await adminClient.auth.admin.updateUserById(record.user_id, { ban_duration: '876000h' }).catch((err: any) => {
      console.warn('[TechnicalAccessService] Aviso ao desabilitar usuário técnico:', err);
    });

    // Marcar como inativo no registro de mapeamento
    await adminClient
      .from('permanent_technical_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('ministry_id', tenantId);
  }
}
