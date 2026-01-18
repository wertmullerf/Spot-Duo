import { SupabaseClient } from "@supabase/supabase-js";
import { IStorageService } from "../interfaces/IStorageService";

export class SupabaseStorageAdapter implements IStorageService {
    private supabase: SupabaseClient;
    private bucketName: string;

    constructor(
        supabase: SupabaseClient,
        bucketName: string = "review-photos"
    ) {
        this.supabase = supabase;
        this.bucketName = bucketName;
    }

    async uploadImage(file: File | Blob, path: string): Promise<string> {
        const fileExt = this.getFileExtension(file);
        const fileName = `${path}/${Date.now()}.${fileExt}`;

        console.log("📤 Subiendo imagen:", {
            fileName,
            fileSize: file.size,
            fileType: file.type,
        });

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || `image/${fileExt}`,
            });

        if (error) {
            console.error("❌ Error al subir imagen:", error);
            throw error;
        }

        const publicUrl = this.getPublicUrl(data.path);
        console.log("✅ Imagen subida exitosamente:", {
            storagePath: data.path,
            publicUrl,
        });

        return publicUrl;
    }

    /**
     * Sube una imagen y retorna tanto la URL como el path de storage
     * Acepta File, Blob o ArrayBuffer (para React Native)
     */
    async uploadImageWithPath(
        file: File | Blob | ArrayBuffer,
        path: string,
        mimeType?: string
    ): Promise<{ url: string; path: string }> {
        let fileExt = "jpg";
        let contentType = mimeType || "image/jpeg";

        // Si es File o Blob, obtener extensión y tipo del objeto
        if (file instanceof File || (file instanceof Blob && file.size > 0)) {
            fileExt = this.getFileExtension(file);
            contentType = file.type || `image/${fileExt}`;
        } else if (mimeType) {
            // Si es ArrayBuffer y tenemos mimeType, extraer extensión del tipo
            if (mimeType.includes("png")) fileExt = "png";
            else if (mimeType.includes("webp")) fileExt = "webp";
            else if (mimeType.includes("jpeg") || mimeType.includes("jpg"))
                fileExt = "jpg";
        }

        // Agregar timestamp para evitar colisiones
        const fileName = path.includes(".")
            ? path
            : `${path}_${Date.now()}.${fileExt}`;

        const fileSize =
            file instanceof ArrayBuffer
                ? file.byteLength
                : (file as File | Blob).size || 0;

        console.log("📤 Subiendo imagen con path:", {
            originalPath: path,
            fileName,
            fileExt,
            fileSize,
            contentType,
            isArrayBuffer: file instanceof ArrayBuffer,
        });

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: contentType,
            });

        if (error) {
            console.error("❌ Error al subir imagen:", {
                error,
                fileName,
                bucketName: this.bucketName,
            });
            throw error;
        }

        const publicUrl = this.getPublicUrl(data.path);
        console.log("✅ Imagen subida exitosamente:", {
            storagePath: data.path,
            publicUrl,
            fileName,
        });

        return { url: publicUrl, path: data.path };
    }

    async uploadImages(
        files: (File | Blob)[],
        basePath: string
    ): Promise<string[]> {
        console.log(`📤 Subiendo ${files.length} imágenes`);

        const uploadPromises = files.map(async (file, index) => {
            const path = `${basePath}/${index}`;
            try {
                const url = await this.uploadImage(file, path);
                console.log(`✅ Imagen ${index + 1}/${files.length} subida`);
                return url;
            } catch (error) {
                console.error(`❌ Error en imagen ${index + 1}:`, error);
                throw error;
            }
        });

        const results = await Promise.all(uploadPromises);
        console.log(`✅ Todas las ${results.length} imágenes subidas`);
        return results;
    }

    async deleteImage(path: string): Promise<boolean> {
        const relativePath = this.extractRelativePath(path);

        console.log("🗑️ Eliminando imagen:", relativePath);

        const { error } = await this.supabase.storage
            .from(this.bucketName)
            .remove([relativePath]);

        if (error) {
            console.error("❌ Error al eliminar imagen:", error);
            throw error;
        }

        console.log("✅ Imagen eliminada exitosamente");
        return true;
    }

    getPublicUrl(path: string): string {
        const { data } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(path);

        // Asegurarse de que la URL sea válida
        const url = data.publicUrl;
        console.log("🔗 URL pública generada:", url);

        return url;
    }

    private getFileExtension(file: File | Blob): string {
        if (file instanceof File && file.name) {
            const name = file.name;
            const lastDot = name.lastIndexOf(".");
            if (lastDot !== -1) {
                return name.substring(lastDot + 1).toLowerCase();
            }
        }

        // Para Blob, inferir del tipo MIME
        const mimeType = file.type || "";
        if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
        if (mimeType.includes("png")) return "png";
        if (mimeType.includes("webp")) return "webp";
        if (mimeType.includes("gif")) return "gif";

        return "jpg"; // Default
    }

    private extractRelativePath(fullPath: string): string {
        // Si es una URL completa, extraer el path
        try {
            const url = new URL(fullPath);
            const pathParts = url.pathname.split("/");
            const bucketIndex = pathParts.findIndex(
                (part) => part === this.bucketName
            );
            if (bucketIndex !== -1) {
                return pathParts.slice(bucketIndex + 1).join("/");
            }
        } catch {
            // No es una URL, continuar con el procesamiento
        }

        // Si ya es un path relativo con el bucket, removerlo
        if (fullPath.startsWith(this.bucketName + "/")) {
            return fullPath.substring(this.bucketName.length + 1);
        }

        // Si empieza con /, removerlo
        if (fullPath.startsWith("/")) {
            return fullPath.substring(1);
        }

        return fullPath;
    }
}
