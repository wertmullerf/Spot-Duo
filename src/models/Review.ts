import { User } from './User';
import { Place } from './Place';

export interface ReviewPhoto {
  id: string;
  review_id: string;
  photo_url: string;
  storage_path: string;
  uploaded_at: string;
}

export interface Review {
  id: string;
  place_id: string;
  user_id: string;
  group_id?: string;
  rating: number; // 1-5
  comment?: string;
  visit_date?: string; // ISO date string
  created_at: string;
  updated_at?: string;
  photos?: ReviewPhoto[];
}

export interface ReviewWithDetails extends Review {
  place?: Place;
  user?: User;
}

export interface ReviewInput {
  place_id: string;
  group_id?: string;
  rating: number;
  comment?: string;
  visit_date?: string;
  photos?: ArrayBuffer[]; // Para subir (ArrayBuffer para React Native)
}

export interface ReviewUpdate {
  rating?: number;
  comment?: string;
  visit_date?: string;
  photos_to_delete?: string[]; // IDs de fotos a eliminar
  photos_to_add?: File[]; // Nuevas fotos
}

export interface PlaceReviewSummary {
  place_id: string;
  average_rating: number;
  review_count: number;
  reviews: ReviewWithDetails[];
}

