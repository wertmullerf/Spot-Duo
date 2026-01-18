import { useState, useCallback } from 'react';
import { services, supabaseClient } from '@/config/services';
import { Group, GroupMember } from '@/models/Group';
import { User } from '@/models/User';
import { useAuth } from './useAuth';
import { cache, cacheKeys } from '@/utils/cache';

export function useGroups() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createGroup = useCallback(
    async (name: string): Promise<Group> => {
      try {
        setLoading(true);
        setError(null);
        
        // Usar el usuario del hook useAuth en lugar de hacer una llamada directa
        if (!user) {
          console.error('❌ No hay usuario autenticado en createGroup');
          // Intentar obtener el usuario una vez más usando el servicio de auth
          const currentUser = await services.auth.getCurrentUser();
          if (!currentUser) {
            throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
          }
          console.log('✅ Usuario obtenido del servicio de auth:', currentUser.id);
          const group = await services.database.createGroup(name, currentUser.id);
          
          // Invalidar cache de grupos para que se actualice la lista
          cache.invalidateCache(cacheKeys.userGroups(currentUser.id));
          console.log('✅ Cache de grupos invalidado');
          
          return group;
        }
        
        console.log('✅ Usando usuario del hook useAuth:', user.id);
        const group = await services.database.createGroup(name, user.id);
        
        // Invalidar cache de grupos para que se actualice la lista
        cache.invalidateCache(cacheKeys.userGroups(user.id));
        console.log('✅ Cache de grupos invalidado');
        
        return group;
      } catch (err) {
        console.error('❌ Error en createGroup:', err);
        const error = err instanceof Error ? err : new Error('Error al crear grupo');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user] // Agregar user como dependencia
  );

  const getUserGroups = useCallback(async (): Promise<Group[]> => {
    try {
      setLoading(true);
      setError(null);
      
      // Obtener usuario actual desde auth directamente
      const { data: { user: currentUser }, error: authError } = await supabaseClient.auth.getUser();
      
      if (authError) {
        console.warn('⚠️ Error de autenticación al obtener grupos:', authError);
        // Si es un error de sesión, no es crítico, solo retornar array vacío
        if (authError.message?.includes('session') || authError.message?.includes('JWT')) {
          console.log('ℹ️ No hay sesión activa, retornando grupos vacíos');
          return [];
        }
        throw new Error('Error de autenticación');
      }
      
      if (!currentUser) {
        console.log('ℹ️ No hay usuario autenticado, retornando grupos vacíos');
        return [];
      }
      
      console.log('👥 Obteniendo grupos para usuario:', currentUser.id);
      const cacheKey = cacheKeys.userGroups(currentUser.id);
      const groups = await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await services.database.getUserGroups(currentUser.id);
          console.log('👥 Grupos encontrados:', result.length);
          return result;
        },
        5 * 60 * 1000 // 5 minutos
      );
      return groups;
    } catch (err) {
      console.error('❌ Error en getUserGroups:', err);
      const error = err instanceof Error ? err : new Error('Error al obtener grupos');
      setError(error);
      // En lugar de lanzar error, retornar array vacío para que la UI no se rompa
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getGroupMembers = useCallback(
    async (groupId: string): Promise<User[]> => {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = cacheKeys.groupMembers(groupId);
        const members = await cache.getOrSet(
          cacheKey,
          () => services.database.getGroupMembers(groupId),
          5 * 60 * 1000 // 5 minutos
        );
        return members;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener miembros');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateInviteCode = useCallback(
    async (
      groupId: string,
      expiresAt?: Date,
      maxUses?: number
    ): Promise<string> => {
      try {
        setLoading(true);
        setError(null);
        
        // Usar el usuario del hook useAuth
        if (!user) {
          const currentUser = await services.auth.getCurrentUser();
          if (!currentUser) {
            throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
          }
          const code = await services.database.generateInviteCode(
            groupId,
            currentUser.id,
            expiresAt,
            maxUses
          );
          return code;
        }
        
        const code = await services.database.generateInviteCode(
          groupId,
          user.id,
          expiresAt,
          maxUses
        );
        return code;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al generar código');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user] // Agregar user como dependencia
  );

  const joinGroupByCode = useCallback(
    async (code: string): Promise<Group> => {
      try {
        setLoading(true);
        setError(null);
        
        // Usar el usuario del hook useAuth
        if (!user) {
          const currentUser = await services.auth.getCurrentUser();
          if (!currentUser) {
            throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
          }
          const group = await services.database.joinGroupByCode(code, currentUser.id);
          
          // Invalidar cache de grupos para que se actualice la lista
          cache.invalidateCache(cacheKeys.userGroups(currentUser.id));
          console.log('✅ Cache de grupos invalidado después de unirse');
          
          return group;
        }
        
        const group = await services.database.joinGroupByCode(code, user.id);
        
        // Invalidar cache de grupos para que se actualice la lista
        cache.invalidateCache(cacheKeys.userGroups(user.id));
        console.log('✅ Cache de grupos invalidado después de unirse');
        
        return group;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al unirse al grupo');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user] // Agregar user como dependencia
  );

  const getInviteCodeInfo = useCallback(
    async (code: string): Promise<{
      group_id: string;
      group_name: string;
      is_valid: boolean;
    }> => {
      try {
        setLoading(true);
        setError(null);
        const info = await services.database.getInviteCodeInfo(code);
        return info;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al validar código');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const isGroupOwner = useCallback(
    async (groupId: string): Promise<boolean> => {
      try {
        if (!user) {
          return false;
        }
        
        // Verificar si el usuario tiene rol 'owner' en group_members
        const { supabaseClient } = await import('@/config/services');
        const { data: memberData, error: memberError } = await supabaseClient
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .single();
        
        if (memberError || !memberData) {
          return false;
        }
        
        // Verificar si el rol es 'owner'
        return memberData.role === 'owner';
      } catch (err) {
        return false;
      }
    },
    [user]
  );

  const deleteGroup = useCallback(
    async (groupId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        
        if (!user) {
          throw new Error('Usuario no autenticado');
        }
        
        const result = await services.database.deleteGroup(groupId, user.id);
        
        // Invalidar cache de grupos
        cache.invalidateCache(cacheKeys.userGroups(user.id));
        
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al eliminar grupo');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

    return {
      loading,
      error,
      createGroup,
      getUserGroups,
      getGroupMembers,
      generateInviteCode,
      joinGroupByCode,
      getInviteCodeInfo,
      deleteGroup,
      isGroupOwner,
    };
  }

