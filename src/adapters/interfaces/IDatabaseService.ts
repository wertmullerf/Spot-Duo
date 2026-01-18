import {
  Review,
  ReviewInput,
  ReviewUpdate,
  ReviewWithDetails,
  PlaceReviewSummary,
} from '@/models/Review';
import { Place, PlaceInput } from '@/models/Place';
import { User } from '@/models/User';
import { Group, GroupMember } from '@/models/Group';

export interface IDatabaseService {
  // ========== REVIEWS ==========
  /**
   * Crea una nueva review
   */
  createReview(review: ReviewInput, userId: string): Promise<Review>;

  /**
   * Obtiene todas las reviews de un lugar
   */
  getReviewsByPlace(
    placeId: string,
    groupId?: string
  ): Promise<ReviewWithDetails[]>;

  /**
   * Obtiene todas las reviews de un usuario
   */
  getReviewsByUser(userId: string, groupId?: string): Promise<ReviewWithDetails[]>;

  /**
   * Obtiene un resumen de reviews de un lugar (promedio, cantidad)
   */
  getPlaceReviewSummary(
    placeId: string,
    groupId?: string
  ): Promise<PlaceReviewSummary>;

  /**
   * Actualiza una review existente
   */
  updateReview(
    reviewId: string,
    review: ReviewUpdate,
    userId: string
  ): Promise<Review>;

  /**
   * Elimina una review
   */
  deleteReview(reviewId: string, userId: string): Promise<boolean>;

  /**
   * Agrega fotos a una review
   */
  addReviewPhotos(reviewId: string, photoUrls: string[], storagePaths: string[]): Promise<void>;

  // ========== PLACES ==========
  /**
   * Crea o actualiza un lugar
   */
  createPlace(place: PlaceInput): Promise<Place>;

  /**
   * Obtiene un lugar por ID
   */
  getPlaceById(id: string): Promise<Place | null>;

  /**
   * Obtiene un lugar por Google Place ID
   */
  getPlaceByExternalId(externalId: string): Promise<Place | null>;

  /**
   * Obtiene lugares cercanos a coordenadas
   */
  getNearbyPlaces(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<Place[]>;

  /**
   * Busca lugares por nombre
   */
  searchPlaces(query: string): Promise<Place[]>;

  /**
   * Obtiene lugares que tienen reviews (lugares guardados)
   */
  getPlacesWithReviews(groupId?: string): Promise<Place[]>;

  // ========== GROUPS ==========
  /**
   * Obtiene los miembros de un grupo
   */
  getGroupMembers(groupId: string): Promise<User[]>;

  /**
   * Agrega un miembro a un grupo
   */
  addGroupMember(
    groupId: string,
    userId: string,
    role?: 'owner' | 'member'
  ): Promise<GroupMember>;

  /**
   * Obtiene los grupos de un usuario
   */
  getUserGroups(userId: string): Promise<Group[]>;

  /**
   * Crea un nuevo grupo
   */
  createGroup(name: string, ownerId: string): Promise<Group>;

  /**
   * Elimina un grupo (solo el owner puede hacerlo)
   */
  deleteGroup(groupId: string, userId: string): Promise<boolean>;
}

