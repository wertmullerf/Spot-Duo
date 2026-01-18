import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    TextInput,
    Modal,
    Alert,
    ScrollView,
    Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { usePlaces } from "@/hooks/usePlaces";
import { useReviews } from "@/hooks/useReviews";
import { Place, Coordinates } from "@/models/Place";
import { RATING_COLORS } from "@/utils/constants";
import { StarRating } from "@/components/StarRating";
import { MapScreenNavigationProp } from "@/types/navigation";
import { theme } from "@/utils/theme";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/types/navigation";
import { Ionicons } from "@expo/vector-icons";
import { services, supabaseClient } from "@/config/services";
import { useFocusEffect } from "@react-navigation/native";
import { useGroups } from "@/hooks/useGroups";
import { PlaceBottomSheet } from "@/components/PlaceBottomSheet";
import { getCategoryInfo, getCategoryIcon, getCategoryColor, PLACE_CATEGORIES } from "@/utils/placeCategories";

type MapScreenRouteProp = RouteProp<RootStackParamList, "Map">;

interface Props {
    navigation: MapScreenNavigationProp;
    route?: MapScreenRouteProp;
}

export function MapScreen({ navigation, route }: Props) {
    const selectedGroupId = route?.params?.groupId;
    const mapRef = useRef<MapView>(null);
    const [location, setLocation] = useState<Coordinates | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [allPlaces, setAllPlaces] = useState<Place[]>([]); // Todos los lugares sin filtrar
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Place[]>([]);
    const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
    const [selectedCoordinate, setSelectedCoordinate] =
        useState<Coordinates | null>(null);
    const [newPlaceName, setNewPlaceName] = useState("");
    const [newPlaceAddress, setNewPlaceAddress] = useState("");
    const [newPlaceCategory, setNewPlaceCategory] = useState<string>("");
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [isMarkerBeingPressed, setIsMarkerBeingPressed] = useState(false);
    const [minRating, setMinRating] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [showPlaceSheet, setShowPlaceSheet] = useState(false);
    const [isAddingPlace, setIsAddingPlace] = useState(false);
    const {
        getNearbyPlaces,
        searchPlaces,
        savePlace,
        getPlacesWithReviews,
        loading: placesLoading,
    } = usePlaces();
    const { getPlaceReviewSummary } = useReviews();
    const { getUserGroups } = useGroups();
    const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { status } =
                await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                console.warn("Permiso de ubicación denegado");
                return;
            }

            const currentLocation = await Location.getCurrentPositionAsync({});
            const coords: Coordinates = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            };
            setLocation(coords);

            // Cargar lugares guardados (con reviews) desde la base de datos
            try {
                console.log(
                    "📍 Cargando lugares guardados...",
                    selectedGroupId ? `(grupo: ${selectedGroupId})` : ""
                );
                const savedPlaces = await getPlacesWithReviews(selectedGroupId);
                console.log(
                    "📍 Lugares guardados encontrados:",
                    savedPlaces.length
                );
                setAllPlaces(savedPlaces);
                setPlaces(savedPlaces);
            } catch (error) {
                console.error("Error al cargar lugares guardados:", error);
                // Si falla, intentar cargar lugares cercanos como fallback
                try {
                    const nearbyPlaces = await getNearbyPlaces(coords, 5000);
                    setAllPlaces(nearbyPlaces);
                    setPlaces(nearbyPlaces);
                } catch (err) {
                    console.error("Error al cargar lugares cercanos:", err);
                }
            }
        })();
    }, [selectedGroupId]);

    // Filtrar lugares por rating y categoría
    useEffect(() => {
        let filtered = allPlaces;

        // Filtrar por rating
        if (minRating !== null) {
            filtered = filtered.filter((place) => {
                if (!place.average_rating) return false;
                return place.average_rating >= minRating;
            });
        }

        // Filtrar por categoría
        if (selectedCategory !== null) {
            filtered = filtered.filter((place) => {
                return place.category === selectedCategory;
            });
        }

        setPlaces(filtered);
    }, [minRating, selectedCategory, allPlaces]);

    const loadPlacesForGroup = useCallback(async () => {
        if (!location || !selectedGroupId) return;

        try {
            const savedPlaces = await getPlacesWithReviews(selectedGroupId);
            // Fusionar con lugares existentes para evitar perder lugares nuevos temporalmente
            setAllPlaces(prevPlaces => {
                // Crear un mapa de lugares por ID para evitar duplicados
                const placesMap = new Map<string, Place>();
                // Primero agregar lugares existentes (mantener lugares nuevos temporalmente)
                prevPlaces.forEach(place => {
                    if (place.id) {
                        placesMap.set(place.id, place);
                    }
                });
                // Luego agregar/actualizar con lugares de la BD (prioridad a la BD)
                savedPlaces.forEach(place => {
                    if (place.id) {
                        placesMap.set(place.id, place);
                    }
                });
                return Array.from(placesMap.values());
            });
            // El filtro se aplicará automáticamente en el useEffect que depende de allPlaces
        } catch (error) {
            console.error("Error al cargar lugares del grupo:", error);
        }
    }, [location, selectedGroupId, getPlacesWithReviews]);

    // Recargar lugares cuando cambia el grupo seleccionado
    useEffect(() => {
        if (location && selectedGroupId) {
            loadPlacesForGroup();
        }
    }, [selectedGroupId, loadPlacesForGroup, location]);

    // Recargar lugares cuando se vuelve a la pantalla
    // Recargar con un pequeño delay para asegurar que la BD esté actualizada después de crear reviews
    useFocusEffect(
        useCallback(() => {
            if (location) {
                if (selectedGroupId) {
                    // Recargar con delay para dar tiempo a que las suscripciones en tiempo real se actualicen
                    const timeoutId = setTimeout(() => {
                        loadPlacesForGroup();
                    }, 500);
                    return () => clearTimeout(timeoutId);
                } else {
                    // Recargar lugares sin grupo
                    (async () => {
                        try {
                            const savedPlaces = await getPlacesWithReviews();
                            setAllPlaces(savedPlaces);
                        } catch (error) {
                            // Silenciar error
                        }
                    })();
                }
            }
        }, [location, selectedGroupId, getPlacesWithReviews, loadPlacesForGroup])
    );

    // Validar que el grupo existe y cargar su nombre cuando se navega con groupId
    useEffect(() => {
        if (!selectedGroupId) {
            setSelectedGroupName(null);
            return;
        }

        const validateAndLoadGroup = async () => {
            try {
                const userGroups = await getUserGroups();
                const group = userGroups.find(g => g.id === selectedGroupId);
                
                if (!group) {
                    // El grupo no existe, mostrar alerta
                    Alert.alert(
                        "Grupo no encontrado",
                        "Este grupo ya no existe o no tienes acceso a él.",
                        [
                            {
                                text: "OK",
                                onPress: () => navigation.navigate("GroupsList"),
                            },
                        ]
                    );
                    setSelectedGroupName(null);
                } else {
                    // Cargar el nombre del grupo
                    setSelectedGroupName(group.name);
                }
            } catch (error) {
                // Si hay error, no hacer nada (puede ser un problema temporal)
                setSelectedGroupName(null);
            }
        };

        validateAndLoadGroup();
    }, [selectedGroupId, getUserGroups, navigation]);

    // Suscripción en tiempo real a cambios en places, reviews y grupos
    useEffect(() => {
        if (!selectedGroupId) return;

        // Suscripción a cambios en reviews
        const reviewsSubscription = supabaseClient
            .channel(`reviews:${selectedGroupId}`)
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
                    // Recargar con delay para asegurar que la BD esté completamente actualizada
                    if (location) {
                        setTimeout(() => {
                            loadPlacesForGroup();
                        }, 500);
                    }
                }
            )
            .subscribe();

        // Suscripción a cambios en places
        const placesSubscription = supabaseClient
            .channel(`places:${selectedGroupId}`)
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
                    // Recargar lugares después de un pequeño delay para asegurar que la BD esté actualizada
                    if (location) {
                        setTimeout(() => {
                            loadPlacesForGroup();
                        }, 300);
                    }
                }
            )
            .subscribe();

        // Suscripción a eliminación del grupo
        const groupSubscription = supabaseClient
            .channel(`group:${selectedGroupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'groups',
                    filter: `id=eq.${selectedGroupId}`,
                },
                (payload) => {
                    // El grupo fue eliminado, redirigir a GroupsList
                    Alert.alert(
                        "Grupo Eliminado",
                        "Este grupo ha sido eliminado.",
                        [
                            {
                                text: "OK",
                                onPress: () => navigation.navigate("GroupsList"),
                            },
                        ]
                    );
                }
            )
            .subscribe();

        // Limpiar suscripciones al desmontar o cambiar de grupo
        return () => {
            supabaseClient.removeChannel(reviewsSubscription);
            supabaseClient.removeChannel(placesSubscription);
            supabaseClient.removeChannel(groupSubscription);
        };
    }, [selectedGroupId, location, navigation]);

    const handleMarkerPress = (place: Place) => {
        if (!place || !place.id || isMarkerBeingPressed) return;
        
        // Marcar que se está presionando un marker
        setIsMarkerBeingPressed(true);
        
        // Cerrar modal si está abierto
        setShowAddPlaceModal(false);
        setSearchResults([]);
        
        // Mostrar bottom sheet estilo iOS Maps
        setSelectedPlace(place);
        setShowPlaceSheet(true);
        
        // Resetear después de un momento
        setTimeout(() => {
            setIsMarkerBeingPressed(false);
        }, 300);
    };

    const handlePlaceSheetPress = () => {
        if (!selectedPlace) return;
        setShowPlaceSheet(false);
        navigation.navigate("PlaceDetail", {
            placeId: selectedPlace.id,
            ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
        });
    };

    const handleMapPress = async (e: any) => {
        // Si se está presionando un marker o hay un sheet abierto, no hacer nada
        if (isMarkerBeingPressed || showPlaceSheet || showAddPlaceModal) {
            return;
        }
    };

    const handleAddPlaceButton = async () => {
        if (!location) return;
        
        // Cerrar bottom sheet si está abierto
        setShowPlaceSheet(false);
        setSelectedPlace(null);
        
        // Activar modo de selección tipo Uber
        setIsAddingPlace(true);
        const coord: Coordinates = location;
        setSelectedCoordinate(coord);
        setNewPlaceName("");
        setNewPlaceAddress("");
        setNewPlaceCategory("");
        
        // Mover el mapa a la ubicación actual del usuario
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: coord.latitude,
                longitude: coord.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 500);
        }
        
        // Obtener dirección automáticamente usando reverse geocoding
        setLoadingAddress(true);
        try {
            const address = await services.map.reverseGeocode(coord);
            if (address && address.trim()) {
                setNewPlaceAddress(address);
            }
        } catch (error) {
            // Silenciar error
        } finally {
            setLoadingAddress(false);
        }
    };

    const handleMapRegionChange = async (region: any) => {
        if (isAddingPlace && region) {
            // Actualizar coordenadas cuando el usuario mueve el mapa
            const coord: Coordinates = {
                latitude: region.latitude,
                longitude: region.longitude,
            };
            setSelectedCoordinate(coord);
            
            // Obtener dirección automáticamente usando reverse geocoding
            setLoadingAddress(true);
            try {
                const address = await services.map.reverseGeocode(coord);
                if (address && address.trim()) {
                    setNewPlaceAddress(address);
                }
            } catch (error) {
                // Silenciar error
            } finally {
                setLoadingAddress(false);
            }
        }
    };

    const handleConfirmLocation = () => {
        if (!selectedCoordinate) return;
        setIsAddingPlace(false);
        setShowAddPlaceModal(true);
    };

    // Búsqueda con debounce para búsqueda en tiempo real
    const performSearch = useCallback(
        async (query: string) => {
            if (!query.trim() || !location) {
                setSearchResults([]);
                return;
            }

            try {
                console.log(`🔍 Buscando: "${query}"`);
                const results = await searchPlaces(query, location);

                if (results.length === 0) {
                    console.log(
                        `📍 No se encontraron resultados para "${query}"`
                    );
                    setSearchResults([]);
                    return;
                }

                console.log(
                    `📍 Encontrados ${results.length} lugares cercanos para "${query}"`
                );
                setSearchResults(results);
            } catch (error) {
                console.error("Error al buscar:", error);
                setSearchResults([]);
            }
        },
        [location, searchPlaces]
    );

    // Debounce para búsqueda en tiempo real
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery.trim()) {
                performSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 500); // Esperar 500ms después de que el usuario deje de escribir

        return () => clearTimeout(timeoutId);
    }, [searchQuery, performSearch]);

    const handleSearch = async () => {
        if (!searchQuery.trim() || !location) {
            Alert.alert(
                "Ubicación requerida",
                "Necesitamos tu ubicación para buscar lugares cercanos"
            );
            return;
        }

        await performSearch(searchQuery);

        if (searchResults.length === 0 && searchQuery.trim()) {
            Alert.alert(
                "Sin resultados",
                `No se encontraron lugares cercanos para "${searchQuery}". Intenta con otro término de búsqueda.`
            );
        }
    };

    const handleSelectSearchResult = (place: Place) => {
        // Si el lugar no tiene ID (es de búsqueda), guardarlo primero
        if (!place.id && place.google_place_id) {
            savePlace({
                google_place_id: place.google_place_id,
                name: place.name,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
                category: place.category,
            }).then((savedPlace) => {
                navigation.navigate("PlaceDetail", {
                    placeId: savedPlace.id,
                    ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
                });
            });
        } else if (place.id) {
            navigation.navigate("PlaceDetail", {
                placeId: place.id,
                ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
            });
        }
        setSearchQuery("");
        setSearchResults([]);
    };

    const handleAddPlace = async () => {
        if (!newPlaceName.trim() || !selectedCoordinate) {
            Alert.alert("Error", "Por favor ingresa un nombre para el lugar");
            return;
        }

        if (!newPlaceCategory) {
            Alert.alert("Error", "Por favor selecciona una categoría");
            return;
        }

        try {
            const newPlace = await savePlace({
                name: newPlaceName,
                address: newPlaceAddress || undefined, // No guardar si está vacía
                latitude: selectedCoordinate.latitude,
                longitude: selectedCoordinate.longitude,
                category: newPlaceCategory,
            });

            // Agregar a la lista de lugares
            const updatedPlaces = [...allPlaces, newPlace];
            setAllPlaces(updatedPlaces);
            setPlaces(updatedPlaces);
            setShowAddPlaceModal(false);
            setNewPlaceName("");
            setNewPlaceAddress("");
            setNewPlaceCategory("");

            // Navegar al detalle del lugar para agregar review (pasar groupId si hay uno seleccionado)
            navigation.navigate("PlaceDetail", {
                placeId: newPlace.id,
                ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
            });
        } catch (error) {
            console.error("Error al agregar lugar:", error);
            Alert.alert("Error", "No se pudo agregar el lugar");
        }
    };

    if (!location) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
                onPress={handleMapPress}
                onRegionChangeComplete={handleMapRegionChange}
                showsUserLocation={true}
                showsMyLocationButton={true}
            >
                {/* Marcadores de lugares guardados */}
                {places
                    .filter(
                        (place) => place.id && place.latitude && place.longitude
                    )
                    .map((place, index) => {
                        const categoryInfo = getCategoryInfo(place.category);
                        const categoryColor = getCategoryColor(place.category);
                        const categoryIcon = getCategoryIcon(place.category);
                        
                        return (
                            <Marker
                                key={
                                    place.id ||
                                    `place-${index}-${place.latitude}-${place.longitude}`
                                }
                                identifier={place.id}
                                coordinate={{
                                    latitude: place.latitude,
                                    longitude: place.longitude,
                                }}
                                onPress={() => {
                                    handleMarkerPress(place);
                                }}
                                tappable={true}
                                tracksViewChanges={false}
                            >
                                {/* Componente personalizado con icono de categoría */}
                                <View style={styles.customMarker}>
                                    <View style={[styles.markerPin, { backgroundColor: categoryColor }]}>
                                        <Ionicons 
                                            name={categoryIcon} 
                                            size={24} 
                                            color="#FFFFFF" 
                                        />
                                    </View>
                                </View>
                            </Marker>
                        );
                    })}

                {/* Marcadores de resultados de búsqueda */}
                {searchResults
                    .filter(
                        (place) =>
                            place.latitude && place.longitude && !place.id
                    )
                    .map((place, index) => (
                        <Marker
                            key={
                                place.google_place_id ||
                                `search-${index}-${place.latitude}-${place.longitude}`
                            }
                            coordinate={{
                                latitude: place.latitude,
                                longitude: place.longitude,
                            }}
                            onPress={() => handleSelectSearchResult(place)}
                            tappable={true}
                            pinColor={theme.colors.accent}
                        />
                    ))}

                {/* Marcador fijo en el centro para selección tipo Uber */}
                {isAddingPlace && selectedCoordinate && (
                    <View style={styles.centerMarkerContainer}>
                        <View style={styles.centerMarker} />
                        <View style={styles.centerMarkerDot} />
                    </View>
                )}
            </MapView>

            {/* Botón de confirmar ubicación cuando está en modo agregar lugar */}
            {isAddingPlace && (
                <View style={styles.confirmLocationContainer}>
                    <View style={styles.confirmLocationContent}>
                        <Text style={styles.confirmLocationText} numberOfLines={2}>
                            {newPlaceAddress || 'Mueve el mapa para seleccionar ubicación'}
                        </Text>
                        <View style={styles.confirmLocationButtons}>
                            <TouchableOpacity
                                style={styles.confirmLocationCancel}
                                onPress={() => {
                                    setIsAddingPlace(false);
                                    setSelectedCoordinate(null);
                                    setNewPlaceAddress("");
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.confirmLocationCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmLocationButton}
                                onPress={handleConfirmLocation}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.confirmLocationButtonText}>Confirmar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Indicador de grupo activo - solo mostrar nombre si hay grupo y no hay bottom sheet */}
            {selectedGroupId && selectedGroupName && !showPlaceSheet && (
                <TouchableOpacity 
                    style={styles.groupIndicator}
                    onPress={() => navigation.navigate("GroupsList")}
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-back" size={16} color={theme.colors.text} />
                    <Text style={styles.groupIndicatorText}>
                        {selectedGroupName}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Botón de filtros */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilterModal(true)}
                >
                    <Ionicons
                        name="options"
                        size={20}
                        color={
                            minRating || selectedCategory
                                ? theme.colors.primary
                                : theme.colors.textSecondary
                        }
                    />
                </TouchableOpacity>
            </View>

            {/* Resultados de búsqueda mejorados */}
            {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                    <View style={styles.searchResultsHeader}>
                        <Text style={styles.searchResultsTitle}>
                            {searchResults.length}{" "}
                            {searchResults.length === 1
                                ? "lugar encontrado"
                                : "lugares encontrados"}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setSearchResults([]);
                                setSearchQuery("");
                            }}
                        >
                            <Ionicons
                                name="close"
                                size={24}
                                color={theme.colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        style={styles.searchResultsList}
                        showsVerticalScrollIndicator={false}
                    >
                        {searchResults.map((place, index) => (
                            <TouchableOpacity
                                key={place.google_place_id || `result-${index}`}
                                style={styles.searchResultItem}
                                onPress={() => handleSelectSearchResult(place)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.searchResultIcon}>
                                    <Ionicons
                                        name="location"
                                        size={24}
                                        color={theme.colors.primary}
                                    />
                                </View>
                                <View style={styles.searchResultContent}>
                                    <Text
                                        style={styles.searchResultName}
                                        numberOfLines={1}
                                    >
                                        {place.name}
                                    </Text>
                                    {place.address && (
                                        <Text
                                            style={styles.searchResultAddress}
                                            numberOfLines={1}
                                        >
                                            {place.address.split(",")[0]}
                                            {place.address.split(",")[1]
                                                ? `, ${
                                                      place.address.split(
                                                          ","
                                                      )[1]
                                                  }`
                                                : ""}
                                        </Text>
                                    )}
                                    {place.distance !== undefined && (
                                        <Text
                                            style={styles.searchResultDistance}
                                        >
                                            {place.distance.toFixed(1)} km
                                        </Text>
                                    )}
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color={theme.colors.textTertiary}
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Botón discreto de Grupos en esquina superior derecha */}
            {!selectedGroupId && (
                <TouchableOpacity
                    style={styles.groupsButton}
                    onPress={() => navigation.navigate("GroupsList")}
                    activeOpacity={0.7}
                >
                    <Ionicons name="folder-outline" size={20} color={theme.colors.text} />
                </TouchableOpacity>
            )}


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
                            <Text style={styles.modalTitle}>Filtros</Text>
                            <TouchableOpacity
                                onPress={() => setShowFilterModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={theme.colors.text}
                                />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.filterScrollView}>
                            {/* Filtro por puntaje */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Puntaje</Text>
                                <ScrollView 
                                    horizontal 
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.filterRow}
                                >
                                    <TouchableOpacity
                                        style={[
                                            styles.filterChip,
                                            minRating === null && styles.filterChipActive,
                                        ]}
                                        onPress={() => setMinRating(null)}
                                    >
                                        <Text style={[
                                            styles.filterChipText,
                                            minRating === null && styles.filterChipTextActive,
                                        ]}>
                                            Todos
                                        </Text>
                                    </TouchableOpacity>
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                        <TouchableOpacity
                                            key={rating}
                                            style={[
                                                styles.filterChip,
                                                minRating === rating && styles.filterChipActive,
                                            ]}
                                            onPress={() => setMinRating(rating)}
                                        >
                                            <StarRating rating={rating} readonly size={14} />
                                            <Text style={[
                                                styles.filterChipText,
                                                minRating === rating && styles.filterChipTextActive,
                                            ]}>
                                                {rating}+
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Filtro por categoría */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Categoría</Text>
                                <View style={styles.filterGrid}>
                                    <TouchableOpacity
                                        style={[
                                            styles.filterCategoryChip,
                                            selectedCategory === null && styles.filterCategoryChipActive,
                                        ]}
                                        onPress={() => setSelectedCategory(null)}
                                    >
                                        <Text style={[
                                            styles.filterCategoryText,
                                            selectedCategory === null && styles.filterCategoryTextActive,
                                        ]}>
                                            Todas
                                        </Text>
                                    </TouchableOpacity>
                                    {PLACE_CATEGORIES.map((category) => (
                                        <TouchableOpacity
                                            key={category.id}
                                            style={[
                                                styles.filterCategoryChip,
                                                selectedCategory === category.id && {
                                                    borderColor: category.color,
                                                    backgroundColor: category.color + '15',
                                                },
                                            ]}
                                            onPress={() => setSelectedCategory(category.id)}
                                        >
                                            <Ionicons 
                                                name={category.icon} 
                                                size={18} 
                                                color={selectedCategory === category.id ? category.color : theme.colors.textSecondary} 
                                            />
                                            <Text style={[
                                                styles.filterCategoryText,
                                                selectedCategory === category.id && {
                                                    color: category.color,
                                                    fontWeight: '600',
                                                },
                                            ]}>
                                                {category.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal para agregar lugar */}
            <Modal
                visible={showAddPlaceModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddPlaceModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Agregar Nuevo Lugar
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowAddPlaceModal(false);
                                    setIsAddingPlace(false);
                                    setNewPlaceName("");
                                    setNewPlaceAddress("");
                                    setNewPlaceCategory("");
                                }}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={theme.colors.text}
                                />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            Presionaste en el mapa. Agrega un lugar en esta
                            ubicación.
                        </Text>

                        <View style={styles.inputContainer}>
                            <Ionicons
                                name="location"
                                size={20}
                                color={theme.colors.textSecondary}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Nombre del lugar *"
                                placeholderTextColor={
                                    theme.colors.textSecondary
                                }
                                value={newPlaceName}
                                onChangeText={setNewPlaceName}
                            />
                        </View>

                        {loadingAddress ? (
                            <View style={styles.addressContainer}>
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                                <Text style={styles.addressText}>Obteniendo dirección...</Text>
                            </View>
                        ) : newPlaceAddress ? (
                            <View style={styles.addressContainer}>
                                <Ionicons
                                    name="location"
                                    size={20}
                                    color={theme.colors.primary}
                                    style={styles.addressIcon}
                                />
                                <Text style={styles.addressText} numberOfLines={2}>
                                    {newPlaceAddress}
                                </Text>
                            </View>
                        ) : null}

                        {/* Selector de categoría */}
                        <Text style={styles.categoryLabel}>Categoría *</Text>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            style={styles.categoriesContainer}
                            contentContainerStyle={styles.categoriesContent}
                        >
                            {PLACE_CATEGORIES.map((category) => (
                                <TouchableOpacity
                                    key={category.id}
                                    style={[
                                        styles.categoryOption,
                                        newPlaceCategory === category.id && styles.categoryOptionSelected,
                                    ]}
                                    onPress={() => setNewPlaceCategory(category.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        styles.categoryIconContainer,
                                        newPlaceCategory === category.id && { backgroundColor: category.color + '20' }
                                    ]}>
                                        <Ionicons 
                                            name={category.icon} 
                                            size={24} 
                                            color={newPlaceCategory === category.id ? category.color : theme.colors.textSecondary} 
                                        />
                                    </View>
                                    <Text style={[
                                        styles.categoryOptionText,
                                        newPlaceCategory === category.id && styles.categoryOptionTextSelected,
                                    ]}>
                                        {category.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalButtonCancel,
                                ]}
                                onPress={() => {
                                    setShowAddPlaceModal(false);
                                    setIsAddingPlace(false);
                                    setNewPlaceName("");
                                    setNewPlaceAddress("");
                                    setNewPlaceCategory("");
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalButtonTextCancel}>
                                    Cancelar
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalButtonConfirm,
                                ]}
                                onPress={handleAddPlace}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalButtonTextConfirm}>
                                    Agregar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {placesLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator
                        size="large"
                        color={theme.colors.primary}
                    />
                </View>
            )}

            {/* Bottom Sheet estilo iOS Maps */}
            {showPlaceSheet && selectedPlace && (
                <PlaceBottomSheet
                    place={selectedPlace}
                    onClose={() => {
                        setShowPlaceSheet(false);
                        setSelectedPlace(null);
                    }}
                    onPress={handlePlaceSheetPress}
                    onAddReview={() => {
                        if (selectedPlace) {
                            setShowPlaceSheet(false);
                            navigation.navigate("AddReview", {
                                placeId: selectedPlace.id,
                                placeName: selectedPlace.name,
                                ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
                            });
                        }
                    }}
                    groupId={selectedGroupId}
                />
            )}

            {/* Botón flotante discreto para agregar lugar */}
            {!showPlaceSheet && (
                <TouchableOpacity
                    style={styles.addPlaceButton}
                    onPress={handleAddPlaceButton}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    map: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.background,
    },
    loadingText: {
        marginTop: theme.spacing.md,
        ...theme.typography.body,
        color: theme.colors.textSecondary,
    },
    controls: {
        position: "absolute",
        bottom: Platform.OS === "ios" ? 34 : 24,
        left: theme.spacing.md,
        right: theme.spacing.md,
        flexDirection: "row",
        gap: theme.spacing.sm,
        ...theme.shadows.lg,
    },
    button: {
        flex: 1,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.xl,
        paddingVertical: theme.spacing.md + 2,
        paddingHorizontal: theme.spacing.lg,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: theme.spacing.xs,
    },
    buttonSecondary: {
        backgroundColor: theme.colors.secondary,
    },
    buttonText: {
        color: "#FFFFFF",
        ...theme.typography.bodyBold,
        fontSize: 15,
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.overlay,
    },
    groupIndicator: {
        position: "absolute",
        top: Platform.OS === "ios" ? 60 : 30,
        left: theme.spacing.md,
        right: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xs,
        ...theme.shadows.md,
        zIndex: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    groupIndicatorText: {
        ...theme.typography.caption,
        color: theme.colors.text,
        fontWeight: "600",
    },
    searchContainer: {
        position: "absolute",
        top: Platform.OS === "ios" ? 100 : 70,
        left: theme.spacing.md,
        right: theme.spacing.md,
        flexDirection: "row",
        gap: theme.spacing.sm,
        zIndex: 5,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    searchIcon: {
        marginRight: theme.spacing.xs,
    },
    searchInput: {
        flex: 1,
        paddingVertical: theme.spacing.sm + 2,
        ...theme.typography.body,
        color: theme.colors.text,
        fontSize: 16,
    },
    clearButton: {
        padding: theme.spacing.xs,
        marginLeft: theme.spacing.xs,
    },
    filterContainer: {
        position: "absolute",
        top: Platform.OS === "ios" ? 100 : 70,
        right: theme.spacing.md,
        zIndex: 5,
    },
    filterButton: {
        width: 48,
        height: 48,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        ...theme.shadows.md,
    },
    searchResults: {
        position: "absolute",
        top: Platform.OS === "ios" ? 160 : 130,
        left: theme.spacing.md,
        right: theme.spacing.md,
        maxHeight: 400,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        ...theme.shadows.lg,
        overflow: "hidden",
        zIndex: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    searchResultsHeader: {
        padding: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderLight,
        backgroundColor: theme.colors.background,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    searchResultsTitle: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
    },
    searchResultsList: {
        maxHeight: 320,
    },
    searchResultItem: {
        padding: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderLight,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
    },
    searchResultIcon: {
        width: 40,
        height: 40,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.background,
        alignItems: "center",
        justifyContent: "center",
    },
    searchResultContent: {
        flex: 1,
    },
    searchResultName: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs / 2,
    },
    searchResultAddress: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.xs / 2,
    },
    searchResultDistance: {
        ...theme.typography.small,
        color: theme.colors.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.borderRadius.xl,
        borderTopRightRadius: theme.borderRadius.xl,
        paddingTop: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
        maxHeight: "80%",
        borderTopWidth: 1,
        borderTopColor: theme.colors.borderLight,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.borderLight,
    },
    modalTitle: {
        ...theme.typography.h2,
        color: theme.colors.text,
        fontWeight: '700',
        fontSize: 22,
    },
    modalCloseButton: {
        padding: theme.spacing.xs,
    },
    modalSubtitle: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.lg,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.borderLight,
    },
    inputIcon: {
        marginRight: theme.spacing.sm,
    },
    modalInput: {
        flex: 1,
        paddingVertical: theme.spacing.md,
        ...theme.typography.body,
        color: theme.colors.text,
    },
    addressContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.borderLight,
        gap: theme.spacing.sm,
    },
    addressIcon: {
        marginRight: theme.spacing.xs,
    },
    addressText: {
        flex: 1,
        ...theme.typography.body,
        color: theme.colors.textSecondary,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    modalButton: {
        flex: 1,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        alignItems: "center",
        justifyContent: "center",
    },
    modalButtonCancel: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    modalButtonConfirm: {
        backgroundColor: theme.colors.primary,
    },
    modalButtonTextCancel: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
    },
    modalButtonTextConfirm: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    categoryLabel: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
        marginTop: theme.spacing.xs,
    },
    categoriesContainer: {
        marginBottom: theme.spacing.md,
    },
    categoriesContent: {
        paddingRight: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    categoryOption: {
        alignItems: "center",
        marginRight: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 2,
        borderColor: theme.colors.border,
        minWidth: 80,
    },
    categoryOptionSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primary + '10',
    },
    categoryIconContainer: {
        width: 48,
        height: 48,
        borderRadius: theme.borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.background,
        marginBottom: theme.spacing.xs,
    },
    categoryOptionText: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
        textAlign: "center",
        fontSize: 12,
    },
    categoryOptionTextSelected: {
        color: theme.colors.primary,
        fontWeight: "600",
    },
    filterOptions: {
        gap: theme.spacing.sm,
    },
    filterScrollView: {
        maxHeight: 400,
    },
    filterSection: {
        marginBottom: theme.spacing.xl,
    },
    filterSectionTitle: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
        fontSize: 16,
        fontWeight: '600',
    },
    filterRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        paddingRight: theme.spacing.lg,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    filterChipActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    filterChipText: {
        ...theme.typography.body,
        color: theme.colors.text,
        fontSize: 14,
    },
    filterChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    filterGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    filterCategoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        minWidth: 100,
    },
    filterCategoryChipActive: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primary + '15',
    },
    filterCategoryText: {
        ...theme.typography.caption,
        color: theme.colors.text,
        fontSize: 13,
    },
    filterCategoryTextActive: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    groupsButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 30,
        right: theme.spacing.md,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    addPlaceHint: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 70,
        left: theme.spacing.md,
        right: theme.spacing.md,
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
        ...theme.shadows.md,
    },
    addPlaceHintText: {
        ...theme.typography.bodyBold,
        color: '#FFFFFF',
        fontSize: 14,
    },
    customMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerPin: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.lg,
    },
    centerMarkerContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -20,
        marginTop: -40,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1000,
    },
    centerMarker: {
        width: 40,
        height: 40,
        borderWidth: 3,
        borderColor: theme.colors.primary,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    centerMarkerDot: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -4,
        marginTop: -4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.primary,
    },
    confirmLocationContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        left: theme.spacing.md,
        right: theme.spacing.md,
        zIndex: 1000,
    },
    confirmLocationContent: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.md,
        ...theme.shadows.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    confirmLocationText: {
        ...theme.typography.body,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
        textAlign: 'center',
    },
    confirmLocationButtons: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    confirmLocationCancel: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    confirmLocationCancelText: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
    },
    confirmLocationButton: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
    },
    confirmLocationButtonText: {
        ...theme.typography.bodyBold,
        color: '#FFFFFF',
    },
    addPlaceButton: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        right: theme.spacing.md,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.lg,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
});
