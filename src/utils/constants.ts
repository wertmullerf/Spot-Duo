// Constantes de la aplicación

export const APP_NAME = 'Shared Reviews';

// Configuración de mapas
export const DEFAULT_MAP_REGION = {
  latitude: -34.6037, // Buenos Aires (cambiar según necesidad)
  longitude: -58.3816,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export const MAP_SEARCH_RADIUS = 5000; // 5km en metros

// Configuración de reviews
export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const DEFAULT_RATING = 3;

// Límites
export const MAX_PHOTOS_PER_REVIEW = 3;
export const MAX_PHOTO_SIZE_MB = 5;

// Categorías de lugares
export const PLACE_CATEGORIES = [
  'restaurant',
  'cafe',
  'bar',
  'store',
  'hotel',
  'attraction',
  'other',
] as const;

export type PlaceCategory = typeof PLACE_CATEGORIES[number];

// Colores para pins según rating (paleta más profesional)
export const RATING_COLORS: Record<number, string> = {
  1: '#E74C3C', // Rojo
  2: '#F39C12', // Naranja
  3: '#F1C40F', // Amarillo
  4: '#2ECC71', // Verde
  5: '#27AE60', // Verde oscuro
};

// Colores de la app (actualizados para coincidir con theme.ts)
export const COLORS = {
  primary: '#2C3E50',
  secondary: '#7F8C8D',
  success: '#27AE60',
  warning: '#F39C12',
  error: '#E74C3C',
  background: '#FFFFFF',
  text: '#2C3E50',
  textSecondary: '#7F8C8D',
  border: '#E1E8ED',
};

