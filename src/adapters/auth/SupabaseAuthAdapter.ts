import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IAuthService } from '../interfaces/IAuthService';
import { User } from '@/models/User';

export class SupabaseAuthAdapter implements IAuthService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No se pudo iniciar sesión');

    return this.mapUser(data.user);
  }

  async signUp(
    email: string,
    password: string,
    name?: string
  ): Promise<User> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('No se pudo registrar el usuario');

    return this.mapUser(data.user);
  }

  async signInWithGoogle(): Promise<User> {
    // Nota: Google OAuth en React Native requiere configuración adicional
    // con expo-auth-session o react-native-google-signin
    // Para el MVP, este método está deshabilitado
    throw new Error(
      'Google OAuth requiere configuración adicional en React Native. ' +
      'Usa expo-auth-session o react-native-google-signin para implementarlo.'
    );
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      // Si no hay sesión, no es un error, simplemente retornar null
      if (error) {
        // Si es un error de sesión no válida, no es un error crítico
        if (error.message?.includes('session') || error.message?.includes('JWT')) {
          return null;
        }
        throw error;
      }
      return user ? this.mapUser(user) : null;
    } catch (err) {
      // Si hay cualquier error, simplemente retornar null (no hay usuario)
      console.warn('Error al obtener usuario actual:', err);
      return null;
    }
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? this.mapUser(session.user) : null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  async updateProfile(updates: {
    name?: string;
    avatar_url?: string;
  }): Promise<User> {
    const { data, error } = await this.supabase.auth.updateUser({
      data: updates,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No se pudo actualizar el perfil');

    return this.mapUser(data.user);
  }

  private mapUser(user: any): User {
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0],
      avatar_url: user.user_metadata?.avatar_url,
      created_at: user.created_at,
    };
  }

  // Método helper para obtener el cliente de Supabase (útil para otros adapters)
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

