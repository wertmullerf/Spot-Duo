import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/utils/theme';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({ 
  rating, 
  onRatingChange, 
  size = 20,
  readonly = false 
}: StarRatingProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: 5 }, (_, i) => {
        const isFilled = i < rating;
        const iconName = isFilled ? 'star' : 'star-outline';
        
        if (readonly || !onRatingChange) {
          return (
            <Ionicons
              key={i}
              name={iconName}
              size={size}
              color={isFilled ? '#F39C12' : '#BDC3C7'}
            />
          );
        }
        
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onRatingChange(i + 1)}
            style={styles.starButton}
          >
            <Ionicons
              name={iconName}
              size={size}
              color={isFilled ? '#F39C12' : '#BDC3C7'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: theme.spacing.xs,
  },
});

