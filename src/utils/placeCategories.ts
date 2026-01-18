import { Ionicons } from "@expo/vector-icons";

export type PlaceCategory = 
  | 'cafe'
  | 'restaurant'
  | 'burger'
  | 'pizza'
  | 'bar'
  | 'bakery'
  | 'ice_cream'
  | 'fast_food'
  | 'other';

export interface CategoryInfo {
  id: PlaceCategory;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const PLACE_CATEGORIES: CategoryInfo[] = [
  {
    id: 'cafe',
    name: 'Café',
    icon: 'cafe-outline',
    color: '#8B4513',
  },
  {
    id: 'restaurant',
    name: 'Restaurante',
    icon: 'restaurant-outline',
    color: '#FF6B6B',
  },
  {
    id: 'burger',
    name: 'Hamburguesas',
    icon: 'fast-food-outline',
    color: '#FFA500',
  },
  {
    id: 'pizza',
    name: 'Pizza',
    icon: 'pizza-outline',
    color: '#FF6347',
  },
  {
    id: 'bar',
    name: 'Bar',
    icon: 'wine-outline',
    color: '#9370DB',
  },
  {
    id: 'bakery',
    name: 'Panadería',
    icon: 'basket-outline',
    color: '#DEB887',
  },
  {
    id: 'ice_cream',
    name: 'Heladería',
    icon: 'ice-cream-outline',
    color: '#87CEEB',
  },
  {
    id: 'fast_food',
    name: 'Comida Rápida',
    icon: 'restaurant-outline',
    color: '#FFD700',
  },
  {
    id: 'other',
    name: 'Otro',
    icon: 'location-outline',
    color: '#808080',
  },
];

export function getCategoryInfo(category?: string | null): CategoryInfo {
  const found = PLACE_CATEGORIES.find(c => c.id === category);
  return found || PLACE_CATEGORIES[PLACE_CATEGORIES.length - 1]; // 'other' por defecto
}

export function getCategoryIcon(category?: string | null): keyof typeof Ionicons.glyphMap {
  return getCategoryInfo(category).icon;
}

export function getCategoryColor(category?: string | null): string {
  return getCategoryInfo(category).color;
}

