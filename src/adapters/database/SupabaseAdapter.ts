import { SupabaseClient } from "@supabase/supabase-js";
import { IDatabaseService } from "../interfaces/IDatabaseService";
import {
    Review,
    ReviewInput,
    ReviewUpdate,
    ReviewWithDetails,
    PlaceReviewSummary,
    ReviewPhoto,
} from "@/models/Review";
import { Place, PlaceInput } from "@/models/Place";
import { User } from "@/models/User";
import { Group, GroupMember } from "@/models/Group";

export class SupabaseAdapter implements IDatabaseService {
    private supabase: SupabaseClient;

    constructor(supabase: SupabaseClient) {
        this.supabase = supabase;
    }

    // ========== REVIEWS ==========

    async createReview(review: ReviewInput, userId: string): Promise<Review> {
        try {
            const { data, error } = await this.supabase
                .from("reviews")
                .insert({
                    place_id: review.place_id,
                    user_id: userId,
                    group_id: review.group_id || null,
                    rating: review.rating,
                    comment: review.comment || null,
                    visit_date: review.visit_date || null,
                })
                .select()
                .single();

            if (error) {
                // Mejorar mensajes de error
                if (error.code === '23503') {
                    throw new Error('El lugar o grupo especificado no existe.');
                } else if (error.code === '23505') {
                    throw new Error('Ya has creado una review para este lugar en este grupo.');
                } else if (error.code === '42501') {
                    throw new Error('No tienes permisos para crear esta review.');
                } else if (error.message) {
                    throw new Error(error.message);
                } else {
                    throw new Error('Error al crear la review. Por favor, intenta de nuevo.');
                }
            }
            
            if (!data) {
                throw new Error('No se recibieron datos al crear la review.');
            }
            
            return this.mapReview(data);
        } catch (err) {
            if (err instanceof Error) {
                throw err;
            }
            throw new Error('Error inesperado al crear la review.');
        }
    }

