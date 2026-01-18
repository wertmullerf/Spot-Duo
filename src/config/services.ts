import { GoogleMapsAdapter } from "@/adapters/map/GoogleMapsAdapter";
import { MapboxAdapter } from "@/adapters/map/MapboxAdapter";
import { OpenStreetMapAdapter } from "@/adapters/map/OpenStreetMapAdapter";
import { SupabaseAdapter } from "@/adapters/database/SupabaseAdapter";
import { SupabaseStorageAdapter } from "@/adapters/storage/SupabaseStorageAdapter";
import { SupabaseAuthAdapter } from "@/adapters/auth/SupabaseAuthAdapter";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    IMapService,
    IStorageService,
    IDatabaseService,
    IAuthService,
} from "@/adapters/interfaces";

// ============================================
// CONFIGURACIÓN DE SERVICIOS
// ============================================
// Este archivo centraliza la configuración de todos los servicios.
// Para cambiar de proveedor, solo modifica las implementaciones aquí.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
const OSM_USER_AGENT =
    process.env.EXPO_PUBLIC_OSM_USER_AGENT || "SharedReviewsApp/1.0";
const STORAGE_BUCKET_NAME =
    process.env.EXPO_PUBLIC_STORAGE_BUCKET_NAME || "review-photos";

// Cliente de Supabase compartido con AsyncStorage para persistir sesión
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// ============================================
// INICIALIZACIÓN DE SERVICIOS
// ============================================

export const services: {
    map: IMapService;
    database: IDatabaseService;
    storage: IStorageService;
    auth: IAuthService;
} = {
    // Servicio de Mapas
    // OPCIÓN 1: Google Maps (PAGO después de $200 crédito/mes)
    // map: new GoogleMapsAdapter(GOOGLE_MAPS_API_KEY),

    // OPCIÓN 2: Mapbox (GRATIS hasta 50k requests/mes) ⭐ RECOMENDADO
    map: new OpenStreetMapAdapter(
        process.env.EXPO_PUBLIC_OSM_USER_AGENT || "SharedReviewsApp/1.0"
    ),

    // OPCIÓN 3: OpenStreetMap (100% GRATIS, menos features)
    // map: new OpenStreetMapAdapter(OSM_USER_AGENT),

    // Servicio de Base de Datos
    // Para cambiar a Firebase: import FirebaseAdapter y reemplazar aquí
    database: new SupabaseAdapter(supabaseClient),

    // Servicio de Storage
    // Para cambiar a Cloudinary: import CloudinaryAdapter y reemplazar aquí
    storage: new SupabaseStorageAdapter(supabaseClient, STORAGE_BUCKET_NAME),

    // Servicio de Autenticación
    // Para cambiar a Firebase Auth: import FirebaseAuthAdapter y reemplazar aquí
    auth: new SupabaseAuthAdapter(SUPABASE_URL, SUPABASE_ANON_KEY),
};

// ============================================
// EJEMPLO: Cómo cambiar de proveedor
// ============================================
/*
// Ejemplo: Cambiar de Google Maps a Mapbox
import { MapboxAdapter } from '@/adapters/map/MapboxAdapter';

export const services = {
  map: new MapboxAdapter(MAPBOX_ACCESS_TOKEN),
  database: new SupabaseAdapter(supabaseClient),
  storage: new SupabaseStorageAdapter(supabaseClient, STORAGE_BUCKET_NAME),
  auth: new SupabaseAuthAdapter(SUPABASE_URL, SUPABASE_ANON_KEY),
};

// Ejemplo: Cambiar de Supabase a Firebase
import { FirebaseAdapter } from '@/adapters/database/FirebaseAdapter';
import { FirebaseAuthAdapter } from '@/adapters/auth/FirebaseAuthAdapter';
import { CloudinaryAdapter } from '@/adapters/storage/CloudinaryAdapter';

export const services = {
  map: new GoogleMapsAdapter(GOOGLE_MAPS_API_KEY),
  database: new FirebaseAdapter(firebaseApp),
  storage: new CloudinaryAdapter(CLOUDINARY_CONFIG),
  auth: new FirebaseAuthAdapter(firebaseApp),
};
*/

// Exportar cliente de Supabase para uso directo si es necesario

export { supabaseClient };
