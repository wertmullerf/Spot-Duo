import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Dimensions,
    Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { usePlaces } from "@/hooks/usePlaces";
import { useReviews } from "@/hooks/useReviews";
import { useAuth } from "@/hooks/useAuth";
import { Place } from "@/models/Place";
import { ReviewWithDetails } from "@/models/Review";
import { RouteProp } from "@react-navigation/native";
import { PlaceDetailScreenNavigationProp } from "@/types/navigation";
import { RootStackParamList } from "@/types/navigation";
import { theme } from "@/utils/theme";
import { StarRating } from "@/components/StarRating";
import { supabaseClient } from "@/config/services";

type PlaceDetailScreenRouteProp = RouteProp<RootStackParamList, "PlaceDetail">;

interface Props {
    navigation: PlaceDetailScreenNavigationProp;
    route: PlaceDetailScreenRouteProp;
}

export function PlaceDetailScreen({ navigation, route }: Props) {
    const { placeId, groupId } = route.params;
    const [place, setPlace] = useState<Place | null>(null);
    const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
    const [averageRating, setAverageRating] = useState(0);
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { getPlaceById, loading: placeLoading } = usePlaces();
    const { getPlaceReviewSummary, deleteReview, loading: reviewsLoading } = useReviews();
    const { user } = useAuth();

    const loadPlaceData = useCallback(async () => {
        try {
            const placeData = await getPlaceById(placeId);
            setPlace(placeData);

            if (placeData) {
                // Pasar groupId si está disponible para filtrar reviews del grupo
                const summary = await getPlaceReviewSummary(placeId, groupId);
                setReviews(summary.reviews);
                setAverageRating(summary.average_rating);

                console.log("📊 Resumen de reviews cargado:", {
                    totalReviews: summary.reviews.length,
                    averageRating: summary.average_rating,
                    reviewsWithPhotos: summary.reviews.filter(
                        (r) => r.photos && r.photos.length > 0
                    ).length,
                });
            }
        } catch (error) {
            console.error("❌ Error al cargar datos del lugar:", error);
            Alert.alert("Error", "No se pudo cargar la información del lugar");
        }
    }, [placeId, groupId, getPlaceById, getPlaceReviewSummary]);

    useEffect(() => {
        loadPlaceData();
    }, [loadPlaceData]);

    // Suscripción en tiempo real a cambios en reviews
    useEffect(() => {
        if (!placeId) return;

        console.log("🔄 Configurando suscripción en tiempo real para place:", placeId);

        const reviewsSubscription = supabaseClient
            .channel(`place-reviews:${placeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'reviews',
                    filter: `place_id=eq.${placeId}`,
                },
                (payload) => {
                    // Invalidar cache y recargar datos del lugar cuando hay cambios
                    const { cache, cacheKeys } = require('@/utils/cache');
                    cache.invalidateCache(cacheKeys.placeReviews(placeId, groupId));
                    cache.invalidateCache(cacheKeys.place(placeId));
                    loadPlaceData();
                }
            )
            .subscribe();

        return () => {
            console.log("🔄 Limpiando suscripción en tiempo real");
            supabaseClient.removeChannel(reviewsSubscription);
        };
    }, [placeId, loadPlaceData]);

    useFocusEffect(
        useCallback(() => {
            // Forzar recarga sin cache cuando se vuelve a la pantalla
            const reloadData = async () => {
                try {
                    // Invalidar cache antes de recargar
                    const { cache } = await import("@/utils/cache");
                    cache.invalidatePattern(`place-summary:${placeId}`);
                    cache.invalidatePattern(`place:${placeId}:reviews`);

                    const placeData = await getPlaceById(placeId);
                    setPlace(placeData);
                    if (placeData) {
                        // Obtener summary (sin cache por la invalidación anterior) - pasar groupId si está disponible
                        const summary = await getPlaceReviewSummary(
                            placeId,
                            groupId
                        );
                        setReviews(summary.reviews);
                        setAverageRating(summary.average_rating);
                    }
                } catch (error) {
                    console.error("❌ Error al recargar datos:", error);
                }
            };
            reloadData();
            // Limpiar errores de imágenes al recargar
            setImageErrors(new Set());
        }, [placeId, groupId, getPlaceById, getPlaceReviewSummary])
    );

    const handleImageError = useCallback((photoId: string, url: string) => {
        console.error("❌ Error al cargar imagen:", { photoId, url });
        setImageErrors((prev) => new Set(prev).add(photoId));
    }, []);

    if (placeLoading || reviewsLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Cargando...</Text>
            </View>
        );
    }

    if (!place) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Lugar no encontrado</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.name}>{place.name}</Text>
                {place.address && (
                    <Text style={styles.address}>{place.address}</Text>
                )}
                {averageRating > 0 && (
                    <View style={styles.ratingContainer}>
                        <View style={styles.ratingRow}>
                            <StarRating
                                rating={Math.round(averageRating)}
                                readonly
                                size={20}
                            />
                            <Text style={styles.ratingText}>
                                ({averageRating.toFixed(1)})
                            </Text>
                        </View>
                        <Text style={styles.reviewCount}>
                            {reviews.length}{" "}
                            {reviews.length === 1 ? "review" : "reviews"}
                        </Text>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={styles.addReviewButton}
                onPress={() =>
                    navigation.navigate("AddReview", {
                        placeId: place.id,
                        placeName: place.name,
                        ...(groupId ? { groupId } : {}),
                    })
                }
            >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.addReviewButtonText}>Agregar Review</Text>
            </TouchableOpacity>

            <View style={styles.reviewsSection}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                {reviews.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons
                            name="chatbubbles-outline"
                            size={48}
                            color={theme.colors.textSecondary}
                        />
                        <Text style={styles.emptyText}>
                            Aún no hay reviews para este lugar
                        </Text>
                        <Text style={styles.emptySubtext}>
                            ¡Sé el primero en compartir tu experiencia!
                        </Text>
                    </View>
                ) : (
                    reviews.map((review, index) => (
                        <View
                            key={
                                review.id ||
                                `review-${index}-${review.place_id}`
                            }
                            style={styles.reviewCard}
                        >
                            <View style={styles.reviewHeader}>
                                <View style={styles.reviewUserContainer}>
                                    <Ionicons
                                        name="person-circle-outline"
                                        size={24}
                                        color={theme.colors.primary}
                                    />
                                    <Text style={styles.reviewUser}>
                                        {review.user?.email?.split("@")[0] ||
                                            "Usuario"}
                                    </Text>
                                </View>
                                <View style={styles.reviewHeaderRight}>
                                    <StarRating
                                        rating={review.rating}
                                        readonly
                                        size={18}
                                    />
                                    {user && review.user_id === user.id && (
                                        <TouchableOpacity
                                            style={styles.deleteReviewButton}
                                            onPress={() => {
                                                Alert.alert(
                                                    "Eliminar Review",
                                                    "¿Estás seguro de que quieres eliminar esta review?",
                                                    [
                                                        {
                                                            text: "Cancelar",
                                                            style: "cancel",
                                                        },
                                                        {
                                                            text: "Eliminar",
                                                            style: "destructive",
                                                            onPress: async () => {
                                                                try {
                                                                    await deleteReview(review.id);
                                                                    loadPlaceData();
                                                                } catch (error) {
                                                                    Alert.alert(
                                                                        "Error",
                                                                        "No se pudo eliminar la review"
                                                                    );
                                                                }
                                                            },
                                                        },
                                                    ]
                                                );
                                            }}
                                        >
                                            <Ionicons
                                                name="trash-outline"
                                                size={18}
                                                color={theme.colors.error}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {review.comment && (
                                <Text style={styles.reviewComment}>
                                    {review.comment}
                                </Text>
                            )}

                            {review.photos && review.photos.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.reviewPhotos}
                                >
                                    {review.photos.map((photo, photoIndex) => {
                                        const photoId =
                                            photo.id || `photo-${photoIndex}`;
                                        const hasError =
                                            imageErrors.has(photoId);
                                        const imageUri = photo.photo_url || "";

                                        console.log("🖼️ Renderizando foto:", {
                                            id: photoId,
                                            url: imageUri,
                                            hasError,
                                        });

                                        if (hasError) {
                                            return (
                                                <View
                                                    key={photoId}
                                                    style={
                                                        styles.reviewPhotoError
                                                    }
                                                >
                                                    <Ionicons
                                                        name="image-outline"
                                                        size={32}
                                                        color={
                                                            theme.colors
                                                                .textSecondary
                                                        }
                                                    />
                                                    <Text
                                                        style={
                                                            styles.photoErrorText
                                                        }
                                                    >
                                                        Error al cargar
                                                    </Text>
                                                </View>
                                            );
                                        }

                                        return (
                                            <TouchableOpacity
                                                key={photoId}
                                                style={
                                                    styles.reviewPhotoContainer
                                                }
                                                onPress={() => setSelectedImage(imageUri)}
                                                activeOpacity={0.8}
                                            >
                                                <Image
                                                    source={{ uri: imageUri }}
                                                    style={styles.reviewPhoto}
                                                    onError={(error) => {
                                                        console.error(
                                                            "❌ Error al cargar imagen:",
                                                            {
                                                                photo_id:
                                                                    photoId,
                                                                url: imageUri,
                                                                error: error
                                                                    .nativeEvent
                                                                    ?.error,
                                                            }
                                                        );
                                                        handleImageError(
                                                            photoId,
                                                            imageUri
                                                        );
                                                    }}
                                                    onLoad={() => {
                                                        console.log(
                                                            "✅ Imagen cargada exitosamente:",
                                                            imageUri
                                                        );
                                                    }}
                                                    onLoadStart={() => {
                                                        console.log(
                                                            "⏳ Iniciando carga de imagen:",
                                                            imageUri
                                                        );
                                                    }}
                                                    resizeMode="cover"
                                                />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            {review.visit_date && (
                                <View style={styles.reviewFooter}>
                                    <Ionicons
                                        name="calendar-outline"
                                        size={14}
                                        color={theme.colors.textSecondary}
                                    />
                                    <Text style={styles.reviewDate}>
                                        {new Date(
                                            review.visit_date
                                        ).toLocaleDateString("es-AR", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))
                )}
            </View>

            {/* Modal para ver imagen en grande */}
            <Modal
                visible={selectedImage !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedImage(null)}
            >
                <View style={styles.imageModalOverlay}>
                    <TouchableOpacity
                        style={styles.imageModalCloseButton}
                        onPress={() => setSelectedImage(null)}
                    >
                        <Ionicons name="close" size={32} color="#FFFFFF" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            style={styles.imageModalImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </ScrollView>
    );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.background,
    },
    loadingText: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.md,
    },
    header: {
        backgroundColor: theme.colors.backgroundLight,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        ...theme.shadows.sm,
    },
    name: {
        ...theme.typography.h2,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    address: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.md,
    },
    ratingContainer: {
        marginTop: theme.spacing.sm,
        paddingTop: theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    ratingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xs,
    },
    ratingText: {
        ...theme.typography.body,
        color: theme.colors.text,
        fontWeight: "600",
    },
    reviewCount: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
    },
    addReviewButton: {
        backgroundColor: theme.colors.primary,
        margin: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.sm,
        ...theme.shadows.md,
    },
    addReviewButtonText: {
        color: "#FFFFFF",
        ...theme.typography.bodyBold,
    },
    reviewsSection: {
        padding: theme.spacing.md,
    },
    sectionTitle: {
        ...theme.typography.h3,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    emptyContainer: {
        alignItems: "center",
        padding: theme.spacing.xl,
        marginTop: theme.spacing.lg,
    },
    emptyText: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        textAlign: "center",
        marginTop: theme.spacing.md,
    },
    emptySubtext: {
        ...theme.typography.small,
        color: theme.colors.textSecondary,
        textAlign: "center",
        marginTop: theme.spacing.xs,
    },
    reviewCard: {
        backgroundColor: theme.colors.backgroundLight,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.md,
        ...theme.shadows.sm,
    },
    reviewHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing.sm,
    },
    reviewUserContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xs,
    },
    reviewUser: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
    },
    reviewHeaderRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
    },
    deleteReviewButton: {
        padding: theme.spacing.xs,
        marginLeft: theme.spacing.xs,
    },
    reviewComment: {
        ...theme.typography.body,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
        lineHeight: 22,
    },
    reviewPhotos: {
        marginVertical: theme.spacing.sm,
    },
    reviewPhotoContainer: {
        marginRight: theme.spacing.sm,
    },
    reviewPhoto: {
        width: 120,
        height: 120,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.border,
    },
    reviewPhotoError: {
        width: 120,
        height: 120,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.border,
        justifyContent: "center",
        alignItems: "center",
        marginRight: theme.spacing.sm,
    },
    photoErrorText: {
        ...theme.typography.small,
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.xs,
    },
    reviewFooter: {
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xs,
        marginTop: theme.spacing.sm,
    },
    reviewDate: {
        ...theme.typography.small,
        color: theme.colors.textSecondary,
    },
    errorText: {
        ...theme.typography.body,
        color: theme.colors.error,
        textAlign: "center",
        marginTop: theme.spacing.xl,
    },
    imageModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageModalCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: theme.spacing.lg,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: theme.borderRadius.round,
        padding: theme.spacing.sm,
    },
    imageModalImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
});