    async getReviewsByPlace(
        placeId: string,
        groupId?: string
    ): Promise<ReviewWithDetails[]> {
        try {
            console.log(
                "🔍 Iniciando getReviewsByPlace para placeId:",
                placeId
            );
            console.log("🔍 groupId:", groupId || "null");

            // Verificar autenticación
            const {
                data: { user: currentUser },
            } = await this.supabase.auth.getUser();
            if (!currentUser) {
                console.warn("⚠️ No hay usuario autenticado");
                return [];
            }

            // Query optimizada: solo campos necesarios, sin join a places (ya tenemos placeId)
            let query = this.supabase
                .from("reviews")
                .select(
                    "id, place_id, user_id, group_id, rating, comment, visit_date, created_at, updated_at"
                )
                .eq("place_id", placeId)
                .order("created_at", { ascending: false });

            if (groupId) {
                // Si hay groupId, SOLO mostrar reviews del grupo específico
                query = query.eq("group_id", groupId);
            } else {
                // Si no hay groupId, mostrar SOLO reviews del usuario actual
                query = query.eq("user_id", currentUser.id);
            }

            console.log("🔍 Ejecutando query...");
            const { data, error } = await query;

            if (error) {
                console.error("❌ Error en getReviewsByPlace:", error);
                console.error("❌ Código del error:", error.code);
                console.error("❌ Mensaje del error:", error.message);

                // Si es un error de permisos o RLS, retornar array vacío
                if (
                    error.code === "PGRST301" ||
                    error.code === "42501" ||
                    error.message?.includes("permission")
                ) {
                    console.warn(
                        "⚠️ Error de permisos (RLS), retornando array vacío"
                    );
                    return [];
                }

                // Si no hay datos, retornar array vacío en lugar de lanzar error
                if (!data) {
                    console.warn(
                        "⚠️ No se encontraron reviews, retornando array vacío"
                    );
                    return [];
                }
                throw error;
            }

            console.log(
                "✅ Query exitosa, reviews encontradas:",
                data?.length || 0
            );

            // Si no hay reviews, retornar array vacío
            if (!data || data.length === 0) {
                console.log("ℹ️ No se encontraron reviews para el lugar");
                return [];
            }

            // Obtener información de usuarios para todas las reviews
            const userIds = [
                ...new Set((data || []).map((r: any) => r.user_id)),
            ];
            const usersMap: Record<string, any> = {};

            // Obtener info del usuario actual (ya lo tenemos arriba)
            if (currentUser) {
                usersMap[currentUser.id] = {
                    id: currentUser.id,
                    email: currentUser.email || "",
                };
            }

            console.log("🔍 Procesando", data.length, "reviews...");

            // OPTIMIZACIÓN: Obtener TODAS las fotos de una vez usando una query
            const reviewIds = data.map((r: any) => r.id);
            let allPhotos: any[] = [];
            if (reviewIds.length > 0) {
                const { data: photosData, error: photosError } =
                    await this.supabase
                        .from("review_photos")
                        .select(
                            "id, review_id, photo_url, storage_path, uploaded_at"
                        )
                        .in("review_id", reviewIds)
                        .order("uploaded_at", { ascending: true });

                if (!photosError && photosData) {
                    allPhotos = photosData;
                    console.log(
                        `✅ ${allPhotos.length} fotos obtenidas en una query`
                    );
                } else if (photosError) {
                    console.warn("⚠️ Error al obtener fotos:", photosError);
                }
            }

            // Crear mapa de fotos por review_id para acceso rápido O(1)
            const photosMap = new Map<string, any[]>();
            allPhotos.forEach((photo) => {
                if (!photosMap.has(photo.review_id)) {
                    photosMap.set(photo.review_id, []);
                }
                // Usar photo_url directamente (ya está en la DB)
                const photoUrl = photo.photo_url;

                photosMap.get(photo.review_id)!.push({
                    id: photo.id,
                    review_id: photo.review_id,
                    photo_url: photoUrl,
                    storage_path: photo.storage_path,
                    uploaded_at: photo.uploaded_at,
                });
            });

            // Obtener información de los lugares para todas las reviews
            const placeIds = [...new Set(data.map((r: any) => r.place_id))];
            const placesMap = new Map<string, Place>();

            if (placeIds.length > 0) {
                // Obtener todos los lugares de una vez
                const { data: placesData, error: placesError } =
                    await this.supabase
                        .from("places")
                        .select(
                            "id, google_place_id, name, address, latitude, longitude, category, created_by, created_at, updated_at"
                        )
                        .in("id", placeIds);

                if (!placesError && placesData) {
                    placesData.forEach((place: any) => {
                        placesMap.set(place.id, this.mapPlace(place));
                    });
                    console.log(
                        `✅ ${placesMap.size} lugares obtenidos para las reviews`
                    );
                } else if (placesError) {
                    console.warn("⚠️ Error al obtener lugares:", placesError);
                }
            }

            // Mapear reviews con fotos y lugares (sin queries individuales - mucho más rápido)
            const reviewsWithPhotos = data.map((review: any) => {
                const mappedReview = this.mapReviewWithDetails(review);
                return {
                    ...mappedReview,
                    place: placesMap.get(review.place_id) || undefined, // Incluir el lugar si está disponible
                    user: usersMap[review.user_id] || {
                        id: review.user_id,
                        email: "",
                    },
                    photos: photosMap.get(review.id) || [],
                };
            });

            console.log(
                "✅ Reviews procesadas exitosamente:",
                reviewsWithPhotos.length
            );
            return reviewsWithPhotos;
        } catch (err) {
            console.error("❌ Error inesperado en getReviewsByPlace:", err);
            console.error(
                "❌ Stack trace:",
                err instanceof Error ? err.stack : "N/A"
            );
            // Retornar array vacío en lugar de lanzar error
            return [];
        }
    }

