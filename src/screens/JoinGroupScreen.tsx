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
import { JoinGroupScreenNavigationProp } from '@/types/navigation';
import { theme } from '@/utils/theme';

interface Props {
  navigation: JoinGroupScreenNavigationProp;
}

export function JoinGroupScreen({ navigation }: Props) {
  const { joinGroupByCode, getInviteCodeInfo, loading } = useGroups();
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [codeInfo, setCodeInfo] = useState<{
    group_name: string;
    is_valid: boolean;
  } | null>(null);

  const handleCodeChange = async (text: string) => {
    const upperCode = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(upperCode);

    if (upperCode.length === 8) {
      setValidating(true);
      try {
        const info = await getInviteCodeInfo(upperCode);
        setCodeInfo({
          group_name: info.group_name,
          is_valid: info.is_valid,
        });
      } catch (error) {
        setCodeInfo(null);
      } finally {
        setValidating(false);
      }
    } else {
      setCodeInfo(null);
    }
  };

  const handleJoin = async () => {
    if (code.length !== 8) {
      Alert.alert('Error', 'El código debe tener 8 caracteres');
      return;
    }

    if (codeInfo && !codeInfo.is_valid) {
      Alert.alert('Error', 'El código de invitación no es válido o ha expirado');
      return;
    }

    try {
      const group = await joinGroupByCode(code);
      // Navegar directamente al mapa del grupo al que se unió
      navigation.replace('Map', { groupId: group.id });
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Error al unirse al grupo'
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
          <Text style={styles.title}>Unirse a un Grupo</Text>
          <Text style={styles.subtitle}>
            Ingresa el código de invitación de 8 caracteres
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Código de Invitación</Text>
          <TextInput
            style={[
              styles.input,
              code.length === 8 && codeInfo?.is_valid && styles.inputValid,
              code.length === 8 && codeInfo && !codeInfo.is_valid && styles.inputInvalid,
            ]}
            placeholder="ABCD1234"
            value={code}
            onChangeText={handleCodeChange}
            autoCapitalize="characters"
            maxLength={8}
            autoCorrect={false}
            keyboardType="default"
          />
          
          {validating && (
            <View style={styles.validatingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.validatingText}>Validando código...</Text>
            </View>
          )}

          {code.length === 8 && codeInfo && (
            <View
              style={[
                styles.codeInfo,
                codeInfo.is_valid ? styles.codeInfoValid : styles.codeInfoInvalid,
              ]}
            >
              {codeInfo.is_valid ? (
                <>
                  <Text style={styles.codeInfoText}>✓ Código válido</Text>
                  <Text style={styles.codeInfoGroup}>
                    Grupo: {codeInfo.group_name}
                  </Text>
                </>
              ) : (
                <Text style={styles.codeInfoText}>
                  ✗ Código inválido o expirado
                </Text>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (loading || code.length !== 8 || (codeInfo && !codeInfo.is_valid)) &&
              styles.buttonDisabled,
          ]}
          onPress={handleJoin}
          disabled={loading || code.length !== 8 || (codeInfo && !codeInfo.is_valid)}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Unirse al Grupo</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 ¿Cómo obtener un código?</Text>
          <Text style={styles.infoText}>
            Pide al creador del grupo que genere un código de invitación desde
            los detalles del grupo.
          </Text>
        </View>
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
    ...theme.typography.h2,
    letterSpacing: 4,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inputValid: {
    borderColor: theme.colors.success,
  },
  inputInvalid: {
    borderColor: theme.colors.error,
  },
  validatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  validatingText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  codeInfo: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  codeInfoValid: {
    backgroundColor: theme.colors.success + '20',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  codeInfoInvalid: {
    backgroundColor: theme.colors.error + '20',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  codeInfoText: {
    ...theme.typography.bodyBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  codeInfoGroup: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
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
  infoBox: {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  infoTitle: {
    ...theme.typography.bodyBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  infoText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

