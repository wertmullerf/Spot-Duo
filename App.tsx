import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthScreen } from './src/screens/AuthScreen';
import { MapScreen } from './src/screens/MapScreen';
import { PlaceDetailScreen } from './src/screens/PlaceDetailScreen';
import { AddReviewScreen } from './src/screens/AddReviewScreen';
import { PlacesListScreen } from './src/screens/PlacesListScreen';
import { GroupsListScreen } from './src/screens/GroupsListScreen';
import { CreateGroupScreen } from './src/screens/CreateGroupScreen';
import { JoinGroupScreen } from './src/screens/JoinGroupScreen';
import { GroupDetailScreen } from './src/screens/GroupDetailScreen';
import { useAuth } from './src/hooks/useAuth';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { RootStackParamList } from './src/types/navigation';

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2C3E50',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600',
          },
          animationEnabled: true,
          animationTypeForReplace: 'pop',
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
          },
          cardStyleInterpolator: ({ current, next, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="GroupsList"
              component={GroupsListScreen}
              options={{ title: 'Mis Listas', headerShown: false }}
            />
            <Stack.Screen
              name="Map"
              component={MapScreen}
              options={{ title: 'Mapa', headerShown: false }}
            />
            <Stack.Screen
              name="PlaceDetail"
              component={PlaceDetailScreen}
              options={{ title: 'Detalles del Lugar' }}
            />
            <Stack.Screen
              name="AddReview"
              component={AddReviewScreen}
              options={{ title: 'Agregar Review' }}
            />
            <Stack.Screen
              name="PlacesList"
              component={PlacesListScreen}
              options={{ title: 'Mis Lugares', }}
            />
            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ title: 'Crear Grupo' }}
            />
            <Stack.Screen
              name="JoinGroup"
              component={JoinGroupScreen}
              options={{ title: 'Unirse a Grupo' }}
            />
            <Stack.Screen
              name="GroupDetail"
              component={GroupDetailScreen}
              options={{ title: 'Detalles del Grupo' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

