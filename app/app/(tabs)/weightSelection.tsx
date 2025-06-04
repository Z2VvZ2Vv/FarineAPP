import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Recipe } from '../../components/OtherComp';
import ConfirmationScreen from './confirmationScreen';

// Utilise 'screen' au lieu de 'window' pour les vraies dimensions
const { width, height } = Dimensions.get(Platform.OS === 'web' ? 'window' : 'screen');

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
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  // Options de poids disponibles
  const weightOptions = [200, 400, 600, 800];

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
      setShowConfirmation(true); 
    }
  };

  const handleConfirmationBack = (): void => {
    setShowConfirmation(false);
  };

  const handleConfirmationConfirm = (): void => {
    if (selectedWeight) {
      onContinue(selectedWeight);
    }
  };

  const handleHomePress = (): void => {
    setShowConfirmation(false);
    setSelectedWeight(null);
    onBack();
  };

  const isWeb = Platform.OS === 'web';

  // Fonction pour obtenir les styles de View de manière type-safe
  const getViewStyle = (...styles: (ViewStyle | false | undefined)[]): ViewStyle[] => {
    return styles.filter(Boolean) as ViewStyle[];
  };

  // Fonction pour obtenir les styles de Text de manière type-safe
  const getTextStyle = (...styles: (TextStyle | false | undefined)[]): TextStyle[] => {
    return styles.filter(Boolean) as TextStyle[];
  };

  if (showConfirmation && selectedWeight) {
    return (
      <ConfirmationScreen
        recipe={recipe}
        selectedWeight={selectedWeight}
        onBack={handleConfirmationBack}
        onConfirm={handleConfirmationConfirm}
        onHome={handleHomePress}
      />
    );
  }

  return (
    <View style={getViewStyle(styles.fullScreenContainer, isWeb && styles.webContainer)}>
      <StatusBar hidden={!isWeb} />
      
      {/* Bouton Retour en haut à gauche */}
      <TouchableOpacity
        style={getViewStyle(styles.backButton, isWeb && styles.webBackButton)}
        onPress={onBack}
        activeOpacity={0.8}
      >
        <Text style={getTextStyle(styles.backIcon, isWeb && styles.webBackIcon)}>←</Text>
      </TouchableOpacity>

      <View style={getViewStyle(styles.contentContainer, isWeb && styles.webContentContainer)}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={getTextStyle(styles.title, isWeb && styles.webTitle)}>🌾FarineAPP</Text>
          <Text style={getTextStyle(styles.subtitle, isWeb && styles.webSubtitle)}>Sélectionnez le poids</Text>
        </View>

        {/* Main Content */}
        <View style={getViewStyle(styles.main, isWeb && styles.webMain)}>
          {/* Left side - Recipe Info */}
          <View style={getViewStyle(styles.recipeInfoSection, isWeb && styles.webRecipeInfoSection)}>
            <View style={styles.recipeHeader}>
              <View style={getViewStyle(styles.iconContainer, isWeb && styles.webIconContainer)}>
                <Text style={getTextStyle(styles.recipeIcon, isWeb && styles.webRecipeIcon)}>
                  {recipe.emoji}
                </Text>
              </View>
              <View style={styles.recipeInfo}>
                <Text style={getTextStyle(styles.recipeName, isWeb && styles.webRecipeName)}>{recipe.name}</Text>
                <Text style={getTextStyle(styles.recipeDescription, isWeb && styles.webRecipeDescription)}>
                  {formatIngredients(recipe.ingredients)}
                </Text>
              </View>
            </View>
          </View>

          {/* Right side - Weight Selection */}
          <View style={getViewStyle(styles.weightSelectionSection, isWeb && styles.webWeightSelectionSection)}>
            <View style={getViewStyle(styles.weightGrid, isWeb && styles.webWeightGrid)}>
              {weightOptions.map((weight) => (
                <TouchableOpacity
                  key={weight}
                  style={getViewStyle(
                    styles.weightButton,
                    isWeb && styles.webWeightButton,
                    selectedWeight === weight && styles.selectedWeightButton,
                    selectedWeight === weight && isWeb && styles.webSelectedWeightButton
                  )}
                  onPress={() => handleWeightPress(weight)}
                  activeOpacity={0.8}
                >
                  <Text style={getTextStyle(
                    styles.weightButtonText,
                    isWeb && styles.webWeightButtonText,
                    selectedWeight === weight && styles.selectedWeightButtonText
                  )}>
                    {weight} kg
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={getViewStyle(
                styles.continueButton,
                isWeb && styles.webContinueButton,
                !selectedWeight && styles.continueButtonDisabled
              )}
              onPress={handleContinuePress}
              disabled={!selectedWeight}
              activeOpacity={0.8}
            >
              <Text style={getTextStyle(styles.continueButtonText, isWeb && styles.webContinueButtonText)}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // === STYLES MOBILES (par défaut) ===
  
  // Plein écran absolu
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    backgroundColor: '#0F172A',
  } as ViewStyle,
  
  // Bouton Retour en haut à gauche
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    backgroundColor: '#1E293B',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  } as ViewStyle,
  
  backIcon: {
    fontSize: 32,
    color: '#60A5FA',
    fontWeight: 'bold',
    top:-7,
  } as TextStyle,
  
  // Container pour tout le contenu
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  } as ViewStyle,
  
  header: {
    alignItems: 'center',
    marginBottom: height * 0.04,
  } as ViewStyle,
  
  title: {
    fontSize: Math.min(36, height * 0.08),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  } as TextStyle,
  
  subtitle: {
    fontSize: Math.min(18, height * 0.04),
    color: '#CBD5E1',
  } as TextStyle,
  
  main: {
    flexDirection: 'row',
    flex: 1,
    width: '100%',
    gap: 32,
    alignItems: 'center',
  } as ViewStyle,
  
  // Section info recette (gauche)
  recipeInfoSection: {
    flex: 1,
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    height: height * 0.5,
    justifyContent: 'center',
  } as ViewStyle,
  
  recipeHeader: {
    alignItems: 'center',
  } as ViewStyle,
  
  iconContainer: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 50,
    marginBottom: 20,
  } as ViewStyle,
  
  recipeIcon: {
    fontSize: Math.min(48, height * 0.1),
    color: '#FFFFFF',
  } as TextStyle,
  
  recipeInfo: {
    alignItems: 'center',
  } as ViewStyle,
  
  recipeName: {
    fontSize: Math.min(28, height * 0.06),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  } as TextStyle,
  
  recipeDescription: {
    fontSize: Math.min(16, height * 0.035),
    color: '#94A3B8',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  } as TextStyle,
  
  // Section sélection poids (droite)
  weightSelectionSection: {
    flex: 1,
    height: height * 0.5,
    justifyContent: 'center',
  } as ViewStyle,
  
  weightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
    justifyContent: 'center',
  } as ViewStyle,
  
  weightButton: {
    backgroundColor: '#374151',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: '40%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  } as ViewStyle,
  
  selectedWeightButton: {
    backgroundColor: '#2563EB',
    transform: [{ scale: 1.05 }],
  } as ViewStyle,
  
  weightButtonText: {
    color: '#FFFFFF',
    fontSize: Math.min(20, height * 0.045),
    fontWeight: '500',
  } as TextStyle,
  
  selectedWeightButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  } as TextStyle,
  
  continueButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,
  
  continueButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  } as ViewStyle,
  
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: Math.min(20, height * 0.045),
    fontWeight: '600',
  } as TextStyle,

  // === STYLES WEB ===
  
  webContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 600,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  
  webBackButton: {
    top: 30,
    left: 30,
  } as ViewStyle,
  
  webBackIcon: {
    fontSize: 28,
    top:-4,
    fontWeight: 'bold',
  } as TextStyle,
  
  webContentContainer: {
    paddingHorizontal: 60,
    paddingVertical: 40,
    maxWidth: 1400,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  
  webTitle: {
    fontSize: 48,
  } as TextStyle,
  
  webSubtitle: {
    fontSize: 20,
  } as TextStyle,
  
  webMain: {
    maxWidth: 1200,
    gap: 60,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  
  webRecipeInfoSection: {
    minHeight: 400,
    maxWidth: 500,
    padding: 40,
    borderRadius: 16,
  } as ViewStyle,
  
  webIconContainer: {
    padding: 24,
    borderRadius: 60,
    marginBottom: 24,
  } as ViewStyle,
  
  webRecipeIcon: {
    fontSize: 64,
  } as TextStyle,
  
  webRecipeName: {
    fontSize: 32,
    marginBottom: 16,
  } as TextStyle,
  
  webRecipeDescription: {
    fontSize: 18,
    lineHeight: 24,
  } as TextStyle,
  
  webWeightSelectionSection: {
    minHeight: 400,
    maxWidth: 500,
  } as ViewStyle,
  
  webWeightGrid: {
    gap: 20,
    marginBottom: 40,
  } as ViewStyle,
  
  webWeightButton: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    minWidth: 140,
  } as ViewStyle,
  
  webSelectedWeightButton: {
    // Pas de styles hover spécifiques pour React Native
  } as ViewStyle,
  
  webWeightButtonText: {
    fontSize: 22,
  } as TextStyle,
  
  webContinueButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
  } as ViewStyle,
  
  webContinueButtonText: {
    fontSize: 22,
  } as TextStyle,
});