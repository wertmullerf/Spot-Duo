import { useState, useEffect } from 'react';
import { services } from '@/config/services';
import { User } from '@/models/User';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Obtener usuario actual
    services.auth
      .getCurrentUser()
      .then((user) => {
        setUser(user);
        setError(null); // Limpiar errores previos
      })
      .catch((err) => {
        // No mostrar error si simplemente no hay usuario autenticado
        if (err?.message?.includes('auth') || err?.message?.includes('session')) {
          console.log('No hay sesión activa');
          setUser(null);
          setError(null);
        } else {
          setError(err);
        }
      })
      .finally(() => setLoading(false));

    // Suscribirse a cambios de autenticación
    const unsubscribe = services.auth.onAuthStateChange((newUser) => {
      setUser(newUser);
      setError(null); // Limpiar errores cuando cambia el estado
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const authenticatedUser = await services.auth.signIn(email, password);
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al iniciar sesión');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      setLoading(true);
      setError(null);
      const newUser = await services.auth.signUp(email, password, name);
      setUser(newUser);
      return newUser;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al registrarse');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await services.auth.signOut();
      setUser(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al cerrar sesión');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const authenticatedUser = await services.auth.signInWithGoogle();
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al autenticarse con Google');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: { name?: string; avatar_url?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const updatedUser = await services.auth.updateProfile(updates);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al actualizar perfil');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updateProfile,
    isAuthenticated: !!user,
  };
}

