import { useState, useCallback } from 'react';
import { services } from '@/config/services';
import {
  Review,
  ReviewInput,
  ReviewUpdate,
  ReviewWithDetails,
  PlaceReviewSummary,
} from '@/models/Review';
import { useAuth } from './useAuth';
import { cache, cacheKeys } from '@/utils/cache';

export function useReviews() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper para detectar MIME type desde ArrayBuffer
  const detectMimeTypeFromBuffer = (buffer: ArrayBuffer): string => {
    const view = new Uint8Array(buffer);
    // Verificar magic numbers
    if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47) {
      return 'image/png';
    }
    if (view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF) {
      return 'image/jpeg';
    }
    if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
      return 'image/webp';
    }
    return 'image/jpeg'; // Default
  };

  const createReview = useCallback(
    async (review: ReviewInput): Promise<Review> => {
      if (!user) throw new Error('Usuario no autenticado');

      try {
        setLoading(true);
        setError(null);

        // Guardar lugar si no existe
        let placeId = review.place_id;
        if (review.place_id.startsWith('google_')) {
          // Es un Google Place ID, necesitamos guardarlo primero
          const placeDetails = await services.map.getPlaceDetails(
            review.place_id.replace('google_', '')
          );
          const savedPlace = await services.database.createPlace({
            google_place_id: placeDetails.google_place_id,
            name: placeDetails.name,
            address: placeDetails.address,
            latitude: placeDetails.latitude,
            longitude: placeDetails.longitude,
            category: placeDetails.category,
          });
          placeId = savedPlace.id;
        }

        // Subir fotos si hay
        let photoUrls: string[] = [];
        let storagePaths: string[] = [];
        if (review.photos && review.photos.length > 0 && user) {
          const timestamp = Date.now();
          const uploadPromises = review.photos.map(async (arrayBuffer, index) => {
            // El path base sin extensión - uploadImageWithPath agregará timestamp y extensión
            const basePath = `${user.id}/reviews/${timestamp}_${index}`;
            // Detectar tipo MIME basado en los primeros bytes del ArrayBuffer
            const mimeType = detectMimeTypeFromBuffer(arrayBuffer);
            // Usar uploadImageWithPath para obtener el path real del archivo subido
            const result = await (services.storage as any).uploadImageWithPath(arrayBuffer, basePath, mimeType);
            return { url: result.url, path: result.path };
          });
          const results = await Promise.all(uploadPromises);
          photoUrls = results.map(r => r.url);
          storagePaths = results.map(r => r.path);
        }

        // Crear review
        const newReview = await services.database.createReview(
          { ...review, place_id: placeId },
          user.id
        );

        // Guardar URLs de fotos en la base de datos
        if (photoUrls.length > 0) {
          await services.database.addReviewPhotos(newReview.id, photoUrls, storagePaths);
        }

        // Invalidar cache relacionado - usar invalidateCache directo para ser más específico
        const groupIdKey = review.group_id || 'no-group';
        cache.invalidateCache(`place:${placeId}:reviews:${groupIdKey}`);
        cache.invalidateCache(`place:${placeId}:reviews:all`);
        cache.invalidateCache(`user:${user.id}:reviews:${groupIdKey}`);
        cache.invalidateCache(`user:${user.id}:reviews:all`);
        cache.invalidateCache(`places:reviews:${groupIdKey}`);
        cache.invalidateCache('places:reviews:all');
        
        // Invalidar también el summary que usa PlaceDetailScreen
        cache.invalidateCache(`place-summary:${placeId}:${groupIdKey}`);
        cache.invalidateCache(`place-summary:${placeId}:all`);

        return newReview;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al crear review');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const getReviewsByPlace = useCallback(
    async (placeId: string, groupId?: string): Promise<ReviewWithDetails[]> => {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = cacheKeys.placeReviews(placeId, groupId);
        const reviews = await cache.getOrSet(
          cacheKey,
          () => services.database.getReviewsByPlace(placeId, groupId),
          2 * 60 * 1000 // 2 minutos
        );
        return reviews;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener reviews');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getReviewsByUser = useCallback(
    async (userId: string, groupId?: string): Promise<ReviewWithDetails[]> => {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = cacheKeys.userReviews(userId, groupId);
        const reviews = await cache.getOrSet(
          cacheKey,
          async () => {
            const result = await services.database.getReviewsByUser(userId, groupId);
            return result;
          },
          2 * 60 * 1000 // 2 minutos
        );
        return reviews;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener reviews');
        setError(error);
        // En lugar de lanzar error, retornar array vacío para que la UI no se rompa
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getPlaceReviewSummary = useCallback(
    async (placeId: string, groupId?: string): Promise<PlaceReviewSummary> => {
      try {
        setLoading(true);
        setError(null);
        const summary = await services.database.getPlaceReviewSummary(
          placeId,
          groupId
        );
        return summary;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al obtener resumen');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateReview = useCallback(
    async (reviewId: string, review: ReviewUpdate): Promise<Review> => {
      if (!user) throw new Error('Usuario no autenticado');

      try {
        setLoading(true);
        setError(null);

        // Manejar fotos a eliminar
        if (review.photos_to_delete && review.photos_to_delete.length > 0) {
          await Promise.all(
            review.photos_to_delete.map((path) =>
              services.storage.deleteImage(path)
            )
          );
        }

        // Manejar fotos nuevas
        let newPhotoUrls: string[] = [];
        if (review.photos_to_add && review.photos_to_add.length > 0 && user) {
          const uploadPromises = review.photos_to_add.map((file, index) => {
            const path = `${user.id}/reviews/${Date.now()}_${index}`;
            return services.storage.uploadImage(file, path);
          });
          newPhotoUrls = await Promise.all(uploadPromises);
        }

        const updatedReview = await services.database.updateReview(
          reviewId,
          review,
          user.id
        );

        // TODO: Actualizar fotos en la base de datos

        return updatedReview;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al actualizar review');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const deleteReview = useCallback(
    async (reviewId: string): Promise<boolean> => {
      if (!user) throw new Error('Usuario no autenticado');

      try {
        setLoading(true);
        setError(null);
        const result = await services.database.deleteReview(reviewId, user.id);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al eliminar review');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return {
    loading,
    error,
    createReview,
    getReviewsByPlace,
    getReviewsByUser,
    getPlaceReviewSummary,
    updateReview,
    deleteReview,
  };
}

