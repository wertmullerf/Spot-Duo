import { IMapService } from '../interfaces/IMapService';
import { Place, PlaceDetails, Coordinates } from '@/models/Place';

export class GoogleMapsAdapter implements IMapService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchPlaces(query: string, location: Coordinates): Promise<Place[]> {
    const url = `${this.baseUrl}/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&location=${location.latitude},${location.longitude}&key=${this.apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    return (data.results || []).map((result: any) => this.mapPlace(result));
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    const url = `${this.baseUrl}/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,place_id,rating,user_ratings_total,formatted_phone_number,website,photos,opening_hours,price_level&key=${this.apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    return this.mapPlaceDetails(data.result);
  }

  async getNearbyPlaces(
    location: Coordinates,
    radius: number,
    type?: string
  ): Promise<Place[]> {
    let url = `${this.baseUrl}/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${radius}&key=${this.apiKey}`;

    if (type) {
      url += `&type=${type}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    return (data.results || []).map((result: any) => this.mapPlace(result));
  }

  async geocodeAddress(address: string): Promise<Coordinates> {
    const url = `${this.baseUrl}/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${this.apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<string> {
    const url = `${this.baseUrl}/geocode/json?latlng=${coordinates.latitude},${coordinates.longitude}&key=${this.apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error(`Reverse geocoding failed: ${data.status}`);
    }

    return data.results[0].formatted_address;
  }

  private mapPlace(result: any): Place {
    return {
      id: '', // Se asignará al guardar en DB
      google_place_id: result.place_id,
      name: result.name,
      address: result.formatted_address || result.vicinity,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      category: result.types?.[0] || 'establishment',
    };
  }

  private mapPlaceDetails(result: any): PlaceDetails {
    const place = this.mapPlace(result);

    return {
      ...place,
      phone_number: result.formatted_phone_number,
      website: result.website,
      rating: result.rating,
      price_level: result.price_level,
      photos: result.photos?.map((photo: any) =>
        this.getPhotoUrl(photo.photo_reference)
      ),
      opening_hours: result.opening_hours
        ? {
            open_now: result.opening_hours.open_now,
            weekday_text: result.opening_hours.weekday_text,
          }
        : undefined,
    };
  }

  private getPhotoUrl(photoReference: string): string {
    return `${this.baseUrl}/place/photo?maxwidth=400&photoreference=${photoReference}&key=${this.apiKey}`;
  }
}

