import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useGroups } from "@/hooks/useGroups";
import { useAuth } from "@/hooks/useAuth";
import { Group } from "@/models/Group";
import { GroupsListScreenNavigationProp } from "@/types/navigation";
import { theme } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { supabaseClient } from "@/config/services";

interface Props {
    navigation: GroupsListScreenNavigationProp;
}

export function GroupsListScreen({ navigation }: Props) {
    const { user, signOut } = useAuth();
    const { getUserGroups, loading } = useGroups();
    const [groups, setGroups] = useState<Group[]>([]);

    const loadGroups = useCallback(async () => {
        try {
            const userGroups = await getUserGroups();
            setGroups(userGroups);
        } catch (error) {
            setGroups([]);
        }
    }, [getUserGroups]);

    useEffect(() => {
        if (user) {
            loadGroups();
        }
    }, [user, loadGroups]);

    // Recargar grupos cuando se vuelve a la pantalla
    useFocusEffect(
        React.useCallback(() => {
            if (user) {
                loadGroups();
            }
        }, [user, loadGroups])
    );

    // Suscripción en tiempo real a cambios en grupos
    useEffect(() => {
        if (!user) return;

        const groupsSubscription = supabaseClient
            .channel(`user-groups:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'groups',
                },
                (payload) => {
                    // Invalidar cache y recargar grupos cuando hay cambios
                    const { cache, cacheKeys } = require('@/utils/cache');
                    cache.invalidateCache(cacheKeys.userGroups(user.id));
                    loadGroups();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, DELETE (cuando se agrega o elimina un miembro)
                    schema: 'public',
                    table: 'group_members',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    // Invalidar cache y recargar grupos cuando cambia la membresía
                    const { cache, cacheKeys } = require('@/utils/cache');
                    cache.invalidateCache(cacheKeys.userGroups(user.id));
                    loadGroups();
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(groupsSubscription);
        };
    }, [user, loadGroups]);

    const handleSignOut = async () => {
        try {
            await signOut();
            // La navegación se manejará automáticamente por el cambio de estado de auth
        } catch (error) {
            Alert.alert(
                "Error",
                error instanceof Error
                    ? error.message
                    : "Error al cerrar sesión"
            );
        }
    };

    const renderItem = ({ item }: { item: Group }) => (
        <View style={styles.groupCard}>
            <TouchableOpacity
                style={styles.groupContent}
                onPress={() => {
                    // Navegar al mapa con el grupo seleccionado
                    navigation.navigate("Map", { groupId: item.id });
                }}
            >
                <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{item.name}</Text>
                    <Text style={styles.groupArrow}>→</Text>
                </View>
                <Text style={styles.groupDate}>
                    Creado: {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.shareButton}
                onPress={() => {
                    // Navegar a detalles del grupo para compartir
                    navigation.navigate("GroupDetail", { groupId: item.id });
                }}
            >
                <Ionicons
                    name="share-outline"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                />
                <Text style={styles.shareButtonText}>Compartir</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading && groups.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Cargando grupos...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mis Grupos</Text>
                <Text style={styles.headerSubtitle}>
                    {groups.length} {groups.length === 1 ? "grupo" : "grupos"}
                </Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.createButton]}
                    onPress={() => navigation.navigate("CreateGroup")}
                >
                    <Ionicons
                        name="add-circle"
                        size={20}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.actionButtonText}>Crear Grupo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.joinButton]}
                    onPress={() => navigation.navigate("JoinGroup")}
                >
                    <Ionicons
                        name="link"
                        size={20}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.actionButtonText}>
                        Unirse con Código
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={groups}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadGroups}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons
                            name="people"
                            size={64}
                            color={theme.colors.textSecondary}
                        />
                        <Text style={styles.emptyText}>
                            No tienes listas aún
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Crea una lista o únete a una con un código
                        </Text>
                    </View>
                }
                ListFooterComponent={
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={() => {
                                Alert.alert(
                                    "Cerrar Sesión",
                                    "¿Estás seguro de que quieres cerrar sesión?",
                                    [
                                        {
                                            text: "Cancelar",
                                            style: "cancel",
                                        },
                                        {
                                            text: "Cerrar Sesión",
                                            style: "destructive",
                                            onPress: handleSignOut,
                                        },
                                    ]
                                );
                            }}
                        >
                            <Ionicons
                                name="log-out-outline"
                                size={20}
                                color="#FFFFFF"
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.logoutButtonText}>
                                Cerrar Sesión
                            </Text>
                        </TouchableOpacity>
                        {user && (
                            <Text style={styles.userInfo}>
                                Sesión: {user.email || user.name || "Usuario"}
                            </Text>
                        )}
                    </View>
                }
            />
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
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        paddingTop: Platform.OS === "ios" ? 60 : theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
    },
    headerTitle: {
        ...theme.typography.h1,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
        fontWeight: "700",
        fontSize: 34,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
    },
    actions: {
        flexDirection: "row",
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    actionButton: {
        flex: 1,
        paddingVertical: theme.spacing.md + 2,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: theme.spacing.xs,
    },
    createButton: {
        backgroundColor: theme.colors.primary,
    },
    joinButton: {
        backgroundColor: theme.colors.secondary,
    },
    actionButtonText: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    list: {
        padding: theme.spacing.md,
        paddingTop: theme.spacing.sm,
    },
    groupCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        marginBottom: theme.spacing.md,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    groupContent: {
        padding: theme.spacing.lg,
    },
    groupHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing.xs,
    },
    groupName: {
        ...theme.typography.h3,
        color: theme.colors.text,
        flex: 1,
        fontWeight: "600",
        fontSize: 17,
    },
    groupArrow: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
    },
    groupDate: {
        ...theme.typography.small,
        color: theme.colors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 120,
        paddingHorizontal: theme.spacing.lg,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: theme.spacing.md,
    },
    emptyText: {
        ...theme.typography.h3,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
        textAlign: "center",
    },
    emptySubtext: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        textAlign: "center",
    },
    shareButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.md,
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    shareButtonText: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    footer: {
        padding: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        alignItems: "center",
    },
    logoutButton: {
        backgroundColor: theme.colors.error || "#E74C3C",
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        ...theme.shadows.md,
        marginBottom: theme.spacing.md,
    },
    logoutButtonText: {
        ...theme.typography.bodyBold,
        color: "#FFFFFF",
    },
    userInfo: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
        textAlign: "center",
    },
});
