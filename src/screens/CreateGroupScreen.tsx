import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useGroups } from '@/hooks/useGroups';
import { CreateGroupScreenNavigationProp } from '@/types/navigation';
import { theme } from '@/utils/theme';

interface Props {
  navigation: CreateGroupScreenNavigationProp;
}

export function CreateGroupScreen({ navigation }: Props) {
  const { createGroup, loading } = useGroups();
  const [groupName, setGroupName] = useState('');

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para el grupo');
      return;
    }

    try {
      const group = await createGroup(groupName.trim());
      // Navegar al mapa del grupo creado, pero mantener GroupsList en el stack
      navigation.navigate('Map', { groupId: group.id });
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Error al crear grupo'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Crear Nuevo Grupo</Text>
          <Text style={styles.subtitle}>
            Crea un grupo para compartir reviews con tus amigos
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nombre del Grupo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Viajes 2024, Restaurantes Favoritos..."
            value={groupName}
            onChangeText={setGroupName}
            autoCapitalize="words"
            maxLength={50}
          />
          <Text style={styles.hint}>
            {groupName.length}/50 caracteres
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Crear Grupo</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.info}>
          💡 Después de crear el grupo, podrás generar un código de invitación
          para compartir con otros usuarios.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  form: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.bodyBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  hint: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.md,
    marginBottom: theme.spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...theme.typography.bodyBold,
    color: '#FFFFFF',
  },
  info: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

