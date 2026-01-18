import { useState, useCallback } from 'react';
import { services } from '@/config/services';
import { Place, PlaceDetails, PlaceInput, Coordinates } from '@/models/Place';
import { cache, cacheKeys } from '@/utils/cache';

export function usePlaces() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const searchPlaces = useCallback(
    async (query: string, location: Coordinates): Promise<Place[]> => {
      try {
        setLoading(true);
        setError(null);
        const places = await services.map.searchPlaces(query, location);
        return places;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al buscar lugares');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceDetails> => {
      try {
        setLoading(true);
        setError(null);
        const details = await services.map.getPlaceDetails(placeId);
        return details;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener detalles');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getNearbyPlaces = useCallback(
    async (
      location: Coordinates,
      radius: number,
      type?: string
    ): Promise<Place[]> => {
      try {
        setLoading(true);
        setError(null);
        const places = await services.map.getNearbyPlaces(location, radius, type);
        return places;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener lugares cercanos');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const savePlace = useCallback(
    async (place: PlaceInput): Promise<Place> => {
      try {
        setLoading(true);
        setError(null);
        const savedPlace = await services.database.createPlace(place);
        return savedPlace;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al guardar lugar');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getPlaceById = useCallback(
    async (id: string): Promise<Place | null> => {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = cacheKeys.place(id);
        const place = await cache.getOrSet(
          cacheKey,
          () => services.database.getPlaceById(id),
          10 * 60 * 1000 // 10 minutos
        );
        return place;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener lugar');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getPlaceByExternalId = useCallback(
    async (externalId: string): Promise<Place | null> => {
      try {
        setLoading(true);
        setError(null);
        const place = await services.database.getPlaceByExternalId(externalId);
        return place;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener lugar');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getPlacesWithReviews = useCallback(
    async (groupId?: string): Promise<Place[]> => {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = cacheKeys.placesWithReviews(groupId);
        const places = await cache.getOrSet(
          cacheKey,
          () => services.database.getPlacesWithReviews(groupId),
          2 * 60 * 1000 // 2 minutos
        );
        return places;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener lugares');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    searchPlaces,
    getPlaceDetails,
    getNearbyPlaces,
    savePlace,
    getPlaceById,
    getPlaceByExternalId,
    getPlacesWithReviews,
  };
}

