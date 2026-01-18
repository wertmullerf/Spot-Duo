import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
    Modal,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useReviews } from "@/hooks/useReviews";
import { RouteProp } from "@react-navigation/native";
import {
    AddReviewScreenNavigationProp,
    RootStackParamList,
} from "@/types/navigation";
import { MAX_RATING, MIN_RATING } from "@/utils/constants";
import { theme } from "@/utils/theme";
import { urisToArrayBuffers } from "@/utils/imageUtils";
import { useGroups } from "@/hooks/useGroups";
import { Group } from "@/models/Group";
import { StarRating } from "@/components/StarRating";

type AddReviewScreenRouteProp = RouteProp<RootStackParamList, "AddReview">;

interface Props {
    navigation: AddReviewScreenNavigationProp;
    route: AddReviewScreenRouteProp;
}

export function AddReviewScreen({ navigation, route }: Props) {
    const { placeId, placeName, groupId } = route.params;
    const [rating, setRating] = useState(3);
    const [comment, setComment] = useState("");
    const [photos, setPhotos] = useState<string[]>([]);
    const [visitDate, setVisitDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [showCalendar, setShowCalendar] = useState(false);
    const { createReview, loading: reviewLoading } = useReviews();
    const { getUserGroups } = useGroups();
    const [uploading, setUploading] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    // Si viene groupId en params, usarlo automáticamente (no mostrar selector)
    const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(
        groupId
    );

    // Combinar estados de loading
    const loading = reviewLoading || uploading;

    useEffect(() => {
        // Solo cargar grupos si NO hay groupId en params (para mostrar selector)
        if (!groupId) {
            loadGroups();
        }
    }, [groupId]);

    const loadGroups = async () => {
        try {
            const userGroups = await getUserGroups();
            setGroups(userGroups);
        } catch (error) {
            // getUserGroups ahora retorna array vacío en lugar de lanzar error
            setGroups([]);
        }
    };

    const handlePickImage = async () => {
        try {

            // Solicitar permisos
            const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                Alert.alert(
                    "Permiso necesario",
                    "Necesitamos acceso a tus fotos para agregar imágenes a tu review",
                    [{ text: "OK" }]
                );
                return;
            }


            // Abrir selector de imágenes
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                selectionLimit: 3 - photos.length, // Limitar según fotos ya seleccionadas
            });


            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newPhotos = result.assets.map((asset) => asset.uri);
                const updatedPhotos = [...photos, ...newPhotos].slice(0, 3); // Máximo 3 fotos
                setPhotos(updatedPhotos);
            }
        } catch (error) {
            Alert.alert(
                "Error",
                "No se pudieron cargar las imágenes. Por favor intenta nuevamente.",
                [{ text: "OK" }]
            );
        }
    };

    const handleSubmit = async () => {
        if (rating < MIN_RATING || rating > MAX_RATING) {
            Alert.alert("Error", "El puntaje debe estar entre 1 y 5");
            return;
        }

        if (!placeId) {
            Alert.alert("Error", "No se pudo identificar el lugar");
            return;
        }

        try {
            setUploading(true);

            // Convertir URIs a ArrayBuffers para subirlas
            let photoBuffers: ArrayBuffer[] = [];
            if (photos.length > 0) {
                try {
                    photoBuffers = await urisToArrayBuffers(photos);
                } catch (photoError) {
                    throw new Error("Error al procesar las imágenes. Por favor, intenta de nuevo.");
                }
            }

            const newReview = await createReview({
                place_id: placeId,
                rating,
                comment: comment || undefined,
                visit_date: visitDate,
                photos: photoBuffers,
                group_id: selectedGroupId,
            });

            Alert.alert("Éxito", "Review creada correctamente", [
                {
                    text: "OK",
                    onPress: () => navigation.goBack(),
                },
            ]);
        } catch (error) {
            let errorMessage = "No se pudo crear la review. Por favor, intenta de nuevo.";
            
            if (error instanceof Error) {
                errorMessage = error.message;
                
                // Mensajes más amigables para errores comunes
                if (error.message.includes("Usuario no autenticado")) {
                    errorMessage = "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.";
                } else if (error.message.includes("permission") || error.message.includes("permiso")) {
                    errorMessage = "No tienes permisos para crear esta review.";
                } else if (error.message.includes("violates") || error.message.includes("constraint")) {
                    errorMessage = "Error de validación. Verifica que todos los campos sean correctos.";
                }
            }
            
            Alert.alert("Error", errorMessage);
        } finally {
            setUploading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.placeName}>{placeName}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Puntaje</Text>
                <StarRating
                    rating={rating}
                    onRatingChange={setRating}
                    size={32}
                />
                <Text style={styles.ratingText}>{rating} de 5 estrellas</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Comentario</Text>
                <TextInput
                    style={styles.textInput}
                    placeholder="Escribe tu opinión sobre este lugar..."
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Fecha de visita</Text>
                <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowCalendar(true)}
                >
                    <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={theme.colors.textSecondary}
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.dateButtonText}>
                        {visitDate
                            ? new Date(visitDate).toLocaleDateString("es-ES", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                              })
                            : "Seleccionar fecha"}
                    </Text>
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={theme.colors.textSecondary}
                    />
                </TouchableOpacity>
            </View>

            <Modal
                visible={showCalendar}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCalendar(false)}
            >
                <View style={styles.calendarModal}>
                    <View style={styles.calendarContainer}>
                        <View style={styles.calendarHeader}>
                            <Text style={styles.calendarTitle}>
                                Seleccionar Fecha
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowCalendar(false)}
                                style={styles.calendarCloseButton}
                            >
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={theme.colors.text}
                                />
                            </TouchableOpacity>
                        </View>
                        <Calendar
                            onDayPress={(day) => {
                                setVisitDate(day.dateString);
                                setShowCalendar(false);
                            }}
                            markedDates={{
                                [visitDate]: {
                                    selected: true,
                                    selectedColor: theme.colors.primary,
                                },
                            }}
                            theme={{
                                backgroundColor: theme.colors.background,
                                calendarBackground: theme.colors.background,
                                textSectionTitleColor:
                                    theme.colors.textSecondary,
                                selectedDayBackgroundColor:
                                    theme.colors.primary,
                                selectedDayTextColor: "#FFFFFF",
                                todayTextColor: theme.colors.primary,
                                dayTextColor: theme.colors.text,
                                textDisabledColor: theme.colors.textTertiary,
                                dotColor: theme.colors.primary,
                                selectedDotColor: "#FFFFFF",
                                arrowColor: theme.colors.primary,
                                monthTextColor: theme.colors.text,
                                textDayFontWeight: "500",
                                textMonthFontWeight: "600",
                                textDayHeaderFontWeight: "600",
                                textDayFontSize: 16,
                                textMonthFontSize: 18,
                                textDayHeaderFontSize: 14,
                            }}
                            enableSwipeMonths={true}
                        />
                    </View>
                </View>
            </Modal>

            {/* Solo mostrar selector de grupos si NO hay groupId en params (es decir, si no venimos de una lista específica) */}
            {!groupId && groups.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.label}>Grupo (opcional)</Text>
                    <View style={styles.groupSelector}>
                        <TouchableOpacity
                            style={[
                                styles.groupOption,
                                !selectedGroupId && styles.groupOptionSelected,
                            ]}
                            onPress={() => setSelectedGroupId(undefined)}
                        >
                            <Text
                                style={[
                                    styles.groupOptionText,
                                    !selectedGroupId &&
                                        styles.groupOptionTextSelected,
                                ]}
                            >
                                Sin grupo
                            </Text>
                        </TouchableOpacity>
                        {groups.map((group) => (
                            <TouchableOpacity
                                key={group.id}
                                style={[
                                    styles.groupOption,
                                    selectedGroupId === group.id &&
                                        styles.groupOptionSelected,
                                ]}
                                onPress={() => setSelectedGroupId(group.id)}
                            >
                                <Text
                                    style={[
                                        styles.groupOptionText,
                                        selectedGroupId === group.id &&
                                            styles.groupOptionTextSelected,
                                    ]}
                                >
                                    {group.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.label}>Fotos ({photos.length}/3)</Text>
                <TouchableOpacity
                    style={styles.photoButton}
                    onPress={handlePickImage}
                    disabled={photos.length >= 3}
                >
                    <Text style={styles.photoButtonText}>
                        {photos.length >= 3
                            ? "Máximo 3 fotos"
                            : "Agregar Fotos"}
                    </Text>
                </TouchableOpacity>
                {photos.length > 0 && (
                    <View style={styles.photosContainer}>
                        {photos.map((uri, index) => (
                            <View
                                key={`photo-${uri}-${index}`}
                                style={styles.photoItem}
                            >
                                <Image
                                    source={{ uri }}
                                    style={styles.photoPreview}
                                    resizeMode="cover"
                                />
                                <TouchableOpacity
                                    style={styles.removePhotoButton}
                                    onPress={() =>
                                        setPhotos(
                                            photos.filter((_, i) => i !== index)
                                        )
                                    }
                                >
                                    <Ionicons
                                        name="close"
                                        size={16}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.submitButtonText}>Guardar Review</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        backgroundColor: theme.colors.backgroundLight,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.borderLight,
    },
    placeName: {
        ...theme.typography.h2,
        color: theme.colors.text,
        fontWeight: '700',
    },
    section: {
        backgroundColor: theme.colors.backgroundLight,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.borderLight,
    },
    label: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
        fontSize: 15,
        fontWeight: '600',
    },
    starsContainer: {
        flexDirection: "row",
        marginBottom: theme.spacing.sm,
    },
    starButton: {
        marginRight: theme.spacing.sm,
    },
    star: {
        fontSize: 36,
    },
    ratingText: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
    },
    textInput: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        ...theme.typography.body,
        minHeight: 120,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        textAlignVertical: "top",
        fontSize: 16,
        lineHeight: 22,
    },
    photoButton: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: theme.spacing.xs,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    photoButtonText: {
        color: theme.colors.primary,
        ...theme.typography.bodyBold,
        fontSize: 16,
    },
    photosContainer: {
        marginTop: theme.spacing.md,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
    },
    photoItem: {
        position: "relative",
        width: "48%",
        aspectRatio: 1,
        borderRadius: theme.borderRadius.md,
        overflow: "hidden",
        ...theme.shadows.sm,
    },
    photoPreview: {
        width: "100%",
        height: "100%",
    },
    removePhotoButton: {
        position: "absolute",
        top: theme.spacing.xs,
        right: theme.spacing.xs,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        borderRadius: theme.borderRadius.round,
        width: 28,
        height: 28,
        justifyContent: "center",
        alignItems: "center",
    },
    removePhoto: {
        fontSize: 18,
        color: "#FFFFFF",
        fontWeight: "bold",
    },
    submitButton: {
        backgroundColor: theme.colors.primary,
        margin: theme.spacing.lg,
        marginTop: theme.spacing.xl,
        paddingVertical: theme.spacing.md + 4,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 50,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: "#FFFFFF",
        ...theme.typography.bodyBold,
        fontSize: 17,
        fontWeight: '600',
    },
    groupSelector: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
    },
    groupOption: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        borderRadius: theme.borderRadius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
    },
    groupOptionSelected: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    groupOptionText: {
        ...theme.typography.body,
        color: theme.colors.text,
    },
    groupOptionTextSelected: {
        color: "#FFFFFF",
        ...theme.typography.bodyBold,
    },
    dateButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    dateButtonText: {
        ...theme.typography.body,
        color: theme.colors.text,
        flex: 1,
    },
    calendarModal: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    calendarContainer: {
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: theme.borderRadius.lg,
        borderTopRightRadius: theme.borderRadius.lg,
        paddingBottom: theme.spacing.lg,
    },
    calendarHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: theme.spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    calendarTitle: {
        ...theme.typography.h3,
        color: theme.colors.text,
    },
    calendarCloseButton: {
        padding: theme.spacing.xs,
    },
});
