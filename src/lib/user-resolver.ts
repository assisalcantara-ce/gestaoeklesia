import { SupabaseClient } from '@supabase/supabase-js';

export interface UserResolution {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Resolve usuários em lote de forma resiliente e de alta performance.
 * 1. Consulta a tabela public.admin_users por user_id.
 * 2. Para IDs não encontrados em admin_users, consulta auth.admin.getUserById.
 */
export async function resolverUsuariosEmLote(
  supabaseAdmin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, UserResolution>> {
  const mapa = new Map<string, UserResolution>();
  const idsLimpos = Array.from(
    new Set(userIds.filter((id) => id && typeof id === 'string' && id.trim().length > 0 && id !== '00000000-0000-0000-0000-000000000000'))
  );

  if (idsLimpos.length === 0) {
    return mapa;
  }

  // 1. Tentar resolver via public.admin_users
  try {
    const { data: adminUsers } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, name, nome, email')
      .in('user_id', idsLimpos);

    (adminUsers || []).forEach((au: any) => {
      if (au.user_id) {
        mapa.set(au.user_id, {
          id: au.user_id,
          name: au.name || au.nome || au.email || 'Administrador',
          email: au.email || null,
        });
      }
    });
  } catch (e) {
    console.error('Erro ao consultar admin_users:', e);
  }

  // 2. Para IDs restantes, tentar resolver via auth.admin.getUserById
  const idsRestantes = idsLimpos.filter((id) => !mapa.has(id));
  if (idsRestantes.length > 0) {
    await Promise.all(
      idsRestantes.map(async (uid) => {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (!error && data?.user) {
            const u = data.user;
            const meta = u.user_metadata || {};
            const nome = meta.full_name || meta.name || meta.nome || u.email || 'Usuário';
            mapa.set(uid, {
              id: uid,
              name: nome,
              email: u.email || null,
            });
          }
        } catch {
          // Ignorar erros individuais do Auth
        }
      })
    );
  }

  return mapa;
}

/**
 * Resolve os dados cadastrais básicos de um único usuário.
 */
export async function resolverUsuarioIndividual(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<UserResolution | null> {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return null;
  }

  const cleanId = userId.trim();
  const mapa = await resolverUsuariosEmLote(supabaseAdmin, [cleanId]);
  return mapa.get(cleanId) || null;
}
