// Tema moderno inspirado en aplicaciones profesionales
export const theme = {
    colors: {
        primary: "#0A84FF", // Azul iOS más vibrante
        primaryDark: "#0051D5",
        primaryLight: "#64D2FF",
        secondary: "#5E5CE6", // Púrpura moderno
        accent: "#FF9F0A", // Naranja vibrante
        success: "#30D158", // Verde moderno
        warning: "#FF9F0A",
        error: "#FF453A", // Rojo moderno
        background: "#F2F2F7", // Gris claro iOS
        backgroundLight: "#FFFFFF",
        backgroundDark: "#000000",
        surface: "#FFFFFF",
        surfaceElevated: "#FFFFFF",
        surfaceSecondary: "#F9F9F9",
        text: "#000000",
        textLight: "#FFFFFF",
        textSecondary: "#8E8E93", // Gris iOS estándar
        textTertiary: "#C7C7CC",
        border: "#E5E5EA", // Borde muy suave
        borderLight: "#F2F2F7",
        shadow: "rgba(0, 0, 0, 0.1)",
        overlay: "rgba(0, 0, 0, 0.4)",
        gradientStart: "#0A84FF",
        gradientEnd: "#5E5CE6",
        cardBackground: "#FFFFFF",
        cardBorder: "#E5E5EA",
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 20,
        xl: 24,
        xxl: 32,
    },
    borderRadius: {
        sm: 6,
        md: 10,
        lg: 14,
        xl: 20,
        xxl: 28,
        round: 9999,
    },
    typography: {
        h1: {
            fontSize: 32,
            fontWeight: "700" as const,
            lineHeight: 40,
        },
        h2: {
            fontSize: 24,
            fontWeight: "700" as const,
            lineHeight: 32,
        },
        h3: {
            fontSize: 20,
            fontWeight: "600" as const,
            lineHeight: 28,
        },
        body: {
            fontSize: 16,
            fontWeight: "400" as const,
            lineHeight: 24,
        },
        bodyBold: {
            fontSize: 16,
            fontWeight: "600" as const,
            lineHeight: 24,
        },
        caption: {
            fontSize: 14,
            fontWeight: "400" as const,
            lineHeight: 20,
        },
        small: {
            fontSize: 12,
            fontWeight: "400" as const,
            lineHeight: 16,
        },
    },
    shadows: {
        sm: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
        },
        lg: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 4,
        },
        xl: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 8,
        },
    },
};
