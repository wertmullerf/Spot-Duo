import React, { useState, useEffect, useCallback } from "react";
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
import { MapScreenNavigationProp } from "@/types/navigation";
import { theme } from "@/utils/theme";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/types/navigation";
import { Ionicons } from "@expo/vector-icons";
import { services, supabaseClient } from "@/config/services";
import { useFocusEffect } from "@react-navigation/native";
import { useGroups } from "@/hooks/useGroups";

type MapScreenRouteProp = RouteProp<RootStackParamList, "Map">;

interface Props {
    navigation: MapScreenNavigationProp;
    route?: MapScreenRouteProp;
}

export function MapScreen({ navigation, route }: Props) {
    const selectedGroupId = route?.params?.groupId;
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
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [isMarkerBeingPressed, setIsMarkerBeingPressed] = useState(false);
    const [minRating, setMinRating] = useState<number | null>(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const {
        getNearbyPlaces,
        searchPlaces,
        savePlace,
        getPlacesWithReviews,
        loading: placesLoading,
    } = usePlaces();
    const { getPlaceReviewSummary } = useReviews();
    const { getUserGroups } = useGroups();

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

    // Filtrar lugares por rating cuando cambia minRating
    useEffect(() => {
        if (minRating === null) {
            setPlaces(allPlaces);
        } else {
            // Filtrar lugares usando average_rating que ya viene en el objeto Place
            const filtered = allPlaces.filter((place) => {
                if (!place.average_rating) return false;
                return place.average_rating >= minRating;
            });
            setPlaces(filtered);
            console.log(`🔍 Filtrado: ${filtered.length} lugares con ${minRating}+ estrellas de ${allPlaces.length} totales`);
        }
    }, [minRating, allPlaces]);

    // Recargar lugares cuando cambia el grupo seleccionado
    useEffect(() => {
        if (location && selectedGroupId) {
            loadPlacesForGroup();
        }
    }, [selectedGroupId]);

    // Recargar lugares cuando se vuelve a la pantalla
    useFocusEffect(
        useCallback(() => {
            if (location) {
                if (selectedGroupId) {
                    loadPlacesForGroup();
                } else {
                    // Recargar lugares sin grupo
                    (async () => {
                        try {
                            const savedPlaces = await getPlacesWithReviews();
                            setAllPlaces(savedPlaces);
                            setPlaces(savedPlaces);
                        } catch (error) {
                            // Silenciar error
                        }
                    })();
                }
            }
        }, [location, selectedGroupId, getPlacesWithReviews])
    );

    const loadPlacesForGroup = async () => {
        if (!location || !selectedGroupId) return;

        try {
            console.log("📍 Cargando lugares del grupo:", selectedGroupId);
            const savedPlaces = await getPlacesWithReviews(selectedGroupId);
            setAllPlaces(savedPlaces);
            setPlaces(savedPlaces);
        } catch (error) {
            console.error("Error al cargar lugares del grupo:", error);
        }
    };

    // Validar que el grupo existe cuando se navega con groupId
    useEffect(() => {
        if (!selectedGroupId) return;

        const validateGroup = async () => {
            try {
                const userGroups = await getUserGroups();
                const groupExists = userGroups.some(g => g.id === selectedGroupId);
                
                if (!groupExists) {
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
                }
            } catch (error) {
                // Si hay error, no hacer nada (puede ser un problema temporal)
            }
        };

        validateGroup();
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
                    if (location) {
                        loadPlacesForGroup();
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
                    if (location) {
                        loadPlacesForGroup();
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
        
        // Navegar directamente sin delay
        navigation.navigate("PlaceDetail", {
            placeId: place.id,
            ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
        });
        
        // Resetear después de navegar
        setTimeout(() => {
            setIsMarkerBeingPressed(false);
        }, 1000);
    };

    const handleMapPress = async (e: any) => {
        // Si se está presionando un marker, no abrir modal
        if (isMarkerBeingPressed) {
            return;
        }
        
        const coord: Coordinates = e.nativeEvent.coordinate;
        setSelectedCoordinate(coord);
        setNewPlaceName("");
        setNewPlaceAddress("");
        setShowAddPlaceModal(true);
        
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

        try {
            const newPlace = await savePlace({
                name: newPlaceName,
                address: newPlaceAddress || undefined, // No guardar si está vacía
                latitude: selectedCoordinate.latitude,
                longitude: selectedCoordinate.longitude,
            });

            // Agregar a la lista de lugares
            const updatedPlaces = [...allPlaces, newPlace];
            setAllPlaces(updatedPlaces);
            setPlaces(updatedPlaces);
            setShowAddPlaceModal(false);
            setNewPlaceName("");
            setNewPlaceAddress("");

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
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
                onPress={isMarkerBeingPressed ? undefined : handleMapPress}
                showsUserLocation={true}
                showsMyLocationButton={true}
            >
                {/* Marcadores de lugares guardados */}
                {places
                    .filter(
                        (place) => place.id && place.latitude && place.longitude
                    )
                    .map((place, index) => {
                        const avgRating = place.average_rating || 0;
                        const roundedRating = Math.round(avgRating);
                        const pinColor = roundedRating > 0 
                            ? RATING_COLORS[roundedRating] || RATING_COLORS[3]
                            : RATING_COLORS[3];
                        
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
                                title={place.name}
                                description={place.address || ''}
                                onPress={() => {
                                    handleMarkerPress(place);
                                }}
                                tappable={true}
                                tracksViewChanges={false}
                            >
                                {/* Componente personalizado con puntaje */}
                                <View style={styles.customMarker}>
                                    <View style={[styles.markerPin, { backgroundColor: pinColor }]}>
                                        <Text style={styles.markerRating}>
                                            {avgRating > 0 ? avgRating.toFixed(1) : '?'}
                                        </Text>
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
                            title={place.name}
                            description={
                                place.distance
                                    ? `${place.distance.toFixed(1)} km`
                                    : place.address
                            }
                            onPress={() => handleSelectSearchResult(place)}
                            tappable={true}
                            pinColor={theme.colors.accent}
                        />
                    ))}
            </MapView>

            {/* Indicador de grupo activo */}
            {selectedGroupId && (
                <View style={styles.groupIndicator}>
                    <Ionicons name="people" size={16} color="#FFFFFF" />
                    <Text style={styles.groupIndicatorText}>
                        Mostrando reviews del grupo
                    </Text>
                </View>
            )}

            {/* Barra de búsqueda mejorada */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Ionicons
                        name="search"
                        size={20}
                        color={theme.colors.textSecondary}
                        style={styles.searchIcon}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar lugares..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searchQuery.trim() && (
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={() => {
                                setSearchQuery("");
                                setSearchResults([]);
                            }}
                        >
                            <Ionicons
                                name="close-circle"
                                size={20}
                                color={theme.colors.textSecondary}
                            />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilterModal(true)}
                >
                    <Ionicons
                        name="options"
                        size={20}
                        color={
                            minRating
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

            {/* Controles inferiores mejorados */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() =>
                        navigation.navigate(
                            "PlacesList",
                            selectedGroupId
                                ? { groupId: selectedGroupId }
                                : undefined
                        )
                    }
                    activeOpacity={0.8}
                >
                    <Ionicons name="list" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Reviews</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate("GroupsList")}
                    activeOpacity={0.8}
                >
                    <Ionicons name="people" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Grupos</Text>
                </TouchableOpacity>
            </View>

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
                            <Text style={styles.modalTitle}>
                                Filtrar por Puntaje
                            </Text>
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
                        <View style={styles.filterOptions}>
                            <TouchableOpacity
                                style={[
                                    styles.filterOption,
                                    minRating === null &&
                                        styles.filterOptionActive,
                                ]}
                                onPress={() => {
                                    setMinRating(null);
                                    setShowFilterModal(false);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.filterOptionText,
                                        minRating === null &&
                                            styles.filterOptionTextActive,
                                    ]}
                                >
                                    Todos
                                </Text>
                            </TouchableOpacity>
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <TouchableOpacity
                                    key={rating}
                                    style={[
                                        styles.filterOption,
                                        minRating === rating &&
                                            styles.filterOptionActive,
                                    ]}
                                    onPress={() => {
                                        setMinRating(rating);
                                        setShowFilterModal(false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.filterOptionText,
                                            minRating === rating &&
                                                styles.filterOptionTextActive,
                                        ]}
                                    >
                                        {rating}+ estrellas
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
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
                                    setNewPlaceName("");
                                    setNewPlaceAddress("");
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

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalButtonCancel,
                                ]}
                                onPress={() => {
                                    setShowAddPlaceModal(false);
                                    setNewPlaceName("");
                                    setNewPlaceAddress("");
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
        backgroundColor: theme.colors.accent,
        borderRadius: theme.borderRadius.lg,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xs,
        ...theme.shadows.md,
        zIndex: 10,
    },
    groupIndicatorText: {
        ...theme.typography.caption,
        color: "#FFFFFF",
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
    filterButton: {
        width: 48,
        height: 48,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
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
    filterOptionText: {
        ...theme.typography.body,
        color: theme.colors.text,
    },
    filterOptionTextActive: {
        color: "#FFFFFF",
        ...theme.typography.bodyBold,
    },
    customMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerPin: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.md,
    },
    markerRating: {
        ...theme.typography.bodyBold,
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});
