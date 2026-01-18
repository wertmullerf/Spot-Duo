import { User } from '@/models/User';

export interface IAuthService {
  /**
   * Inicia sesión con email y contraseña
   */
  signIn(email: string, password: string): Promise<User>;

  /**
   * Registra un nuevo usuario
   */
  signUp(email: string, password: string, name?: string): Promise<User>;

  /**
   * Inicia sesión con Google
   */
  signInWithGoogle(): Promise<User>;

  /**
   * Cierra sesión
   */
  signOut(): Promise<void>;

  /**
   * Obtiene el usuario actual
   */
  getCurrentUser(): Promise<User | null>;

  /**
   * Suscribe a cambios en el estado de autenticación
   * Retorna una función para desuscribirse
   */
  onAuthStateChange(
    callback: (user: User | null) => void
  ): () => void;

  /**
   * Actualiza el perfil del usuario
   */
  updateProfile(updates: { name?: string; avatar_url?: string }): Promise<User>;
}

