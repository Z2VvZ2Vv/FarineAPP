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
import RationScreen from './rationScreen';

// Utilise 'screen' au lieu de 'window' pour les vraies dimensions
const { width, height } = Dimensions.get(Platform.OS === 'web' ? 'window' : 'screen');

interface ConfirmationScreenProps {
  recipe: Recipe;
  selectedWeight: number;
  onBack: () => void;
  onConfirm: (recipe: Recipe, totalWeight: number) => void;
  onHome: () => void;
}

export default function ConfirmationScreen({ 
  recipe, 
  selectedWeight,
  onBack, 
  onConfirm,
  onHome,
}: ConfirmationScreenProps): React.ReactElement {

  const [confirmation, setConfirmation] = useState<boolean>(false);

  const formatIngredients = (ingredients: Recipe['ingredients']): string => {
    return ingredients
      .map(ingredient => `${ingredient.name} (${ingredient.percentage}%)`)
      .join(', ');
  };

  const handleConfirm = () => {
    onConfirm(recipe, selectedWeight);
    setConfirmation(true);
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

  if (confirmation) {
    return (
      <RationScreen 
        recipe={recipe}
        totalWeight={selectedWeight}
        onHome={onHome}
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
          <Text style={getTextStyle(styles.subtitle, isWeb && styles.webSubtitle)}>Confirmer la ration</Text>
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

          {/* Right side - Confirmation */}
          <View style={getViewStyle(styles.confirmationSection, isWeb && styles.webConfirmationSection)}>
            {/* Question Icon */}
            <View style={getViewStyle(styles.questionIconContainer, isWeb && styles.webQuestionIconContainer)}>
              <Text style={getTextStyle(styles.questionIcon, isWeb && styles.webQuestionIcon)}>❓</Text>
            </View>

            {/* Poids sélectionné */}
            <View style={getViewStyle(styles.weightDisplay, isWeb && styles.webWeightDisplay)}>
              <Text style={getTextStyle(styles.weightLabel, isWeb && styles.webWeightLabel)}>
                Poids sélectionné:
              </Text>
              <Text style={getTextStyle(styles.weightValue, isWeb && styles.webWeightValue)}>
                {selectedWeight} kg
              </Text>
            </View>

            {/* Question de confirmation */}
            <Text style={getTextStyle(styles.confirmationText, isWeb && styles.webConfirmationText)}>
              Voulez-vous confirmer cette ration ?
            </Text>

            {/* Boutons */}
            <View style={getViewStyle(styles.buttonContainer, isWeb && styles.webButtonContainer)}>
              <TouchableOpacity
                style={getViewStyle(styles.secondaryButton, isWeb && styles.webSecondaryButton)}
                onPress={onBack}
                activeOpacity={0.8}
              >
                <Text style={getTextStyle(styles.buttonText, styles.secondaryButtonText, isWeb && styles.webButtonText)}>
                  Retour
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={getViewStyle(styles.primaryButton, isWeb && styles.webPrimaryButton)}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={getTextStyle(styles.buttonText, styles.primaryButtonText, isWeb && styles.webButtonText)}>
                  Confirmer
                </Text>
              </TouchableOpacity>
            </View>
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
    top: -7,
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
  
  // Section confirmation (droite)
  confirmationSection: {
    flex: 1,
    height: height * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  
  questionIconContainer: {
    backgroundColor: '#374151',
    padding: 20,
    borderRadius: 50,
    marginBottom: 5,
  } as ViewStyle,
  
  questionIcon: {
    fontSize: Math.min(40, height * 0.08),
    color: '#60A5FA',
  } as TextStyle,
  
  weightDisplay: {
    alignItems: 'center',
    marginBottom: 5,
  } as ViewStyle,
  
  weightLabel: {
    fontSize: Math.min(14, height * 0.03),
    color: '#9CA3AF',
    marginBottom: 12,
  } as TextStyle,
  
  weightValue: {
    fontSize: Math.min(36, height * 0.08),
    fontWeight: '700',
    color: '#60A5FA',
  } as TextStyle,
  
  confirmationText: {
    fontSize: Math.min(18, height * 0.04),
    color: '#D1D5DB',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  } as TextStyle,

  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  } as ViewStyle,
  
  secondaryButton: {
    backgroundColor: '#4B5563',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
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
  
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,
  
  buttonText: {
    fontSize: Math.min(18, height * 0.04),
    fontWeight: '600',
  } as TextStyle,
  
  secondaryButtonText: {
    color: '#E5E7EB',
  } as TextStyle,
  
  primaryButtonText: {
    color: '#FFFFFF',
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
    top: -4,
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
  
  webConfirmationSection: {
    minHeight: 400,
    maxWidth: 500,
  } as ViewStyle,
  
  webQuestionIconContainer: {
    padding: 28,
    borderRadius: 60,
    marginBottom: 40,
  } as ViewStyle,
  
  webQuestionIcon: {
    fontSize: 56,
  } as TextStyle,
  
  webWeightDisplay: {
    marginBottom: 32,
  } as ViewStyle,
  
  webWeightLabel: {
    fontSize: 16,
    marginBottom: 12,
  } as TextStyle,
  
  webWeightValue: {
    fontSize: 48,
  } as TextStyle,
  
  webConfirmationText: {
    fontSize: 20,
    marginBottom: 40,
    paddingHorizontal: 0,
  } as TextStyle,

  webButtonContainer: {
    gap: 20,
  } as ViewStyle,
  
  webSecondaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
  } as ViewStyle,
  
  webPrimaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
  } as ViewStyle,
  
  webButtonText: {
    fontSize: 20,
  } as TextStyle,
});