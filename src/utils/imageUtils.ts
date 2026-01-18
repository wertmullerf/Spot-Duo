/**
 * Utilidades para manejo de imágenes en React Native
 */
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Optimiza una imagen redimensionándola a un tamaño máximo manteniendo el aspect ratio
 */
export async function optimizeImage(
    uri: string,
    maxWidth: number = 1200,
    maxHeight: number = 1200
): Promise<string> {
    try {
        // Primero obtener las dimensiones sin procesar
        // Usamos una manipulación vacía para obtener metadata
        const tempResult = await ImageManipulator.manipulateAsync(
            uri,
            [],
            { format: ImageManipulator.SaveFormat.JPEG }
        );
        
        const originalWidth = tempResult.width;
        const originalHeight = tempResult.height;
        
        // Si la imagen ya es más pequeña que el máximo, no redimensionar
        if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
            // Solo comprimir si es necesario
            const compressedResult = await ImageManipulator.manipulateAsync(
                uri,
                [],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            return compressedResult.uri;
        }
        
        // Calcular las nuevas dimensiones manteniendo el aspect ratio
        const aspectRatio = originalWidth / originalHeight;
        let newWidth = originalWidth;
        let newHeight = originalHeight;
        
        // Ajustar para que quepa dentro del rectángulo máximo
        if (originalWidth > originalHeight) {
            // Imagen horizontal o cuadrada
            newWidth = Math.min(originalWidth, maxWidth);
            newHeight = Math.round(newWidth / aspectRatio);
            
            // Si la altura resultante excede el máximo, ajustar por altura
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
                newWidth = Math.round(newHeight * aspectRatio);
            }
        } else {
            // Imagen vertical
            newHeight = Math.min(originalHeight, maxHeight);
            newWidth = Math.round(newHeight * aspectRatio);
            
            // Si el ancho resultante excede el máximo, ajustar por ancho
            if (newWidth > maxWidth) {
                newWidth = maxWidth;
                newHeight = Math.round(newWidth / aspectRatio);
            }
        }
        
        // Redimensionar manteniendo el aspect ratio y comprimir
        const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: newWidth, height: newHeight } }],
            { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        return manipResult.uri;
    } catch (error) {
        // Si falla, usar la imagen original
        return uri;
    }
}

/**
 * Convierte una URI de imagen a ArrayBuffer para subirla a storage
 * Compatible con React Native y Expo
 * En React Native, necesitamos usar ArrayBuffer directamente, no Blob
 * Ahora también optimiza la imagen antes de convertirla
 */
export async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
    try {
        console.log(
            "📸 Iniciando conversión de URI a ArrayBuffer:",
            uri.substring(0, 100)
        );

        // Optimizar imagen antes de convertir (solo para URIs locales)
        // Usar 1200px como máximo para mantener buena calidad pero reducir tamaño
        let imageUri = uri;
        if (uri.startsWith("file://")) {
            imageUri = await optimizeImage(uri, 1200, 1200);
        }

        // Si es una URI local (file://), usar FileSystem
        if (imageUri.startsWith("file://")) {
            // Leer el archivo como base64 usando API legacy
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
                encoding: "base64",
            } as any);

            if (!base64 || base64.length === 0) {
                throw new Error("El archivo está vacío o no se pudo leer");
            }

            console.log("📸 Base64 obtenido, longitud:", base64.length);

            // Convertir base64 a ArrayBuffer usando base64-arraybuffer
            const arrayBuffer = decode(base64);

            console.log("✅ ArrayBuffer creado:", {
                byteLength: arrayBuffer.byteLength,
                base64Length: base64.length,
            });

            if (arrayBuffer.byteLength === 0) {
                throw new Error(
                    "Error al convertir base64 a ArrayBuffer. El buffer resultante está vacío"
                );
            }

            return arrayBuffer;
        }

        // Si es una URI remota (http/https), usar fetch directo
        console.log("📸 URI remota detectada, usando fetch directo");
        const response = await fetch(uri);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Para URIs remotas, convertir la respuesta a ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        console.log("✅ ArrayBuffer creado desde URI remota:", {
            byteLength: arrayBuffer.byteLength,
        });

        return arrayBuffer;
    } catch (error) {
        console.error("❌ Error al convertir URI a ArrayBuffer:", error);
        throw new Error(
            `No se pudo convertir la imagen: ${
                error instanceof Error ? error.message : "Error desconocido"
            }`
        );
    }
}

/**
 * Convierte múltiples URIs a ArrayBuffers
 */
export async function urisToArrayBuffers(
    uris: string[]
): Promise<ArrayBuffer[]> {
    console.log(`📸 Convirtiendo ${uris.length} imágenes a ArrayBuffers`);
    const results = await Promise.all(
        uris.map(async (uri, index) => {
            try {
                const arrayBuffer = await uriToArrayBuffer(uri);
                console.log(`✅ Imagen ${index + 1}/${uris.length} convertida`);
                return arrayBuffer;
            } catch (error) {
                console.error(`❌ Error en imagen ${index + 1}:`, error);
                throw error;
            }
        })
    );
    console.log(
        `✅ Todas las ${results.length} imágenes convertidas exitosamente`
    );
    return results;
}

/**
 * Valida que una URI sea accesible
 */
export async function validateImageUri(uri: string): Promise<boolean> {
    try {
        if (uri.startsWith("file://")) {
            const info = await FileSystem.getInfoAsync(uri);
            return info.exists;
        }

        const response = await fetch(uri, { method: "HEAD" });
        return response.ok;
    } catch {
        return false;
    }
}
