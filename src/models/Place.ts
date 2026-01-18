export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  google_place_id?: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  category?: string;
  created_by?: string; // ID del usuario que creó el lugar
  created_at?: string;
  updated_at?: string;
  distance?: number; // Distancia en kilómetros desde la ubicación del usuario
  average_rating?: number; // Puntaje promedio de reviews
  review_count?: number; // Cantidad de reviews
}

export interface PlaceDetails extends Place {
  phone_number?: string;
  website?: string;
  rating?: number; // Rating de Google
  price_level?: number;
  photos?: string[]; // URLs de fotos de Google
  opening_hours?: {
    open_now: boolean;
    weekday_text?: string[];
  };
}

export interface PlaceInput {
  google_place_id?: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  category?: string;
}

