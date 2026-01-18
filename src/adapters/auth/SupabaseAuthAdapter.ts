import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { IAuthService } from '../interfaces/IAuthService';
import { User } from '@/models/User';

// Importante: ayuda a cerrar/completar la sesión del navegador en Expo
WebBrowser.maybeCompleteAuthSession();

export class SupabaseAuthAdapter implements IAuthService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // en RN/Expo lo manejamos nosotros
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

  async signUp(email: string, password: string, name?: string): Promise<User> {
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
    try {
      // Generar URL de redirección que coincida EXACTAMENTE con Supabase
      // IMPORTANTE: Esta URL DEBE estar en "Redirect URLs" en Supabase, NO en "Site URL"
      let redirectUrl = Linking.createURL('auth/callback');
      
      // Si la URL generada es exp:// (Expo Go), asegurar el formato correcto
      if (redirectUrl.startsWith('exp://')) {
        // En Expo Go: debe ser exp://127.0.0.1:19000/--/auth/callback
        // Si no tiene /--/, ajustarlo
        if (!redirectUrl.includes('/--/')) {
          redirectUrl = redirectUrl.replace('exp://', 'exp://127.0.0.1:19000/--/');
          if (!redirectUrl.endsWith('/auth/callback')) {
            redirectUrl = 'exp://127.0.0.1:19000/--/auth/callback';
          }
        }
      } else if (!redirectUrl.startsWith('sharedreviews://')) {
        // Si no es exp:// ni sharedreviews://, usar el scheme de app.json
        redirectUrl = 'sharedreviews://auth/callback';
      }

      // Verificar que la URL se generó correctamente
      if (!redirectUrl || !redirectUrl.includes('://')) {
        throw new Error(`URL de redirección inválida generada: ${redirectUrl}`);
      }

      // Log temporal para debugging - verificar qué URL se está usando
      // IMPORTANTE: Esta URL debe coincidir EXACTAMENTE con una en "Redirect URLs" en Supabase
      // Si no coincide, Supabase usará el "Site URL" como fallback
      
      // Iniciar flujo OAuth con Google
      // IMPORTANTE: El redirectTo debe coincidir EXACTAMENTE con una URL en la lista de "Redirect URLs" en Supabase
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false, // Asegurar que use el navegador
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        // Mensajes de error más descriptivos según el tipo de error
        if (error.message?.includes('redirect_url')) {
          throw new Error(
            `URL de redirección no válida. Asegúrate de agregar "${redirectUrl}" a la lista de "Redirect URLs" en Supabase Dashboard > Authentication > URL Configuration`
          );
        }
        if (error.message?.includes('provider') || error.message?.includes('OAuth')) {
          throw new Error(
            `Error de configuración OAuth. Verifica que Google OAuth esté habilitado en Supabase Dashboard > Authentication > Providers > Google`
          );
        }
        throw new Error(`Error al iniciar OAuth con Google: ${error.message || 'Error desconocido'}`);
      }

      if (!data?.url) {
        throw new Error(
          'No se pudo obtener la URL de autenticación de Google. Verifica la configuración OAuth en Supabase'
        );
      }

      // Abrir navegador para autenticación
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        {
          // Opciones adicionales para mejor experiencia
          preferEphemeralSession: false, // Compartir cookies para mejor UX
          showInRecents: false,
        }
      );

      // Manejar diferentes tipos de resultado
      if (result.type === 'cancel') {
        throw new Error('Autenticación cancelada por el usuario');
      }

      if (result.type === 'dismiss') {
        throw new Error('El navegador fue cerrado antes de completar la autenticación');
      }

      if (result.type !== 'success' || !result.url) {
        throw new Error('La autenticación no se completó correctamente');
      }

      // Extraer código de autorización de la URL de retorno
      // Supabase usa PKCE flow: la URL contiene ?code=... o #code=...
      const { error: exchangeError } = await this.supabase.auth.exchangeCodeForSession(result.url);
      
      if (exchangeError) {
        if (exchangeError.message?.includes('code') || exchangeError.message?.includes('session')) {
          throw new Error(
            `Error al procesar la autenticación. El código de autorización es inválido o expiró. Por favor, intenta de nuevo.`
          );
        }
        throw new Error(`Error al intercambiar código por sesión: ${exchangeError.message || 'Error desconocido'}`);
      }

      // Obtener usuario autenticado después del intercambio
      const {
        data: { user },
        error: userError,
      } = await this.supabase.auth.getUser();

      if (userError) {
        throw new Error(`Error al obtener usuario: ${userError.message}`);
      }

      if (!user) {
        throw new Error('No se pudo obtener la información del usuario autenticado');
      }

      return this.mapUser(user);
    } catch (err) {
      // Mejorar mensajes de error para debugging
      if (err instanceof Error) {
        // Re-lanzar el error original con mensaje mejorado
        throw err;
      }
      throw new Error('Error desconocido al autenticarse con Google');
    }
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

      if (error) {
        // Si es un error de sesión inválida/no autenticado, retornar null (no es un error)
        const isSessionError = 
          error.message?.includes('session') ||
          error.message?.includes('JWT') ||
          error.message?.includes('token') ||
          error.message?.includes('unauthorized') ||
          error.status === 401;

        if (isSessionError) {
          return null;
        }
        // Para otros errores, lanzar excepción
        throw error;
      }

      return user ? this.mapUser(user) : null;
    } catch (err) {
      // Solo loguear errores inesperados, pero retornar null para mantener la app funcionando
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

  async updateProfile(updates: { name?: string; avatar_url?: string }): Promise<User> {
    const { data, error } = await this.supabase.auth.updateUser({
      data: updates,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No se pudo actualizar el perfil');

    return this.mapUser(data.user);
  }

  private mapUser(user: any): User {
    // Extraer información del usuario de Supabase
    // Para Google OAuth, el nombre puede venir de user_metadata.full_name o user_metadata.name
    const name = 
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username ||
      user.email?.split('@')[0] ||
      'Usuario';

    // Para Google OAuth, la imagen del avatar viene en user_metadata.avatar_url
    const avatar_url =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      undefined;

    return {
      id: user.id,
      email: user.email || '',
      name,
      avatar_url,
      created_at: user.created_at,
    };
  }

  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}