    async getReviewsByUser(
        userId: string,
        groupId?: string
    ): Promise<ReviewWithDetails[]> {
        try {
            console.log("🔍 Iniciando getReviewsByUser para userId:", userId);
            console.log("🔍 groupId:", groupId || "null");

            // Verificar que el usuario actual sea el mismo que se está consultando
            const {
                data: { user: currentUser },
            } = await this.supabase.auth.getUser();
            if (!currentUser) {
                console.warn("⚠️ No hay usuario autenticado");
                return [];
            }

            // Solo permitir ver reviews del usuario actual
            if (currentUser.id !== userId) {
                console.warn("⚠️ Intento de acceder a reviews de otro usuario");
                return [];
            }

            let query = this.supabase
                .from("reviews")
                .select(
                    `
          *,
          place:places(*)
        `
                )
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (groupId) {
                query = query.eq("group_id", groupId);
            } else {
                // Si no hay groupId, solo mostrar reviews sin grupo o del usuario actual
                query = query.or(`group_id.is.null,user_id.eq.${userId}`);
            }

            console.log("🔍 Ejecutando query...");
            const { data, error } = await query;

            if (error) {
                console.error("❌ Error en getReviewsByUser:", error);
                console.error("❌ Código del error:", error.code);
                console.error("❌ Mensaje del error:", error.message);
                console.error(
                    "❌ Detalles completos:",
                    JSON.stringify(error, null, 2)
                );
                console.error("❌ Query ejecutada para userId:", userId);

                // Si es un error de permisos o RLS, retornar array vacío
                if (
                    error.code === "PGRST301" ||
                    error.code === "42501" ||
                    error.message?.includes("permission")
                ) {
                    console.warn(
                        "⚠️ Error de permisos (RLS), retornando array vacío"
                    );
                    return [];
                }

                // Si no hay datos, retornar array vacío en lugar de lanzar error
                if (!data) {
                    console.warn(
                        "⚠️ No se encontraron reviews, retornando array vacío"
                    );
                    return [];
                }
                throw error;
            }

            console.log(
                "✅ Query exitosa, reviews encontradas:",
                data?.length || 0
            );

            // Si no hay reviews, retornar array vacío
            if (!data || data.length === 0) {
                console.log("ℹ️ No se encontraron reviews para el usuario");
                return [];
            }

            // Obtener información del usuario desde auth
            let userInfo: any = null;
            try {
                console.log("🔍 Obteniendo información del usuario...");
                const { data: userData, error: userError } =
                    await this.supabase.auth.getUser();
                if (userError) {
                    console.warn("⚠️ Error al obtener usuario:", userError);
                }
                if (userData?.user) {
                    userInfo = {
                        id: userData.user.id,
                        email: userData.user.email,
                    };
                    console.log("✅ Usuario obtenido:", userInfo.email);
                }
            } catch (err) {
                console.warn("⚠️ No se pudo obtener info del usuario:", err);
            }

            console.log("🔍 Procesando", data.length, "reviews...");

            // OPTIMIZACIÓN: Obtener TODAS las fotos de una vez
            const reviewIds = data.map((r: any) => r.id);
            let allPhotos: any[] = [];
            if (reviewIds.length > 0) {
                const { data: photosData, error: photosError } =
                    await this.supabase
                        .from("review_photos")
                        .select(
                            "id, review_id, photo_url, storage_path, uploaded_at"
                        )
                        .in("review_id", reviewIds)
                        .order("uploaded_at", { ascending: true });

                if (!photosError && photosData) {
                    allPhotos = photosData;
                    console.log(
                        `✅ ${allPhotos.length} fotos obtenidas en una query`
                    );
                } else if (photosError) {
                    console.warn("⚠️ Error al obtener fotos:", photosError);
                }
            }

            // Crear mapa de fotos por review_id
            const photosMap = new Map<string, any[]>();
            allPhotos.forEach((photo) => {
                if (!photosMap.has(photo.review_id)) {
                    photosMap.set(photo.review_id, []);
                }
                photosMap.get(photo.review_id)!.push({
                    id: photo.id,
                    review_id: photo.review_id,
                    photo_url: photo.photo_url,
                    storage_path: photo.storage_path,
                    uploaded_at: photo.uploaded_at,
                });
            });

            // Mapear reviews con fotos (el place ya viene en review.place desde la query con place:places(*))
            const reviewsWithPhotos = data.map((review: any) => {
                const mappedReview = this.mapReviewWithDetails(review);
                return {
                    ...mappedReview,
                    // El place ya viene en review.place desde la query, mapReviewWithDetails lo mapea
                    user: userInfo || { id: review.user_id, email: "" },
                    photos: photosMap.get(review.id) || [],
                };
            });

            console.log(
                "✅ Reviews procesadas exitosamente:",
                reviewsWithPhotos.length
            );
            return reviewsWithPhotos;
        } catch (err) {
            console.error("❌ Error inesperado en getReviewsByUser:", err);
            console.error(
                "❌ Stack trace:",
                err instanceof Error ? err.stack : "N/A"
            );
            // Retornar array vacío en lugar de lanzar error
            return [];
        }
    }

    async getPlaceReviewSummary(
        placeId: string,
        groupId?: string
    ): Promise<PlaceReviewSummary> {
        const reviews = await this.getReviewsByPlace(placeId, groupId);

        const averageRating =
            reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;

        return {
            place_id: placeId,
            average_rating: Math.round(averageRating * 100) / 100,
            review_count: reviews.length,
            reviews,
        };
    }

    async updateReview(
        reviewId: string,
        review: ReviewUpdate,
        userId: string
    ): Promise<Review> {
        const updateData: any = {};

        if (review.rating !== undefined) updateData.rating = review.rating;
        if (review.comment !== undefined) updateData.comment = review.comment;
        if (review.visit_date !== undefined)
            updateData.visit_date = review.visit_date;

        const { data, error } = await this.supabase
            .from("reviews")
            .update(updateData)
            .eq("id", reviewId)
            .eq("user_id", userId)
            .select()
            .single();

        if (error) throw error;
        return this.mapReview(data);
    }

    async deleteReview(reviewId: string, userId: string): Promise<boolean> {
        const { error } = await this.supabase
            .from("reviews")
            .delete()
            .eq("id", reviewId)
            .eq("user_id", userId);

        if (error) throw error;
        return true;
    }

