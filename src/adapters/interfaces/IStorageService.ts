export interface IStorageService {
  /**
   * Sube una imagen y retorna la URL pública
   */
  uploadImage(file: File | Blob, path: string): Promise<string>;

  /**
   * Elimina una imagen del storage
   */
  deleteImage(path: string): Promise<boolean>;

  /**
   * Obtiene la URL pública de una imagen
   */
  getPublicUrl(path: string): string;

  /**
   * Sube múltiples imágenes
   */
  uploadImages(files: (File | Blob)[], basePath: string): Promise<string[]>;
}

