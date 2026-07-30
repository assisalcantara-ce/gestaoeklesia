import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TechnicalUserRecord {
  user_id: string;
  ministry_id: string;
  email: string;
}

export interface TechnicalAccessGrant {
  id: string;
  ministry_id: string;
  technical_user_id: string;
  admin_id: string;
  reason: string;
  ticket_reference?: string | null;
  role: string;
  status: 'active' | 'expired' | 'revoked' | 'ended';
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
   * Obtém ou reutiliza o Usuário Técnico de um tenant utilizando a arquitetura nativa.
   * GARANTIA DE ARQUITETURA: Identifica a conta técnica determinística por tenant.
   * Se a conta já existir no Supabase Auth ou em profiles, a função REUTILIZA o registro cadastrado sem gerar duplicidade.
   *
   * @param adminClient Cliente Supabase com permissão de service_role.
   * @param tenantId ID do ministério / tenant alvo.
   */
  public static async getOrCreateTechnicalUser(
    adminClient: SupabaseClient,
    tenantId: string
  ): Promise<TechnicalUserRecord> {
    if (!tenantId) {
      throw new Error('[TechnicalAccessService] tenantId é obrigatório.');
    }

    const email = this.buildTechnicalEmail(tenantId);

    // 1. Verificar se já existe a conta de perfil para este e-mail determinístico em public.profiles
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      // Garantir que a associação em ministry_users exista
      const { error: upsertErr } = await adminClient.from('ministry_users').upsert({
        user_id: existingProfile.id,
        ministry_id: tenantId,
        role: 'ADMINISTRADOR',
      }, { onConflict: 'user_id,ministry_id' });

      if (upsertErr) {
        console.warn('[TechnicalAccessService] Aviso ao garantir ministry_users para usuario existente:', upsertErr);
      }

      return {
        user_id: existingProfile.id,
        ministry_id: tenantId,
        email,
      };
    }

    // 2. Se não existir em public.profiles, tentar criar a conta técnica no Supabase Auth
    const secureUnusablePassword = crypto.randomBytes(32).toString('hex') + 'A1!';
    let userId: string | undefined;

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

    if (createAuthErr || !authUser?.user) {
      const errText = createAuthErr?.message || '';
      // Se o usuário já existir no Auth (ex: conta cadastrada anteriormente), buscar e reutilizar a conta existente no Auth
      if (errText.toLowerCase().includes('already') || errText.toLowerCase().includes('registered') || errText.toLowerCase().includes('exists')) {
        const { data: userList, error: listErr } = await adminClient.auth.admin.listUsers();
        if (listErr) {
          console.error('[TechnicalAccessService] Erro ao listar usuários do Auth:', listErr);
        }
        const found = userList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          userId = found.id;
        } else {
          throw new Error(`Falha ao recuperar conta técnica cadastrada no Auth: ${errText}`);
        }
      } else {
        console.error('[TechnicalAccessService] Erro ao criar conta de usuário técnico no Supabase Auth:', createAuthErr);
        throw new Error(`Falha ao criar usuário técnico no Auth: ${errText}`);
      }
    } else {
      userId = authUser.user.id;
    }

    // 3. Garantir o registro em public.profiles e public.ministry_users para a conta recuperada/criada
    try {
      await adminClient.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'Usuário Técnico de Suporte',
        updated_at: new Date().toISOString(),
      });

      await adminClient.from('ministry_users').upsert({
        user_id: userId,
        ministry_id: tenantId,
        role: 'ADMINISTRADOR',
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,ministry_id' });

      return {
        user_id: userId,
        ministry_id: tenantId,
        email,
      };
    } catch (err: any) {
      console.error('[TechnicalAccessService] Erro ao salvar vinculo do usuário técnico:', err);
      return {
        user_id: userId,
        ministry_id: tenantId,
        email,
      };
    }
  }

  /**
   * Inicia a sessão de Acesso Técnico Ativo para o tenant.
   * 1. Obter/reutilizar o Usuário Técnico do tenant.
   * 2. Reativar temporariamente o usuário no Supabase Auth (desbanir).
   * 3. Registrar a concessão em technical_access_grants.
   * 4. Gerar o Magic Link do Supabase Auth para autenticação nativa sem senha.
   */
  public static async startTechnicalSession(
    adminClient: SupabaseClient,
    params: {
      tenantId: string;
      adminId: string;
      reason: string;
      ticketReference?: string;
      durationHours?: number;
      baseUrl?: string;
    }
  ): Promise<{ actionLink: string; grantId: string; technicalUserId: string }> {
    const { tenantId, adminId, reason, ticketReference, durationHours = 2, baseUrl = '' } = params;

    // 1. Reutilizar/Garantir Usuário Técnico via e-mail determinístico
    const techUser = await this.getOrCreateTechnicalUser(adminClient, tenantId);

    // 2. Reativar temporariamente a conta no Supabase Auth (remover ban)
    const { error: unbanErr } = await adminClient.auth.admin.updateUserById(techUser.user_id, {
      ban_duration: 'none',
    });

    if (unbanErr) {
      console.error('[TechnicalAccessService] Erro ao reativar usuário técnico no Supabase Auth:', unbanErr);
      throw new Error(`Erro ao ativar conta técnica no Auth: ${unbanErr.message}`);
    }

    // 3. Registrar a concessão na tabela oficial technical_access_grants
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + durationHours * 3600 * 1000);

    const { data: grant, error: grantErr } = await adminClient
      .from('technical_access_grants')
      .insert({
        ministry_id: tenantId,
        technical_user_id: techUser.user_id,
        admin_id: adminId,
        reason,
        ticket_reference: ticketReference || null,
        role: 'ADMINISTRADOR',
        status: 'active',
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (grantErr || !grant) {
      console.error('[TechnicalAccessService] Erro ao registrar concessão:', grantErr);
      throw new Error(`Erro ao salvar concessão de acesso técnico: ${grantErr?.message}`);
    }

    // 4. Gerar Magic Link nativo do Supabase Auth direcionando para o callback PKCE /auth/callback?next=/dashboard
    const redirectUrl = baseUrl ? `${baseUrl}/auth/callback?next=/dashboard` : '/auth/callback?next=/dashboard';

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: techUser.email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('[TechnicalAccessService] Erro ao gerar Magic Link nativo do Supabase Auth:', linkErr);
      throw new Error(`Erro ao gerar link de autenticação nativa: ${linkErr?.message}`);
    }

    return {
      actionLink: linkData.properties.action_link,
      grantId: grant.id,
      technicalUserId: techUser.user_id,
    };
  }

  /**
   * Garante que o Usuário Técnico do tenant permaneça desabilitado / inativo no Supabase Auth.
   *
   * @param adminClient Cliente Supabase com permissão de service_role.
   * @param tenantId ID do ministério / tenant alvo.
   */
  public static async disableTechnicalUser(
    adminClient: SupabaseClient,
    tenantId: string
  ): Promise<void> {
    const email = this.buildTechnicalEmail(tenantId);

    const { data: record } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!record?.id) return;

    // Desabilitar conta no Supabase Auth via ban_duration de 100 anos
    await adminClient.auth.admin.updateUserById(record.id, { ban_duration: '876000h' }).catch((err: any) => {
      console.warn('[TechnicalAccessService] Aviso ao desabilitar usuário técnico:', err);
    });
  }
}
