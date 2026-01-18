import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    Image,
    ActivityIndicator,
    Animated,
    Dimensions,
    TextInput,
    KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { theme } from "@/utils/theme";

const { width, height } = Dimensions.get("window");

export function AuthScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const { signIn, signUp, loading, error } = useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Animación de entrada
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();

        // Animación de pulso en el logo
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const handleSubmit = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Por favor completa todos los campos");
            return;
        }

        if (isSignUp && !name) {
            Alert.alert("Error", "Por favor ingresa tu nombre");
            return;
        }

        try {
            if (isSignUp) {
                await signUp(email, password, name);
            } else {
                await signIn(email, password);
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Error al autenticarse";
            Alert.alert("Error", errorMessage);
        }
    };

    return (
        <LinearGradient
            colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
            style={styles.gradient}
        >
            {/* Decoraciones de fondo */}
            <View style={styles.decorations}>
                <View style={[styles.circle, styles.circle1]} />
                <View style={[styles.circle, styles.circle2]} />
                <View style={[styles.circle, styles.circle3]} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <View style={styles.header}>
                        <Animated.View
                            style={[
                                styles.logoContainer,
                                {
                                    transform: [
                                        { scale: scaleAnim },
                                        { scale: pulseAnim },
                                    ],
                                },
                            ]}
                        >
                            <View style={styles.logoShadow} />
                            <Image
                                style={styles.logo}
                                source={require("../../assets/spot-duo.png")}
                            />
                        </Animated.View>
                        <Text style={styles.title}>SpotDuo</Text>
                        <Text style={styles.subtitle}>
                            {isSignUp
                                ? "Crea tu cuenta para comenzar"
                                : "Inicia sesión para continuar"}
                        </Text>
                    </View>

                    {isSignUp && (
                        <TextInput
                            style={styles.input}
                            placeholder="Nombre"
                            placeholderTextColor="rgba(0, 0, 0, 0.5)"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    )}

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="rgba(0, 0, 0, 0.5)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Contraseña"
                        placeholderTextColor="rgba(0, 0, 0, 0.5)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    {error && (
                        <View style={styles.errorContainer}>
                            <Ionicons
                                name="alert-circle"
                                size={20}
                                color="#FFD700"
                                style={styles.errorIcon}
                            />
                            <Text style={styles.errorText}>{error.message}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.submitButton, loading && styles.buttonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.primary} size="small" />
                        ) : (
                            <Text style={styles.submitButtonText}>
                                {isSignUp ? "Registrarse" : "Iniciar Sesión"}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.switchButton}
                        onPress={() => setIsSignUp(!isSignUp)}
                    >
                        <Text style={styles.switchText}>
                            {isSignUp
                                ? "¿Ya tienes cuenta? Inicia sesión"
                                : "¿No tienes cuenta? Regístrate"}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    decorations: {
        position: "absolute",
        width: "100%",
        height: "100%",
        overflow: "hidden",
    },
    circle: {
        position: "absolute",
        borderRadius: 9999,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    circle1: {
        width: 300,
        height: 300,
        top: -100,
        right: -100,
    },
    circle2: {
        width: 200,
        height: 200,
        bottom: -50,
        left: -50,
    },
    circle3: {
        width: 150,
        height: 150,
        top: height * 0.4,
        right: -30,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        padding: theme.spacing.lg,
        zIndex: 1,
    },
    header: {
        alignItems: "center",
        marginBottom: theme.spacing.xxl + 8,
    },
    logoContainer: {
        position: "relative",
        marginBottom: theme.spacing.lg,
    },
    logoShadow: {
        position: "absolute",
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        top: -15,
        left: -15,
        ...theme.shadows.xl,
    },
    logo: {
        width: 250,
        height: 250,
        borderRadius: 125,
    },
    title: {
        ...theme.typography.h1,
        color: "#FFFFFF",
        textAlign: "center",
        marginBottom: theme.spacing.sm,
        fontSize: 42,
        fontWeight: "800",
        letterSpacing: -1,
        textShadowColor: "rgba(0, 0, 0, 0.2)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    subtitle: {
        ...theme.typography.body,
        color: "rgba(255, 255, 255, 0.95)",
        textAlign: "center",
        fontSize: 17,
        fontWeight: "400",
        paddingHorizontal: theme.spacing.xl,
    },
    input: {
        backgroundColor: "#FFFFFF",
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.md + 4,
        marginBottom: theme.spacing.md,
        fontSize: 16,
        ...theme.shadows.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(0, 0, 0, 0.05)",
    },
    submitButton: {
        backgroundColor: "#FFFFFF",
        borderRadius: theme.borderRadius.xxl,
        padding: theme.spacing.lg,
        alignItems: "center",
        justifyContent: "center",
        ...theme.shadows.xl,
        marginTop: theme.spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(0, 0, 0, 0.05)",
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: theme.colors.text,
        ...theme.typography.bodyBold,
        fontSize: 18,
        fontWeight: "600",
    },
    switchButton: {
        marginTop: theme.spacing.xl,
        alignItems: "center",
    },
    switchText: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 14,
        textDecorationLine: "underline",
    },
    errorContainer: {
        backgroundColor: "rgba(255, 215, 0, 0.2)",
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.xs,
        borderWidth: 1,
        borderColor: "rgba(255, 215, 0, 0.3)",
    },
    errorIcon: {
        marginRight: theme.spacing.xs,
    },
    errorText: {
        color: "#FFD700",
        fontSize: 14,
        textAlign: "center",
        fontWeight: "500",
    },
    footerText: {
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: 12,
        textAlign: "center",
        marginTop: theme.spacing.xl,
        paddingHorizontal: theme.spacing.xl,
    },
});