    async addReviewPhotos(
        reviewId: string,
        photoUrls: string[],
        storagePaths: string[]
    ): Promise<void> {
        if (photoUrls.length !== storagePaths.length) {
            throw new Error(
                "photoUrls y storagePaths deben tener la misma longitud"
            );
        }

        const photos = photoUrls.map((url, index) => ({
            review_id: reviewId,
            photo_url: url,
            storage_path: storagePaths[index],
        }));

        const { error } = await this.supabase
            .from("review_photos")
            .insert(photos);

        if (error) {
            console.error("Error al guardar fotos:", error);
            throw error;
        }
    }

    // ========== PLACES ==========

    async createPlace(place: PlaceInput): Promise<Place> {
        try {
            console.log("🔍 Creando lugar en Supabase:", place);

            // Obtener usuario actual
            const {
                data: { user: currentUser },
                error: authError,
            } = await this.supabase.auth.getUser();
            if (authError || !currentUser) {
                throw new Error("Usuario no autenticado");
            }

            // Verificar si ya existe por google_place_id
            if (place.google_place_id) {
                const existing = await this.getPlaceByExternalId(
                    place.google_place_id
                );
                if (existing) {
                    console.log(
                        "⚠️ Lugar ya existe, retornando existente:",
                        existing.id
                    );
                    return existing;
                }
            }

            // Crear lugar con user_id del creador
            const { data, error } = await this.supabase
                .from("places")
                .insert({
                    ...place,
                    created_by: currentUser.id,
                })
                .select()
                .single();

            if (error) {
                console.error("❌ Error al crear lugar:", error);
                throw error;
            }
            console.log("✅ Lugar creado:", data);
            return this.mapPlace(data);
        } catch (err) {
            console.error("❌ Error completo en createPlace:", err);
            throw err;
        }
    }

    async getPlaceById(id: string): Promise<Place | null> {
        const { data, error } = await this.supabase
            .from("places")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            if (error.code === "PGRST116") return null; // No encontrado
            throw error;
        }

