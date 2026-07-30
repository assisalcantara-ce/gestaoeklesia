import { SupabaseClient } from '@supabase/supabase-js';
import { mapRoleAndPermissions } from '@/lib/access-control';
import {
  encryptPassword,
  decryptPassword,
  generateStrongPassword,
} from './technical-crypto';

export interface TechnicalAccountDetails {
  authUserId: string;
  ministryId: string;
  email: string;
  lastSignInAt: string | null;
  lastSignInIp?: string | null;
  lastSignInUserAgent?: string | null;
  hasCredentialsStored: boolean;
}

export class TechnicalAccessService {
  /**
   * Constrói o e-mail determinístico da conta técnica do tenant.
   */
  public static getTechnicalEmail(tenantId: string): string {
    const cleanTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    return `tech.suporte.${cleanTenantId}@technical.eklesia.internal`;
  }

  /**
   * Garantia Idempotente de Migração/Criação:
   * Localiza ou cria a conta técnica de um tenant, garantindo que ela possua
   * o usuário no Auth, vínculo em ministry_users utilizando obrigatoriamente
   * mapRoleAndPermissions('administrador'), e credencial criptografada AES-256-GCM
   * em technical_access_secrets.
   */
  public static async getOrCreateTechnicalAccount(
    adminClient: SupabaseClient,
    tenantId: string
  ): Promise<TechnicalAccountDetails> {
    const techEmail = this.getTechnicalEmail(tenantId);

    // 1. Verificar se a igreja / tenant existe
    const { data: tenant, error: tenantErr } = await adminClient
      .from('ministries')
      .select('id, name')
      .eq('id', tenantId)
      .single();

    if (tenantErr || !tenant) {
      throw new Error(`Tenant / Ministério '${tenantId}' não encontrado.`);
    }

    // 2. Localizar usuário existente no Supabase Auth pelo email (Idempotência)
    let authUser: any = null;
    const { data: listData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (listData?.users) {
      authUser = listData.users.find((u: any) => u.email?.toLowerCase() === techEmail.toLowerCase());
    }

    // Se não encontrou na listagem rápida, tenta obter via busca individual em ministry_users
    if (!authUser) {
      const { data: searchMu } = await adminClient
        .from('ministry_users')
        .select('user_id')
        .eq('ministry_id', tenantId)
        .maybeSingle();

      if (searchMu?.user_id) {
        const { data: fetchedUser } = await adminClient.auth.admin.getUserById(searchMu.user_id);
        if (fetchedUser?.user && fetchedUser.user.email?.toLowerCase() === techEmail.toLowerCase()) {
          authUser = fetchedUser.user;
        }
      }
    }

    let initialPasswordToSet: string | null = null;

    // 3. Se a conta não existir no Supabase Auth, cria silenciosamente com senha forte
    if (!authUser) {
      initialPasswordToSet = generateStrongPassword();
      const { data: newAuthData, error: createErr } = await adminClient.auth.admin.createUser({
        email: techEmail,
        password: initialPasswordToSet,
        email_confirm: true,
        user_metadata: {
          full_name: `Suporte Técnico (${tenant.name})`,
          is_technical_user: true,
          tenant_id: tenantId,
        },
      });

      if (createErr || !newAuthData?.user) {
        // Se ocorreu erro de conta já cadastrada (ex: corrida), tenta relistar para resgatar o usuário
        if (createErr?.message?.includes('already been registered')) {
          const { data: retryList } = await adminClient.auth.admin.listUsers();
          authUser = retryList?.users?.find((u: any) => u.email?.toLowerCase() === techEmail.toLowerCase());
        }

        if (!authUser) {
          throw new Error(`Erro ao criar conta técnica no Supabase Auth: ${createErr?.message}`);
        }
      } else {
        authUser = newAuthData.user;
      }
    }

    // 4. Idempotência e Migração de RBAC em Profiles e Ministry_Users
    // Utiliza obrigatoriamente a função oficial mapRoleAndPermissions('administrador')
    const roleConfig = mapRoleAndPermissions('administrador');

    await adminClient.from('profiles').upsert(
      {
        id: authUser.id,
        email: techEmail,
        full_name: `Suporte Técnico (${tenant.name})`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    // Corrige ou cria o vínculo em ministry_users garantindo role: 'admin' e permissions: ['ADMINISTRADOR']
    await adminClient.from('ministry_users').upsert(
      {
        ministry_id: tenantId,
        user_id: authUser.id,
        role: roleConfig.role,
        permissions: roleConfig.permissions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ministry_id,user_id' }
    );

    // 5. Idempotência em technical_access_secrets
    const { data: existingSecret } = await adminClient
      .from('technical_access_secrets')
      .select('id, encrypted_password, iv, auth_tag')
      .eq('ministry_id', tenantId)
      .maybeSingle();

    if (!existingSecret) {
      const passwordToEncrypt = initialPasswordToSet || generateStrongPassword();

      // Se a conta já existia no Auth mas não possuía secret (ex: migração de tenant antigo),
      // sincronizamos a nova senha forte no Supabase Auth
      if (!initialPasswordToSet) {
        await adminClient.auth.admin.updateUserById(authUser.id, {
          password: passwordToEncrypt,
        });
      }

      const encrypted = encryptPassword(passwordToEncrypt);
      await adminClient.from('technical_access_secrets').upsert(
        {
          ministry_id: tenantId,
          technical_user_id: authUser.id,
          email: techEmail,
          encrypted_password: encrypted.encryptedPassword,
          iv: encrypted.iv,
          auth_tag: encrypted.authTag,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'ministry_id' }
      );
    }

    // 6. Retorno dos dados formatados da conta técnica
    return {
      authUserId: authUser.id,
      ministryId: tenantId,
      email: techEmail,
      lastSignInAt: authUser.last_sign_in_at || null,
      lastSignInIp: authUser.last_sign_in_ip || null,
      lastSignInUserAgent: authUser.user_metadata?.last_sign_in_user_agent || null,
      hasCredentialsStored: true,
    };
  }

  /**
   * Descriptografa a senha da conta técnica para o Super Admin.
   */
  public static async revealPassword(
    adminClient: SupabaseClient,
    tenantId: string
  ): Promise<{ email: string; plainTextPassword: string }> {
    const { data: secret, error } = await adminClient
      .from('technical_access_secrets')
      .select('email, encrypted_password, iv, auth_tag')
      .eq('ministry_id', tenantId)
      .single();

    if (error || !secret) {
      throw new Error(`Credenciais técnicas não encontradas para o tenant '${tenantId}'. Execute a inicialização da conta.`);
    }

    const plainTextPassword = decryptPassword(secret.encrypted_password, secret.iv, secret.auth_tag);

    return {
      email: secret.email,
      plainTextPassword,
    };
  }

  /**
   * Regenera a senha forte da conta técnica, atualizando o Supabase Auth e
   * a tabela de segredos criptografados, invalidando sessões anteriores.
   */
  public static async regeneratePassword(
    adminClient: SupabaseClient,
    tenantId: string,
    adminId: string
  ): Promise<{ email: string; newPassword: string }> {
    const { data: secret, error } = await adminClient
      .from('technical_access_secrets')
      .select('technical_user_id, email')
      .eq('ministry_id', tenantId)
      .single();

    if (error || !secret) {
      throw new Error(`Credenciais técnicas não encontradas para o tenant '${tenantId}'.`);
    }

    const newPassword = generateStrongPassword();

    // 1. Atualizar a senha no Supabase Auth e revogar sessões ativas
    const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(secret.technical_user_id, {
      password: newPassword,
      ban_duration: 'none',
    });

    if (updateAuthErr) {
      throw new Error(`Erro ao atualizar senha no Supabase Auth: ${updateAuthErr.message}`);
    }

    // 2. Criptografar nova senha e salvar no banco
    const encrypted = encryptPassword(newPassword);
    const { error: updateDbErr } = await adminClient
      .from('technical_access_secrets')
      .upsert(
        {
          ministry_id: tenantId,
          technical_user_id: secret.technical_user_id,
          email: secret.email,
          encrypted_password: encrypted.encryptedPassword,
          iv: encrypted.iv,
          auth_tag: encrypted.authTag,
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        },
        { onConflict: 'ministry_id' }
      );

    if (updateDbErr) {
      throw new Error(`Erro ao salvar senha criptografada: ${updateDbErr.message}`);
    }

    return {
      email: secret.email,
      newPassword,
    };
  }

  /**
   * Obtém a data/hora do último login e informações da conta técnica diretamente do Supabase Auth.
   */
  public static async getLastLogin(
    adminClient: SupabaseClient,
    technicalUserId: string
  ): Promise<{ lastSignInAt: string | null; email: string }> {
    const { data, error } = await adminClient.auth.admin.getUserById(technicalUserId);
    if (error || !data?.user) {
      throw new Error(`Usuário técnico não encontrado no Supabase Auth.`);
    }

    return {
      lastSignInAt: data.user.last_sign_in_at || null,
      email: data.user.email || '',
    };
  }
}
