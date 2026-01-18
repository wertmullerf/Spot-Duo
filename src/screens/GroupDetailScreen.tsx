import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    Share,
} from "react-native";
import { useGroups } from "@/hooks/useGroups";
import { useAuth } from "@/hooks/useAuth";
import { RouteProp } from "@react-navigation/native";
import {
    GroupDetailScreenNavigationProp,
    RootStackParamList,
} from "@/types/navigation";
import { Group } from "@/models/Group";
import { User } from "@/models/User";
import { theme } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { supabaseClient } from "@/config/services";

type GroupDetailScreenRouteProp = RouteProp<RootStackParamList, "GroupDetail">;

interface Props {
    navigation: GroupDetailScreenNavigationProp;
    route: GroupDetailScreenRouteProp;
}

export function GroupDetailScreen({ navigation, route }: Props) {
    const { groupId } = route.params;
    const { user } = useAuth();
    const { getGroupMembers, generateInviteCode, deleteGroup, isGroupOwner, loading } = useGroups();
    const [members, setMembers] = useState<User[]>([]);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        if (groupId) {
            loadMembers();
        }
    }, [groupId, user]);

    // Suscripción en tiempo real a cambios en miembros y eliminación del grupo
    useEffect(() => {
        if (!groupId) return;

        const membersSubscription = supabaseClient
            .channel(`group-members:${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'group_members',
                    filter: `group_id=eq.${groupId}`,
                },
                (payload) => {
                    // Recargar miembros cuando hay cambios
                    loadMembers();
                }
            )
            .subscribe();

        const groupSubscription = supabaseClient
            .channel(`group-delete:${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'groups',
                    filter: `id=eq.${groupId}`,
                },
                (payload) => {
                    // El grupo fue eliminado, volver a la lista
                    Alert.alert(
                        "Grupo Eliminado",
                        "Este grupo ha sido eliminado.",
                        [
                            {
                                text: "OK",
                                onPress: () => navigation.goBack(),
                            },
                        ]
                    );
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(membersSubscription);
            supabaseClient.removeChannel(groupSubscription);
        };
    }, [groupId, navigation]);

    const loadMembers = async () => {
        if (!groupId) return;

        try {
            // Cargar miembros y verificar owner en paralelo para mejor rendimiento
            const { supabaseClient } = await import("@/config/services");
            
            const [groupMembers, ownerResult] = await Promise.all([
                getGroupMembers(groupId),
                user ? supabaseClient
                    .from("group_members")
                    .select("role")
                    .eq("group_id", groupId)
                    .eq("user_id", user.id)
                    .maybeSingle() : Promise.resolve({ data: null, error: null })
            ]);
            
            setMembers(groupMembers);
            
            // Verificar si el usuario es owner
            if (ownerResult.data && !ownerResult.error) {
                setIsOwner(ownerResult.data.role === 'owner');
            } else {
                setIsOwner(false);
            }
        } catch (error) {
            if (
                error instanceof Error &&
                !error.message.includes("permission")
            ) {
                Alert.alert(
                    "Error",
                    "No se pudieron cargar los miembros del grupo"
                );
            }
            setIsOwner(false);
        }
    };

    const handleGenerateCode = async () => {
        try {
            setGeneratingCode(true);
            const code = await generateInviteCode(groupId);
            setInviteCode(code);
        } catch (error) {
            Alert.alert(
                "Error",
                error instanceof Error
                    ? error.message
                    : "Error al generar código"
            );
        } finally {
            setGeneratingCode(false);
        }
    };

    const handleShareCode = async () => {
        if (!inviteCode) return;

        try {
            await Share.share({
                message: `Únete a mi grupo en Shared Reviews usando este código: ${inviteCode}`,
                title: "Código de Invitación",
            });
        } catch (error) {
            // Error silencioso al compartir
        }
    };

    const handleCopyCode = async () => {
        if (!inviteCode) return;
        try {
            // Usar Share API para copiar (funciona en iOS y Android)
            await Share.share({
                message: inviteCode,
                title: "Código de Invitación",
            });
            Alert.alert("Código listo para compartir", `Código: ${inviteCode}`);
        } catch (error) {
            Alert.alert("Código", inviteCode);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Detalles del Grupo</Text>
            </View>

            {/* Sección de Código de Invitación */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Compartir Grupo</Text>
                {inviteCode ? (
                    <View style={styles.codeContainer}>
                        <Text style={styles.codeLabel}>
                            Código de Invitación:
                        </Text>
                        <Text style={styles.code}>{inviteCode}</Text>
                        <View style={styles.codeActions}>
                            <TouchableOpacity
                                style={[styles.codeButton, styles.shareButton]}
                                onPress={handleShareCode}
                            >
                                <Ionicons
                                    name="share-outline"
                                    size={18}
                                    color="#FFFFFF"
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.codeButtonText}>
                                    Compartir
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.codeButton, styles.copyButton]}
                                onPress={handleCopyCode}
                            >
                                <Ionicons
                                    name="copy-outline"
                                    size={18}
                                    color="#FFFFFF"
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.codeButtonText}>
                                    Copiar Código
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.regenerateButton}
                            onPress={handleGenerateCode}
                            disabled={generatingCode}
                        >
                            <Ionicons
                                name="refresh"
                                size={18}
                                color={theme.colors.primary}
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.regenerateButtonText}>
                                Generar Nuevo Código
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        <TouchableOpacity
                            style={styles.generateButton}
                            onPress={handleGenerateCode}
                            disabled={generatingCode}
                        >
                            {generatingCode ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons
                                        name="share-outline"
                                        size={18}
                                        color="#FFFFFF"
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={styles.generateButtonText}>
                                        Generar Código para Compartir
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.hint}>
                            Genera un código único para compartir este grupo con
                            otras personas
                        </Text>
                    </View>
                )}
            </View>

            {/* Sección de Miembros */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Miembros ({members.length})
                </Text>
                {loading && members.length === 0 ? (
                    <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                    />
                ) : (
                    <View style={styles.membersList}>
                        {members.map((member) => (
                            <View key={member.id} style={styles.memberItem}>
                                <View style={styles.memberInfo}>
                                    <View style={styles.memberAvatar}>
                                        <Text style={styles.memberAvatarText}>
                                            {member.email
                                                ?.charAt(0)
                                                .toUpperCase() || "U"}
                                        </Text>
                                    </View>
                                    <View style={styles.memberDetails}>
                                        <Text style={styles.memberEmail}>
                                            {member.email ||
                                                `Usuario ${member.id.substring(
                                                    0,
                                                    8
                                                )}...`}
                                        </Text>
                                        {member.name && (
                                            <Text style={styles.memberName}>
                                                {member.name}
                                            </Text>
                                        )}
                                        {!member.email && (
                                            <Text style={styles.memberName}>
                                                ID: {member.id.substring(0, 8)}
                                                ...
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                {member.id === user?.id && (
                                    <Text style={styles.youLabel}>Tú</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Botón de eliminar grupo (solo para owner) */}
            {isOwner && (
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                            Alert.alert(
                                "Eliminar Grupo",
                                "¿Estás seguro de que quieres eliminar este grupo? Esta acción no se puede deshacer.",
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
                                                await deleteGroup(groupId);
                                                Alert.alert(
                                                    "Grupo Eliminado",
                                                    "El grupo ha sido eliminado correctamente",
                                                    [
                                                        {
                                                            text: "OK",
                                                            onPress: () =>
                                                                navigation.navigate("GroupsList"),
                                                        },
                                                    ]
                                                );
                                            } catch (error) {
                                                Alert.alert(
                                                    "Error",
                                                    error instanceof Error
                                                        ? error.message
                                                        : "No se pudo eliminar el grupo"
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
                            size={20}
                            color="#FFFFFF"
                            style={{ marginRight: 8 }}
                        />
                        <Text style={styles.deleteButtonText}>
                            Eliminar Grupo
                        </Text>
                    </TouchableOpacity>
                </View>
            ) }
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
        padding: theme.spacing.lg,
        paddingTop: Platform.OS === "ios" ? 60 : theme.spacing.lg,
        ...theme.shadows.sm,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
    },
    section: {
        backgroundColor: theme.colors.backgroundLight,
        margin: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.md,
        ...theme.shadows.sm,
    },
    sectionTitle: {
        ...theme.typography.h3,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    generateButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        ...theme.shadows.md,
    },
    generateButtonText: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    codeContainer: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        ...theme.shadows.sm,
    },
    codeLabel: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        textAlign: "center",
        marginBottom: theme.spacing.sm,
    },
    code: {
        ...theme.typography.h1,
        color: theme.colors.primary,
        textAlign: "center",
        letterSpacing: 4,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        marginBottom: theme.spacing.lg,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: theme.borderRadius.sm,
    },
    regenerateButton: {
        marginTop: theme.spacing.md,
        padding: theme.spacing.sm,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
    },
    regenerateButtonText: {
        ...theme.typography.body,
        color: theme.colors.primary,
        textDecorationLine: "underline",
    },
    codeActions: {
        flexDirection: "row",
        gap: theme.spacing.sm,
    },
    codeButton: {
        flex: 1,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
    },
    shareButton: {
        backgroundColor: theme.colors.primary,
    },
    copyButton: {
        backgroundColor: theme.colors.secondary,
    },
    codeButtonText: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    hint: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
        textAlign: "center",
        marginTop: theme.spacing.sm,
    },
    membersList: {
        gap: theme.spacing.sm,
    },
    memberItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: theme.spacing.md,
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        ...theme.shadows.sm,
    },
    memberInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.primary,
        justifyContent: "center",
        alignItems: "center",
        marginRight: theme.spacing.md,
    },
    memberAvatarText: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    memberDetails: {
        flex: 1,
    },
    memberEmail: {
        ...theme.typography.bodyBold,
        color: theme.colors.text,
    },
    memberName: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
    },
    youLabel: {
        ...theme.typography.caption,
        color: theme.colors.primary,
        fontWeight: "600",
    },
    deleteButton: {
        backgroundColor: theme.colors.error || "#FF3B30",
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        ...theme.shadows.md,
    },
    deleteButtonText: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    emptyText: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        textAlign: "center",
        padding: theme.spacing.md,
    },
});
