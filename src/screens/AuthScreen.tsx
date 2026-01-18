import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/hooks/useAuth";
import { theme } from "@/utils/theme";

export function AuthScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const { signIn, signUp, loading, error } = useAuth();

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
            console.log("🔐 Iniciando", isSignUp ? "registro" : "login", "...");
            if (isSignUp) {
                console.log("📝 Registrando usuario:", email);
                const newUser = await signUp(email, password, name);
                console.log("✅ Usuario registrado:", newUser?.id);
            } else {
                console.log("🔑 Iniciando sesión:", email);
                const user = await signIn(email, password);
                console.log("✅ Sesión iniciada:", user?.id);
            }
        } catch (err) {
            console.error("❌ Error en autenticación:", err);
            const errorMessage =
                err instanceof Error ? err.message : "Error al autenticarse";
            console.error("❌ Mensaje de error:", errorMessage);
            Alert.alert("Error", errorMessage);
        }
    };

    return (
        <LinearGradient
            colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
            style={styles.gradient}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Image
                            style={styles.logo}
                            source={require("../../assets/spot-duo.png")}
                        />
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
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    )}

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Contraseña"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    {error && (
                        <Text style={styles.errorText}>{error.message}</Text>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.button,
                            loading && styles.buttonDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>
                            {loading
                                ? "Cargando..."
                                : isSignUp
                                ? "Registrarse"
                                : "Iniciar Sesión"}
                        </Text>
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
                </View>
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
    logo: {
        width: 250,
        height: 250,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        padding: theme.spacing.lg,
    },
    header: {
        alignItems: "center",
        marginBottom: theme.spacing.xl,
    },
    emoji: {
        fontSize: 64,
        marginBottom: theme.spacing.md,
    },
    title: {
        ...theme.typography.h1,
        color: "#FFFFFF",
        textAlign: "center",
        marginBottom: theme.spacing.sm,
    },
    subtitle: {
        ...theme.typography.body,
        color: "rgba(255, 255, 255, 0.9)",
        textAlign: "center",
        marginBottom: theme.spacing.xl,
    },
    input: {
        backgroundColor: "#FFFFFF",
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        fontSize: 16,
        ...theme.shadows.sm,
    },
    button: {
        backgroundColor: "#FFFFFF",
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        alignItems: "center",
        marginTop: theme.spacing.sm,
        ...theme.shadows.md,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: theme.colors.primary,
        ...theme.typography.bodyBold,
    },
    switchButton: {
        marginTop: theme.spacing.lg,
        alignItems: "center",
    },
    switchText: {
        color: "#FFFFFF",
        fontSize: 14,
        textDecorationLine: "underline",
    },
    errorText: {
        color: "#FFD700",
        fontSize: 14,
        marginBottom: theme.spacing.sm,
        textAlign: "center",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        padding: theme.spacing.sm,
        borderRadius: theme.borderRadius.sm,
    },
});
