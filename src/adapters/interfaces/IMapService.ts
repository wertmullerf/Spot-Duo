import { Place, PlaceDetails, Coordinates } from '@/models/Place';

export interface IMapService {
  /**
   * Busca lugares por nombre o categoría
   */
  searchPlaces(query: string, location: Coordinates): Promise<Place[]>;

  /**
   * Obtiene detalles completos de un lugar por su ID externo
   */
  getPlaceDetails(placeId: string): Promise<PlaceDetails>;

  /**
   * Obtiene lugares cercanos a una ubicación
   */
  getNearbyPlaces(
    location: Coordinates,
    radius: number,
    type?: string
  ): Promise<Place[]>;

  /**
   * Convierte una dirección en coordenadas
   */
  geocodeAddress(address: string): Promise<Coordinates>;

  /**
   * Obtiene la dirección a partir de coordenadas
   */
  reverseGeocode(coordinates: Coordinates): Promise<string>;
}