        return data ? this.mapPlace(data) : null;
    }

    async getPlaceByExternalId(externalId: string): Promise<Place | null> {
        const { data, error } = await this.supabase
            .from("places")
            .select("*")
            .eq("google_place_id", externalId)
            .single();

        if (error) {
            if (error.code === "PGRST116") return null;
            throw error;
        }

        return data ? this.mapPlace(data) : null;
    }

    async getNearbyPlaces(
        latitude: number,
        longitude: number,
        radiusKm: number
    ): Promise<Place[]> {
        // Usar función de distancia (requiere extensión postgis o cálculo manual)
        // Por ahora, usamos un bounding box simple
        const latDelta = radiusKm / 111; // Aproximadamente 111km por grado
        const lngDelta =
            radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

        const { data, error } = await this.supabase
            .from("places")
            .select("*")
            .gte("latitude", latitude - latDelta)
            .lte("latitude", latitude + latDelta)
            .gte("longitude", longitude - lngDelta)
            .lte("longitude", longitude + lngDelta);

        if (error) throw error;

        // Filtrar por distancia real (cálculo simple)
        return (data || [])
            .map((p) => this.mapPlace(p))
            .filter((place) => {
                const distance = this.calculateDistance(
                    latitude,
                    longitude,
                    place.latitude,
                    place.longitude
                );
                return distance <= radiusKm;
            });
    }

    async searchPlaces(query: string): Promise<Place[]> {
        const { data, error } = await this.supabase
            .from("places")
            .select("*")
            .ilike("name", `%${query}%`)
            .limit(50);

        if (error) throw error;
        return (data || []).map((p) => this.mapPlace(p));
    }

    async getPlacesWithReviews(groupId?: string): Promise<Place[]> {
        try {
            console.log(
                "🔍 Obteniendo lugares con reviews, groupId:",
                groupId || "null"
            );

            // Verificar autenticación
            const {data: { user: currentUser }, } = await this.supabase.auth.getUser();
            if (!currentUser) {
                console.warn(
                    "⚠️ No hay usuario autenticado en getPlacesWithReviews"
                );
                return [];
            }

            // Query optimizada: obtener lugares con promedio y conteo de reviews en una sola query
            let reviewsQuery = this.supabase
                .from("reviews")
                .select("place_id, rating");

            if (groupId) {
                reviewsQuery = reviewsQuery.eq("group_id", groupId);
            } else {
                // Sin grupo, solo reviews del usuario actual
                reviewsQuery = reviewsQuery.eq("user_id", currentUser.id);
            }

            const { data: reviewsData, error: reviewsError } = await reviewsQuery;

            if (reviewsError) {
                console.error("❌ Error al obtener reviews:", reviewsError);
                return [];
            }

            if (!reviewsData || reviewsData.length === 0) {
                console.log("ℹ️ No hay reviews para calcular lugares");
                return [];
            }

            // Agrupar por place_id y calcular promedio
            const placeStats = new Map<string, { ratings: number[], count: number }>();
            reviewsData.forEach((review: any) => {
                if (!placeStats.has(review.place_id)) {
                    placeStats.set(review.place_id, { ratings: [], count: 0 });
                }
                const stats = placeStats.get(review.place_id)!;
                stats.ratings.push(review.rating);
                stats.count++;
            });

            // Obtener IDs únicos de lugares
            const placeIds = Array.from(placeStats.keys());

            // Obtener información de lugares en una sola query
            const { data: placesData, error: placesError } = await this.supabase
                .from("places")
                .select("*")
                .in("id", placeIds);

            if (placesError) {
                console.error("❌ Error al obtener lugares:", placesError);
                return [];
            }

            // Mapear lugares con estadísticas
            const places: Place[] = (placesData || []).map((place: any) => {
                const stats = placeStats.get(place.id);
                const averageRating = stats
                    ? stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length
                    : 0;

                return {
                    ...this.mapPlace(place),
                    average_rating: Math.round(averageRating * 100) / 100,
                    review_count: stats?.count || 0,
                };
            });

            // Ordenar por fecha de creación más reciente (o por rating si prefieres)
            places.sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            });

            console.log("✅ Lugares con reviews encontrados:", places.length);
            return places;
        } catch (err) {
            console.error("❌ Error inesperado en getPlacesWithReviews:", err);
            return [];
        }
    }

    // ========== GROUPS ==========

    async getGroupMembers(groupId: string): Promise<User[]> {
        try {
            console.log("👥 Obteniendo miembros del grupo:", groupId);

            const { data, error } = await this.supabase
                .from("group_members")
                .select("user_id, role, joined_at")
                .eq("group_id", groupId)
                .order("joined_at", { ascending: true });

            if (error) {
                console.error("❌ Error en getGroupMembers query:", error);
                console.error("❌ Código del error:", error.code);
                console.error("❌ Mensaje del error:", error.message);
                throw error;
            }

            console.log("👥 Miembros encontrados en DB:", data?.length || 0);

            // Obtener información de usuarios desde auth
            const userIds = (data || []).map((m: any) => m.user_id);
            const users: User[] = [];

            // Obtener información del usuario actual
            try {
                const { data: currentUser, error: userError } =
                    await this.supabase.auth.getUser();
                if (userError) {
                    console.warn(
                        "⚠️ Error al obtener usuario actual:",
                        userError
                    );
                }

                if (currentUser?.user) {
                    // Si el usuario actual está en la lista, agregarlo con su información completa
                    if (userIds.includes(currentUser.user.id)) {
                        users.push({
                            id: currentUser.user.id,
                            email: currentUser.user.email || "",
                            name: currentUser.user.user_metadata?.name,
                        });
                    }
                }
            } catch (err) {
                console.warn("⚠️ No se pudo obtener usuario actual:", err);
            }

            // Para otros usuarios, crear objetos básicos con el ID
            // En una app real, podrías tener una tabla de perfiles de usuario
            userIds.forEach((userId: string) => {
                if (!users.find((u) => u.id === userId)) {
                    users.push({
                        id: userId,
                        email: `Usuario ${userId.substring(0, 8)}...`, // Placeholder
                        name: undefined,
                    });
                }
            });

            console.log("👥 Total de usuarios retornados:", users.length);
            return users;
        } catch (err) {
            console.error("❌ Error completo en getGroupMembers:", err);
            throw err;
        }
    }

    async addGroupMember(
        groupId: string,
        userId: string,
        role: "owner" | "member" = "member"
    ): Promise<GroupMember> {
        const { data, error } = await this.supabase
            .from("group_members")
            .insert({
                group_id: groupId,
                user_id: userId,
                role,
            })
            .select()
            .single();

        if (error) throw error;
        return this.mapGroupMember(data);
    }

    async getUserGroups(userId: string): Promise<Group[]> {
        const { data, error } = await this.supabase
            .from("group_members")
            .select(
                `
        group_id,
        group:groups(*)
      `
            )
            .eq("user_id", userId);

        if (error) throw error;
        return (data || []).map((item: any) => this.mapGroup(item.group));
    }

    async createGroup(name: string, ownerId: string): Promise<Group> {
        try {
            console.log("🔍 [createGroup] Iniciando creación de grupo:", {
                name,
                ownerId,
            });

            // Usar función RPC que bypass RLS para evitar recursión
            console.log(
                "🔍 [createGroup] Llamando a función create_group_with_owner..."
            );
            const { data: group, error: rpcError } = await this.supabase.rpc(
                "create_group_with_owner",
                {
                    p_name: name,
                    p_owner_id: ownerId,
                }
            );

            if (rpcError) {
                console.error("❌ [createGroup] Error en RPC:", rpcError);
                console.error(
                    "❌ [createGroup] Código del error:",
                    rpcError.code
                );
                console.error(
                    "❌ [createGroup] Mensaje del error:",
                    rpcError.message
                );
                throw rpcError;
            }

            if (!group) {
                throw new Error("No se pudo crear el grupo");
            }

            console.log("✅ [createGroup] Grupo creado con owner:", group.id);
            return this.mapGroup(group);
        } catch (err) {
            throw err;
        }
    }

    async deleteGroup(groupId: string, userId: string): Promise<boolean> {
        try {
            // Usar función RPC que bypass RLS para eliminar el grupo
            const { data, error: rpcError } = await this.supabase.rpc(
                "delete_group_by_owner",
                {
                    p_group_id: groupId,
                    p_user_id: userId,
                }
            );

            if (rpcError) {
                // Mejorar mensajes de error
                if (rpcError.message.includes("owner")) {
                    throw new Error("Solo el creador del grupo puede eliminarlo");
                } else if (rpcError.message) {
                    throw new Error(rpcError.message);
                } else {
                    throw new Error("Error al eliminar el grupo");
                }
            }

            return true;
        } catch (err) {
            if (err instanceof Error) {
                throw err;
            }
            throw new Error("Error inesperado al eliminar el grupo");
        }
    }

    async generateInviteCode(
        groupId: string,
        createdBy: string,
        expiresAt?: Date,
        maxUses?: number
    ): Promise<string> {
        // Generar código único
        let code: string = "";
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            code = this.generateCode();

            // Verificar si el código ya existe
            const { data: existing } = await this.supabase
                .from("group_invite_codes")
                .select("id")
                .eq("code", code)
                .single();

            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique || !code) {
            throw new Error("No se pudo generar un código único");
        }

        // Si no se especifica expiresAt, hacer el código válido por 1 año (para testing)
        // Para hacerlo completamente permanente, puedes cambiar esto a null
        const expirationDate =
            expiresAt ||
            (() => {
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                console.log(
                    "📅 Código válido hasta:",
                    oneYearFromNow.toISOString()
                );
                return oneYearFromNow;
            })();

        // Crear código de invitación
        const { data, error } = await this.supabase
            .from("group_invite_codes")
            .insert({
                group_id: groupId,
                code,
                created_by: createdBy,
                expires_at: expirationDate.toISOString(),
                max_uses: maxUses || null, // null = ilimitado
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;

        console.log("📅 Expira el:", expirationDate.toISOString());
        return code;
    }

    async joinGroupByCode(code: string, userId: string): Promise<Group> {
        try {
            console.log(
                "🔍 [joinGroupByCode] Iniciando unión con código:",
                code
            );

            // Obtener información del código (sin filtrar por RLS para permitir lectura)
            // Usar RPC o función que bypass RLS para verificar el código
            const { data: inviteCode, error: codeError } = await this.supabase
                .from("group_invite_codes")
                .select("*, group:groups(*)")
                .eq("code", code.toUpperCase().trim())
                .eq("is_active", true)
                .single();

            if (codeError || !inviteCode) {
                console.error(
                    "❌ [joinGroupByCode] Código no encontrado:",
                    codeError
                );
                throw new Error("Código de invitación inválido o expirado");
            }

            console.log(
                "✅ [joinGroupByCode] Código encontrado:",
                inviteCode.id
            );

            // Si el grupo no se cargó por RLS, obtenerlo directamente
            let group = inviteCode.group;
            if (!group && inviteCode.group_id) {
                console.log(
                    "⚠️ [joinGroupByCode] Grupo no cargado, obteniendo directamente..."
                );
                const { data: groupData, error: groupError } =
                    await this.supabase
                        .from("groups")
                        .select("*")
                        .eq("id", inviteCode.group_id)
                        .single();

                if (groupError) {
                    console.error(
                        "❌ [joinGroupByCode] Error al obtener grupo:",
                        groupError
                    );
                    // Continuar de todas formas, usaremos el group_id
                } else {
                    group = groupData;
                    console.log(
                        "✅ [joinGroupByCode] Grupo obtenido directamente"
                    );
                }
            }

            if (!group) {
                throw new Error("No se pudo obtener información del grupo");
            }

            // Verificar expiración
            if (inviteCode.expires_at) {
                const expiresAt = new Date(inviteCode.expires_at);
                if (expiresAt < new Date()) {
                    throw new Error("El código de invitación ha expirado");
                }
            }

            // Verificar límite de usos
            if (
                inviteCode.max_uses &&
                inviteCode.uses_count >= inviteCode.max_uses
            ) {
                throw new Error(
                    "El código de invitación ha alcanzado su límite de usos"
                );
            }

            // Verificar si el usuario ya es miembro (usar función RPC para evitar RLS)
            const { data: existingMember, error: memberCheckError } =
                await this.supabase
                    .from("group_members")
                    .select("id")
                    .eq("group_id", inviteCode.group_id)
                    .eq("user_id", userId)
                    .maybeSingle();

            if (memberCheckError) {
                console.error(
                    "❌ [joinGroupByCode] Error al verificar membresía:",
                    memberCheckError
                );
                // Continuar de todas formas, puede ser un error de RLS
            }

            if (existingMember) {
                console.log("⚠️ [joinGroupByCode] Usuario ya es miembro");
                // Retornar el grupo en lugar de lanzar error
                return this.mapGroup(group);
            }

            console.log("🔍 [joinGroupByCode] Agregando usuario al grupo...");

            // Agregar usuario al grupo usando función RPC que bypass RLS
            const { data: newMember, error: addError } =
                await this.supabase.rpc("add_group_member_by_code", {
                    p_group_id: inviteCode.group_id,
                    p_user_id: userId,
                    p_role: "member",
                });

            if (addError) {
                console.error(
                    "❌ [joinGroupByCode] Error al agregar miembro:",
                    addError
                );
                // Intentar método directo como fallback
                try {
                    await this.addGroupMember(
                        inviteCode.group_id,
                        userId,
                        "member"
                    );
                } catch (fallbackError) {
                    console.error(
                        "❌ [joinGroupByCode] Error en fallback:",
                        fallbackError
                    );
                    throw new Error(
                        "No se pudo agregar al grupo. Verifica que tengas permisos."
                    );
                }
            }

            // Incrementar contador de usos
            const { error: updateError } = await this.supabase
                .from("group_invite_codes")
                .update({ uses_count: (inviteCode.uses_count || 0) + 1 })
                .eq("id", inviteCode.id);

            if (updateError) {
                console.warn(
                    "⚠️ [joinGroupByCode] No se pudo actualizar contador:",
                    updateError
                );
                // No es crítico, continuar
            }

            console.log("✅ [joinGroupByCode] Usuario agregado exitosamente");
            return this.mapGroup(group);
        } catch (err) {
            console.error("❌ [joinGroupByCode] Error completo:", err);
            throw err;
        }
    }

    async getInviteCodeInfo(code: string): Promise<{
        group_id: string;
        group_name: string;
        is_valid: boolean;
    }> {
        const { data: inviteCode, error } = await this.supabase
            .from("group_invite_codes")
            .select("*, group:groups(*)")
            .eq("code", code)
            .eq("is_active", true)
            .single();

        if (error || !inviteCode) {
            return {
                group_id: "",
                group_name: "",
                is_valid: false,
            };
        }

        // Verificar expiración
        let is_valid = true;
        if (inviteCode.expires_at) {
            const expiresAt = new Date(inviteCode.expires_at);
            is_valid = expiresAt >= new Date();
        }

        // Verificar límite de usos
        if (
            inviteCode.max_uses &&
            inviteCode.uses_count >= inviteCode.max_uses
        ) {
            is_valid = false;
        }

        return {
            group_id: inviteCode.group_id,
            group_name: inviteCode.group?.name || "",
            is_valid,
        };
    }

    private generateCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // ========== HELPERS ==========

    private async getReviewPhotos(reviewId: string): Promise<ReviewPhoto[]> {
        try {
            const { data, error } = await this.supabase
                .from("review_photos")
                .select("*")
                .eq("review_id", reviewId)
                .order("uploaded_at", { ascending: true });

            if (error) {
                console.warn(
                    `Error al obtener fotos para review ${reviewId}:`,
                    error
                );
                return []; // Retornar array vacío en lugar de lanzar error
            }

            // Regenerar URLs usando storage_path si está disponible
            // Esto asegura que las URLs sean válidas incluso si cambió la configuración
            return await Promise.all(
                (data || []).map(async (photo) => {
                    let photoUrl = photo.photo_url;

                    // Siempre regenerar la URL usando storage_path para asegurar que sea válida
                    if (photo.storage_path) {
                        try {
                            // Verificar si el storage_path tiene extensión (es un archivo)
                            const hasExtension =
                                /\.(jpg|jpeg|png|webp|gif)$/i.test(
                                    photo.storage_path
                                );

                            if (hasExtension) {
                                // El path es un archivo completo, usar directamente
                                const { data: urlData } = this.supabase.storage
                                    .from("review-photos")
                                    .getPublicUrl(photo.storage_path);

                                if (urlData?.publicUrl) {
                                    photoUrl = urlData.publicUrl;
                                    console.log(
                                        "📸 URL regenerada para foto (archivo completo):",
                                        {
                                            storage_path: photo.storage_path,
                                            url: photoUrl,
                                        }
                                    );
                                }
                            } else {
                                // El path es un directorio, buscar el archivo dentro
                                console.log(
                                    "📸 Storage path es directorio, buscando archivos en:",
                                    photo.storage_path
                                );

                                const { data: files, error: listError } =
                                    await this.supabase.storage
                                        .from("review-photos")
                                        .list(photo.storage_path, {
                                            limit: 10,
                                            sortBy: {
                                                column: "created_at",
                                                order: "desc",
                                            },
                                        });

                                if (!listError && files && files.length > 0) {
                                    // Encontrar el primer archivo de imagen
                                    const imageFile = files.find(
                                        (f) =>
                                            f.name &&
                                            /\.(jpg|jpeg|png|webp|gif)$/i.test(
                                                f.name
                                            )
                                    );

                                    if (imageFile) {
                                        // Construir el path completo - asegurar que no haya doble slash
                                        const cleanPath =
                                            photo.storage_path.endsWith("/")
                                                ? photo.storage_path.slice(
                                                      0,
                                                      -1
                                                  )
                                                : photo.storage_path;
                                        const fullPath = `${cleanPath}/${imageFile.name}`;

                                        const { data: urlData } =
                                            this.supabase.storage
                                                .from("review-photos")
                                                .getPublicUrl(fullPath);

                                        if (urlData?.publicUrl) {
                                            photoUrl = urlData.publicUrl;
                                            console.log(
                                                "📸 URL regenerada para foto (encontrado en directorio):",
                                                {
                                                    directory:
                                                        photo.storage_path,
                                                    file: imageFile.name,
                                                    full_path: fullPath,
                                                    url: photoUrl,
                                                }
                                            );

                                            // Verificar que la URL sea accesible haciendo una petición HEAD
                                            try {
                                                const response = await fetch(
                                                    photoUrl,
                                                    { method: "HEAD" }
                                                );
                                                if (!response.ok) {
                                                    console.warn(
                                                        "⚠️ URL generada pero archivo no accesible:",
                                                        {
                                                            status: response.status,
                                                            statusText:
                                                                response.statusText,
                                                            url: photoUrl,
                                                        }
                                                    );
                                                } else {
                                                    console.log(
                                                        "✅ Archivo verificado y accesible:",
                                                        photoUrl
                                                    );
                                                }
                                            } catch (fetchError) {
                                                console.warn(
                                                    "⚠️ Error al verificar archivo:",
                                                    fetchError
                                                );
                                            }
                                        }
                                    } else {
                                        console.warn(
                                            "⚠️ No se encontraron archivos de imagen en:",
                                            photo.storage_path
                                        );
                                        console.warn(
                                            "⚠️ Archivos encontrados:",
                                            files.map((f) => f.name)
                                        );
                                    }
                                } else {
                                    console.warn(
                                        "⚠️ Error al listar archivos o directorio vacío:",
                                        listError || "sin archivos"
                                    );
                                    if (listError) {
                                        console.warn(
                                            "⚠️ Detalles del error:",
                                            JSON.stringify(listError, null, 2)
                                        );
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn(
                                "⚠️ Error al regenerar URL, usando URL guardada:",
                                err
                            );
                            console.warn(
                                "⚠️ Storage path:",
                                photo.storage_path
                            );
                            // Si falla, usar la URL guardada
                        }
                    } else {
                        console.warn(
                            "⚠️ Foto sin storage_path, usando URL guardada:",
                            photo.photo_url
                        );
                    }

                    return {
                        id: photo.id,
                        review_id: photo.review_id,
                        photo_url: photoUrl,
                        storage_path: photo.storage_path,
                        uploaded_at: photo.uploaded_at,
                    };
                })
            );
        } catch (err) {
            console.warn(
                `Error inesperado al obtener fotos para review ${reviewId}:`,
                err
            );
            return []; // Retornar array vacío en caso de error
        }
    }

    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371; // Radio de la Tierra en km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private mapReview(data: any): Review {
        return {
            id: data.id,
            place_id: data.place_id,
            user_id: data.user_id,
            group_id: data.group_id,
            rating: data.rating,
            comment: data.comment,
            visit_date: data.visit_date,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };
    }

    private mapReviewWithDetails(data: any): ReviewWithDetails {
        return {
            ...this.mapReview(data),
            place: data.place ? this.mapPlace(data.place) : undefined,
            user: data.user
                ? {
                      id: data.user.id,
                      email: data.user.email,
                      name: data.user.user_metadata?.name,
                  }
                : undefined,
        };
    }

    private mapPlace(data: any): Place {
        return {
            id: data.id,
            google_place_id: data.google_place_id,
            name: data.name,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            category: data.category,
            created_by: data.created_by,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };
    }

    private mapGroup(data: any): Group {
        return {
            id: data.id,
            name: data.name,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };
    }

    private mapGroupMember(data: any): GroupMember {
        return {
            id: data.id,
            group_id: data.group_id,
            user_id: data.user_id,
            role: data.role,
            joined_at: data.joined_at,
        };
    }
}
