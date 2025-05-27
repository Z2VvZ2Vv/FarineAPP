import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface Recipe {
  name: string;
  ingredients: {
    name: string;
    percentage: number;
  }[];
  created_at: string;
}

interface WeightSelectionProps {
  recipe: Recipe;
  onBack: () => void;
  onContinue: (selectedWeight: number) => void;
}

export default function WeightSelectionScreen({ 
  recipe, 
  onBack, 
  onContinue 
}: WeightSelectionProps): React.ReactElement {
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);

  // Options de poids disponibles
  const weightOptions = [200, 400, 600, 800];

  // Fonction pour obtenir une icône basée sur le nom de la recette
  const getRecipeIcon = (name: string): string => {
    const iconMap: { [key: string]: string } = {
      'Broutard': '🐄',
      'Génices': '🐂',
      'Vaches': '🐮'
    };
    return iconMap[name] || '🌾';
  };

  // Fonction pour formater la description des ingrédients
  const formatIngredients = (ingredients: Recipe['ingredients']): string => {
    return ingredients
      .map(ingredient => `${ingredient.name} (${ingredient.percentage}%)`)
      .join(', ');
  };

  const handleWeightPress = (weight: number): void => {
    setSelectedWeight(weight);
  };

  const handleContinuePress = (): void => {
    if (selectedWeight) {
      onContinue(selectedWeight);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>FarineAPP</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Main Content */}
        <View style={styles.main}>
          <View style={styles.recipeCard}>
            {/* Recipe Info */}
            <View style={styles.recipeHeader}>
              <View style={styles.iconContainer}>
                <Text style={styles.recipeIcon}>
                  {getRecipeIcon(recipe.name)}
                </Text>
              </View>
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeName}>{recipe.name}</Text>
                <Text style={styles.recipeDescription}>
                  {formatIngredients(recipe.ingredients)}
                </Text>
              </View>
            </View>

            {/* Weight Selection */}
            <View style={styles.weightGrid}>
              {weightOptions.map((weight) => (
                <TouchableOpacity
                  key={weight}
                  style={[
                    styles.weightButton,
                    selectedWeight === weight && styles.selectedWeightButton
                  ]}
                  onPress={() => handleWeightPress(weight)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.weightButtonText,
                    selectedWeight === weight && styles.selectedWeightButtonText
                  ]}>
                    {weight} kg
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                !selectedWeight && styles.continueButtonDisabled
              ]}
              onPress={handleContinuePress}
              disabled={!selectedWeight}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continuer</Text>
            </TouchableOpacity>
          </View>

          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backText}>Retour au choix des rations</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100%',
    alignSelf: 'center',
  },
  recipeCard: {
    backgroundColor: '#1E293B',
    padding: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    width: '100%',
    maxWidth: 600,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  iconContainer: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 50,
    marginRight: 16,
  },
  recipeIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  weightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
    justifyContent: 'space-between',
  },
  weightButton: {
    backgroundColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: '22%',
    alignItems: 'center',
  },
  selectedWeightButton: {
    backgroundColor: '#2563EB',
  },
  weightButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedWeightButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  continueButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backIcon: {
    fontSize: 18,
    color: '#60A5FA',
    marginRight: 8,
  },
  backText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '500',
  },
});