import { IMapService } from '../interfaces/IMapService';
import { Place, PlaceDetails, Coordinates } from '@/models/Place';

/**
 * OpenStreetMap/Nominatim Adapter - COMPLETAMENTE GRATUITO
 * 
 * ✅ Sin límites (con uso razonable)
 * ✅ Sin API Key requerida
 * ✅ Open Source
 * 
 * IMPORTANTE: Para producción, considera usar tu propio servidor Nominatim
 * o respetar el rate limit: 1 request por segundo
 * 
 * Documentación: https://nominatim.org/release-docs/develop/api/Overview/
 */
export class OpenStreetMapAdapter implements IMapService {
  private baseUrl = 'https://nominatim.openstreetmap.org';
  private userAgent: string;

  constructor(userAgent: string = 'SharedReviewsApp/1.0') {
    this.userAgent = userAgent;
  }

  async searchPlaces(query: string, location: Coordinates, maxRadiusKm: number = 10): Promise<Place[]> {
    // Buscar lugares con un radio máximo de 10km por defecto
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(
      query
    )}&format=json&lat=${location.latitude}&lon=${location.longitude}&limit=50&addressdetails=1&bounded=1&radius=${maxRadiusKm * 1000}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Mapear y calcular distancias
    const places = (data || []).map((item: any) => {
      const place = this.mapOSMToPlace(item);
      // Calcular distancia desde la ubicación del usuario
      place.distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        place.latitude,
        place.longitude
      );
      return place;
    });

    // Filtrar lugares dentro del radio máximo y ordenar por distancia
    return places
      .filter((place) => place.distance <= maxRadiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 20); // Limitar a 20 resultados más cercanos
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    // Nominatim usa OSM IDs (type/id)
    const url = `${this.baseUrl}/lookup?osm_ids=${placeId}&format=json&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Place not found: ${placeId}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      throw new Error(`Place not found: ${placeId}`);
    }

    return this.mapOSMToPlaceDetails(data[0]);
  }

  async getNearbyPlaces(
    location: Coordinates,
    radius: number,
    type?: string
  ): Promise<Place[]> {
    // Nominatim no tiene búsqueda directa por radio
    // Usamos búsqueda por categoría cerca de la ubicación
    const category = type || 'amenity';
    const url = `${this.baseUrl}/search?q=${category}&format=json&lat=${location.latitude}&lon=${location.longitude}&limit=20&addressdetails=1&radius=${radius}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.statusText}`);
    }

    const data = await response.json();
    return (data || []).map((item: any) => this.mapOSMToPlace(item));
  }

  async geocodeAddress(address: string): Promise<Coordinates> {
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(
      address
    )}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      throw new Error('No results found');
    }

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<string> {
    const url = `${this.baseUrl}/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}&format=json&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || !data.address) {
      throw new Error('No address found');
    }

    // Construir dirección desde componentes
    const addr = data.address;
    const parts = [
      addr.road,
      addr.house_number,
      addr.city || addr.town || addr.village,
      addr.country,
    ].filter(Boolean);

    return parts.join(', ') || data.display_name || '';
  }

  private mapOSMToPlace(item: any): Place {
    return {
      id: '',
      google_place_id: `${item.osm_type[0].toUpperCase()}${item.osm_id}`, // Formato: N123456
      name: item.display_name?.split(',')[0] || item.name || 'Sin nombre',
      address: item.display_name || '',
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      category: item.type || item.class || 'establishment',
    };
  }

  private mapOSMToPlaceDetails(item: any): PlaceDetails {
    const place = this.mapOSMToPlace(item);
    const address = item.address || {};

    return {
      ...place,
      phone_number: item.extratags?.phone,
      website: item.extratags?.website,
      // OpenStreetMap no proporciona rating directamente
      rating: undefined,
      price_level: undefined,
      photos: undefined,
      opening_hours: item.extratags?.opening_hours
        ? {
            open_now: false, // Necesitarías parsear opening_hours
            weekday_text: undefined,
          }
        : undefined,
    };
  }

  /**
   * Calcula la distancia en kilómetros entre dos puntos usando la fórmula de Haversine
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

