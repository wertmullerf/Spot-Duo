import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    PanResponder,
    Animated,
    FlatList,
    Image,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Place } from '@/models/Place';
import { theme } from '@/utils/theme';
import { StarRating } from './StarRating';
import { getCategoryInfo } from '@/utils/placeCategories';
import { useReviews } from '@/hooks/useReviews';
import { ReviewWithDetails } from '@/models/Review';

interface Props {
    place: Place | null;
    onClose: () => void;
    onPress: () => void;
    onAddReview?: () => void;
    groupId?: string;
}

export function PlaceBottomSheet({ place, onClose, onPress, onAddReview, groupId }: Props) {
    const panY = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const TRANSLATE_Y_THRESHOLD = -100;
    const { getReviewsByPlace } = useReviews();
    const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    const loadReviews = useCallback(async () => {
        if (!place?.id) return;
        try {
            setLoadingReviews(true);
            const placeReviews = await getReviewsByPlace(place.id, groupId);
            setReviews(placeReviews);
        } catch (error) {
            // Silenciar error
        } finally {
            setLoadingReviews(false);
        }
    }, [place?.id, groupId, getReviewsByPlace]);

    // Cargar reviews inmediatamente cuando cambia el place
    useEffect(() => {
        if (place?.id) {
            loadReviews();
        } else {
            setReviews([]);
            setLoadingReviews(false);
        }
    }, [place?.id, groupId, loadReviews]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Solo responder a gestos hacia abajo
                return gestureState.dy > 0;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > TRANSLATE_Y_THRESHOLD) {
                    // Cerrar si se desliza suficientemente hacia abajo
                    Animated.timing(panY, {
                        toValue: 1000,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        onClose();
                        panY.setValue(0);
                    });
                } else {
                    // Volver a la posición original
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    // Memoizar valores calculados para evitar re-renders innecesarios
    const categoryInfo = useMemo(() => 
        place ? getCategoryInfo(place.category) : null, 
        [place?.category]
    );

    const avgRating = useMemo(() => place?.average_rating || 0, [place?.average_rating]);
    const reviewCount = useMemo(() => place?.review_count || 0, [place?.review_count]);

    if (!place || !categoryInfo) return null;

    return (
        <Animated.View 
            style={[
                styles.container,
                {
                    transform: [{ translateY: panY }],
                },
            ]}
        >
            {/* Handle bar con PanResponder - solo aquí se puede arrastrar */}
            <View style={styles.handleBarContainer} {...panResponder.panHandlers}>
                <View style={styles.handleBar} />
            </View>
            
            <ScrollView 
                ref={scrollViewRef}
                style={styles.content}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
            >
                {/* Header con imagen y categoría */}
                <View style={styles.header}>
                    <View style={styles.categoryBadge}>
                        <Ionicons 
                            name={categoryInfo.icon} 
                            size={20} 
                            color={categoryInfo.color} 
                        />
                        <Text style={styles.categoryText}>{categoryInfo.name}</Text>
                    </View>
                </View>

                {/* Nombre del lugar */}
                <Text style={styles.placeName} numberOfLines={2}>
                    {place.name}
                </Text>

                {/* Dirección */}
                {place.address && (
                    <View style={styles.addressRow}>
                        <Ionicons 
                            name="location-outline" 
                            size={16} 
                            color={theme.colors.textSecondary} 
                        />
                        <Text style={styles.address} numberOfLines={2}>
                            {place.address}
                        </Text>
                    </View>
                )}

                {/* Rating y reviews */}
                <View style={styles.ratingSection}>
                    <View style={styles.ratingContainer}>
                        <StarRating rating={Math.round(avgRating)} readonly size={20} />
                        {avgRating > 0 && (
                            <Text style={styles.ratingText}>
                                {avgRating.toFixed(1)}
                            </Text>
                        )}
                    </View>
                    {reviewCount > 0 && (
                        <Text style={styles.reviewCount}>
                            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                        </Text>
                    )}
                </View>

                {/* Carrusel de reviews */}
                {loadingReviews ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={styles.loadingText}>Cargando reviews...</Text>
                    </View>
                ) : reviews.length > 0 ? (
                    <View style={styles.reviewsSection}>
                        <FlatList
                            data={reviews}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={true}
                            nestedScrollEnabled={true}
                            renderItem={({ item }) => (
                                <View style={styles.reviewCard}>
                                    {item.photos && item.photos.length > 0 && item.photos[0]?.photo_url && (
                                        <Image 
                                            source={{ uri: item.photos[0].photo_url }} 
                                            style={styles.reviewImage}
                                            resizeMode="cover"
                                        />
                                    )}
                                    <View style={styles.reviewCardContent}>
                                        <View style={styles.reviewCardHeader}>
                                            <Text style={styles.reviewUserName}>
                                                {item.user?.email?.split('@')[0] || 'Usuario'}
                                            </Text>
                                            <StarRating rating={item.rating} readonly size={12} />
                                        </View>
                                        {item.comment && (
                                            <Text style={styles.reviewComment} numberOfLines={2}>
                                                {item.comment}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            )}
                            contentContainerStyle={styles.reviewsCarousel}
                        />
                    </View>
                ) : null}

                {/* Botón para agregar review - al final */}
                {onAddReview && (
                    <TouchableOpacity
                        style={styles.addReviewButton}
                        onPress={onAddReview}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.addReviewButtonText}>Agregar Review</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.borderRadius.xxl,
        borderTopRightRadius: theme.borderRadius.xxl,
        maxHeight: '50%',
        ...theme.shadows.xl,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    handleBarContainer: {
        paddingVertical: theme.spacing.sm,
        alignItems: 'center',
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: theme.colors.border,
        borderRadius: 2,
    },
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing.lg,
    },
    header: {
        marginBottom: theme.spacing.md,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.background,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 2,
        borderRadius: theme.borderRadius.lg,
        gap: theme.spacing.xs,
        borderWidth: 1,
    },
    categoryText: {
        ...theme.typography.caption,
        fontWeight: '600',
        fontSize: 13,
    },
    placeName: {
        ...theme.typography.h2,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
        fontSize: 24,
        letterSpacing: -0.5,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.md,
        gap: theme.spacing.xs,
    },
    address: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        flex: 1,
    },
    ratingSection: {
        marginBottom: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xs,
    },
    ratingText: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
        fontSize: 18,
    },
    reviewCount: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
    },
    reviewsSection: {
        marginTop: theme.spacing.md,
    },
    reviewsCarousel: {
        paddingRight: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    reviewCard: {
        width: 280,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginRight: theme.spacing.md,
    },
    reviewImage: {
        width: '100%',
        height: 160,
        backgroundColor: theme.colors.background,
    },
    reviewCardContent: {
        padding: theme.spacing.md,
    },
    reviewCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.xs,
    },
    reviewUserName: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
        fontSize: 14,
    },
    reviewComment: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        fontSize: 13,
        marginTop: theme.spacing.xs,
    },
    addReviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    addReviewButtonText: {
        ...theme.typography.bodyBold,
        color: '#FFFFFF',
        fontSize: 16,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.lg,
        gap: theme.spacing.sm,
    },
    loadingText: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        fontSize: 14,
    },
});

