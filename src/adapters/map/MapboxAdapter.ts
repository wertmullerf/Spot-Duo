import { IMapService } from '../interfaces/IMapService';
import { Place, PlaceDetails, Coordinates } from '@/models/Place';

/**
 * Mapbox Adapter - Alternativa GRATUITA a Google Maps
 * 
 * Plan gratuito: 50,000 requests/mes
 * Después: $0.50 por cada 1,000 requests adicionales
 * 
 * Documentación: https://docs.mapbox.com/api/
 */
export class MapboxAdapter implements IMapService {
  private accessToken: string;
  private baseUrl = 'https://api.mapbox.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async searchPlaces(query: string, location: Coordinates): Promise<Place[]> {
    // Mapbox Geocoding API
    const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?proximity=${location.longitude},${location.latitude}&access_token=${
      this.accessToken
    }&types=poi,address`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${data.message || 'Unknown error'}`);
    }

    return (data.features || []).map((feature: any) =>
      this.mapFeatureToPlace(feature)
    );
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    // Mapbox usa un formato diferente para place IDs
    // Necesitamos hacer una búsqueda inversa o usar el ID directamente
    const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${placeId}.json?access_token=${this.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.features || data.features.length === 0) {
      throw new Error(`Place not found: ${placeId}`);
    }

    return this.mapFeatureToPlaceDetails(data.features[0]);
  }

  async getNearbyPlaces(
    location: Coordinates,
    radius: number,
    type?: string
  ): Promise<Place[]> {
    // Mapbox no tiene una API directa de "nearby places"
    // Usamos búsqueda por categoría cerca de la ubicación
    const categories = type
      ? this.mapCategoryToMapbox(type)
      : 'restaurant,cafe,bar,shop,hotel';

    const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${categories}.json?proximity=${location.longitude},${location.latitude}&radius=${radius}&access_token=${this.accessToken}&types=poi`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${data.message || 'Unknown error'}`);
    }

    return (data.features || []).map((feature: any) =>
      this.mapFeatureToPlace(feature)
    );
  }

  async geocodeAddress(address: string): Promise<Coordinates> {
    const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(
      address
    )}.json?access_token=${this.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.features || data.features.length === 0) {
      throw new Error(`Geocoding failed: ${data.message || 'No results'}`);
    }

    const [longitude, latitude] = data.features[0].center;
    return { latitude, longitude };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<string> {
    const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${coordinates.longitude},${coordinates.latitude}.json?access_token=${this.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.features || data.features.length === 0) {
      throw new Error(`Reverse geocoding failed: ${data.message || 'No results'}`);
    }

    return data.features[0].place_name || '';
  }

  private mapFeatureToPlace(feature: any): Place {
    const [longitude, latitude] = feature.center || feature.geometry.coordinates;
    const properties = feature.properties || {};

    return {
      id: '', // Se asignará al guardar en DB
      google_place_id: feature.id, // Usamos el ID de Mapbox
      name: feature.text || properties.name || 'Sin nombre',
      address: feature.place_name || properties.address || '',
      latitude,
      longitude,
      category: properties.category || properties.type || 'establishment',
    };
  }

  private mapFeatureToPlaceDetails(feature: any): PlaceDetails {
    const place = this.mapFeatureToPlace(feature);
    const properties = feature.properties || {};

    return {
      ...place,
      phone_number: properties.phone,
      website: properties.website,
      rating: properties.rating,
      // Mapbox no proporciona price_level directamente
      price_level: undefined,
      // Mapbox no proporciona fotos directamente
      photos: undefined,
      opening_hours: properties.opening_hours
        ? {
            open_now: properties.opening_hours.includes('open'),
            weekday_text: undefined,
          }
        : undefined,
    };
  }

  private mapCategoryToMapbox(category: string): string {
    const categoryMap: Record<string, string> = {
      restaurant: 'restaurant',
      cafe: 'cafe',
      bar: 'bar',
      store: 'shop',
      hotel: 'hotel',
      attraction: 'tourist',
    };

    return categoryMap[category.toLowerCase()] || 'poi';
  }
}

