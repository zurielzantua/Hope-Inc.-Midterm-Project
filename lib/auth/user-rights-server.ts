import { authorizeRequest, createSessionClient } from '@/lib/auth/server';
import type { UserRight } from '@/lib/auth/user-rights';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function userRightsDependencies() {
  return {
    async getActor() {
      const access = await authorizeRequest();
      if (!access.allowed) return null;
      const client = await createSessionClient();
      const { data, error } = await client.auth.getUser();
      if (error) {
        if ([400, 401, 403].includes(error.status ?? 0)) return null;
        throw error;
      }
      if (!data.user) return null;
      return { userId: data.user.id, role: access.role };
    },
    async loadRights(targetUserId: string): Promise<unknown> {
      const client = await createSessionClient();
      const { data, error } = await client.rpc('get_user_permissions', { p_target_user_id: targetUserId });
      if (error) throw error;
      if (!Array.isArray(data)) return data;
      return data.map((value): UserRight | null => {
        if (!record(value)) return null;
        if (typeof value.module_code !== 'string' || typeof value.module_name !== 'string' ||
            typeof value.right_code !== 'string' || typeof value.right_name !== 'string' ||
            typeof value.is_assigned !== 'boolean') return null;
        const moduleId = Number(value.module_id);
        const rightId = Number(value.right_id);
        return {
          moduleId,
          moduleCode: String(value.module_code),
          moduleName: String(value.module_name),
          rightId,
          rightCode: String(value.right_code),
          rightName: String(value.right_name),
          isAssigned: value.is_assigned,
        };
      }).filter((right): right is UserRight => right !== null);
    },
    async saveRights(targetUserId: string, rightIds: number[]) {
      const client = await createSessionClient();
      const { data, error } = await client.rpc('set_user_permissions', {
        p_target_user_id: targetUserId,
        p_right_ids: rightIds,
      });
      if (error) throw error;
      return data === true;
    },
  };
}
