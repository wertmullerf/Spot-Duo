import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useReviews } from '@/hooks/useReviews';
import { usePlaces } from '@/hooks/usePlaces';
import { useAuth } from '@/hooks/useAuth';
import { ReviewWithDetails } from '@/models/Review';
import { Place } from '@/models/Place';
import { PlacesListScreenNavigationProp, RootStackParamList } from '@/types/navigation';
import { theme } from '@/utils/theme';
import { StarRating } from '@/components/StarRating';
import { supabaseClient } from '@/config/services';

type PlacesListScreenRouteProp = RouteProp<RootStackParamList, 'PlacesList'>;

interface Props {
  navigation: PlacesListScreenNavigationProp;
  route: PlacesListScreenRouteProp;
}

export function PlacesListScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const selectedGroupId = route?.params?.groupId;
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const { getPlacesWithReviews } = usePlaces();

  const loadPlaces = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('📱 [PlacesListScreen] Cargando lugares con reviews...', selectedGroupId ? `(grupo: ${selectedGroupId})` : '');
      
      // Obtener lugares con reviews (ya incluye promedio y conteo)
      const placesWithReviews = await getPlacesWithReviews(selectedGroupId);
      console.log('📱 [PlacesListScreen] Lugares encontrados:', placesWithReviews.length);
      
      setPlaces(placesWithReviews);
      setFilteredPlaces(placesWithReviews);
    } catch (error) {
      console.error('❌ [PlacesListScreen] Error al cargar lugares:', error);
      setPlaces([]);
      setFilteredPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [user, selectedGroupId, getPlacesWithReviews]);

  // Filtrar lugares cuando cambia minRating
  useEffect(() => {
    if (minRating === null) {
      setFilteredPlaces(places);
    } else {
      const filtered = places.filter(place => 
        place.average_rating && place.average_rating >= minRating
      );
      setFilteredPlaces(filtered);
    }
  }, [minRating, places]);

  // Cargar lugares cuando se monta el componente
  useEffect(() => {
    if (user) {
      loadPlaces();
    } else {
      setLoading(false);
    }
  }, [user, loadPlaces]);

  // Recargar lugares cuando la pantalla recibe foco o cambia el grupo
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadPlaces();
      }
    }, [user, loadPlaces, selectedGroupId])
  );
  
  // Recargar cuando cambia el grupo seleccionado
  useEffect(() => {
    if (user) {
      loadPlaces();
    }
  }, [selectedGroupId]);

  // Suscripción en tiempo real a cambios en places y reviews
  useEffect(() => {
    if (!selectedGroupId) return;

    console.log("🔄 Configurando suscripciones en tiempo real para lista de lugares");

    // Suscripción a cambios en reviews
    const reviewsSubscription = supabaseClient
      .channel(`list-reviews:${selectedGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'reviews',
          filter: selectedGroupId ? `group_id=eq.${selectedGroupId}` : undefined,
        },
        (payload) => {
          // Invalidar cache y recargar lugares cuando hay cambios en reviews
          const { cache, cacheKeys } = require('@/utils/cache');
          cache.invalidateCache(cacheKeys.placesWithReviews(selectedGroupId));
          loadPlaces();
        }
      )
      .subscribe();

    // Suscripción a cambios en places
    const placesSubscription = supabaseClient
      .channel(`list-places:${selectedGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'places',
        },
        (payload) => {
          // Invalidar cache y recargar lugares cuando hay cambios en places
          const { cache, cacheKeys } = require('@/utils/cache');
          cache.invalidateCache(cacheKeys.placesWithReviews(selectedGroupId));
          loadPlaces();
        }
      )
      .subscribe();

    // Limpiar suscripciones al desmontar o cambiar de grupo
    return () => {
      console.log("🔄 Limpiando suscripciones en tiempo real de lista");
      supabaseClient.removeChannel(reviewsSubscription);
      supabaseClient.removeChannel(placesSubscription);
    };
  }, [selectedGroupId, loadPlaces]);

  const renderItem = ({ item }: { item: Place }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('PlaceDetail', { 
          placeId: item.id,
          ...(selectedGroupId ? { groupId: selectedGroupId } : {})
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.placeIconContainer}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.placeInfo}>
            <Text style={styles.placeName} numberOfLines={1}>
              {item.name || 'Lugar desconocido'}
            </Text>
            {item.address && (
              <Text style={styles.address} numberOfLines={1}>
                {item.address}
              </Text>
            )}
          </View>
        </View>
        {item.average_rating !== undefined ? (
          <View style={styles.ratingContainer}>
            <StarRating rating={Math.round(item.average_rating)} readonly size={18} />
            {item.review_count !== undefined && item.review_count > 0 && (
              <Text style={styles.reviewCount}>
                ({item.review_count} {item.review_count === 1 ? 'review' : 'reviews'})
              </Text>
            )}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Cargando reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con filtro */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>
            {selectedGroupId ? 'Lugares del Grupo' : 'Mis Lugares'}
          </Text>
          <TouchableOpacity
            style={[styles.filterButton, minRating !== null && styles.filterButtonActive]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons 
              name="options" 
              size={20} 
              color={minRating ? theme.colors.primary : theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
        {minRating && (
          <View style={styles.activeFilter}>
            <Text style={styles.activeFilterText}>
              Filtrando: {minRating}+ estrellas
            </Text>
            <TouchableOpacity onPress={() => setMinRating(null)}>
              <Ionicons name="close-circle" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.headerSubtitle}>
          {filteredPlaces.length} {filteredPlaces.length === 1 ? 'lugar' : 'lugares'}
        </Text>
      </View>

      <FlatList
        data={filteredPlaces}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id || `place-${index}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color={theme.colors.textTertiary} />
            <Text style={styles.emptyText}>
              {minRating ? `No hay lugares con ${minRating}+ estrellas` : 'Aún no has agregado ningún lugar'}
            </Text>
            <Text style={styles.emptySubtext}>
              {minRating ? 'Intenta con otro filtro' : 'Explora el mapa y agrega tus primeros lugares'}
            </Text>
          </View>
        }
      />

      {/* Modal de filtros */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por Puntaje</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  minRating === null && styles.filterOptionActive
                ]}
                onPress={() => {
                  setMinRating(null);
                  setShowFilterModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterOptionText,
                  minRating === null && styles.filterOptionTextActive
                ]}>Todos</Text>
              </TouchableOpacity>
              {[1, 2, 3, 4, 5].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={[
                    styles.filterOption,
                    minRating === rating && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setMinRating(rating);
                    setShowFilterModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.filterOptionContent}>
                    <StarRating rating={rating} readonly size={16} />
                    <Text style={[
                      styles.filterOptionText,
                      minRating === rating && styles.filterOptionTextActive
                    ]}>
                      {rating}+ estrellas
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: Platform.OS === 'ios' ? 60 : theme.spacing.lg,
    ...theme.shadows.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary + '15',
    borderColor: theme.colors.primary,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  activeFilterText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
  },
  headerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  list: {
    padding: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  placeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs / 2,
  },
  address: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  ratingContainer: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs / 2,
  },
  reviewCount: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs / 2,
  },
  photosContainer: {
    marginBottom: theme.spacing.sm,
  },
  photosContent: {
    paddingRight: theme.spacing.md,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.borderLight,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
  },
  date: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  timeAgo: {
    ...theme.typography.small,
    color: theme.colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  modalCloseButton: {
    padding: theme.spacing.xs,
  },
  filterOptions: {
    gap: theme.spacing.sm,
  },
  filterOption: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  filterOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
    ...theme.typography.bodyBold,
  },
});
