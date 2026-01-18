export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface UserProfile extends User {
  groups?: string[]; // IDs de grupos a los que pertenece
}

