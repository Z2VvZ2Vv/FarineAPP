import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
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

// Import du composant WeightSelectionScreen
import WeightSelectionScreen from './weightSelection';

export default function MainApp(): React.ReactElement {
  const apiUrl = Platform.select({
    android: 'http://10.0.2.2:8000',
    default: 'http://localhost:8000', // Pour le web et d'autres plateformes
  });

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'weight'>('home');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Fonction pour récupérer les recettes depuis l'API
  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/recipes/`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des recettes');
      }
      const data = await response.json();
      setRecipes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const handleRationPress = (recipe: Recipe): void => {
    setSelectedRecipe(recipe);
    setCurrentScreen('weight');
  };

  const handleBackToHome = (): void => {
    setCurrentScreen('home');
    setSelectedRecipe(null);
  };

  const handleWeightContinue = (selectedWeight: number): void => {
    console.log(`Poids sélectionné: ${selectedWeight}kg pour la recette: ${selectedRecipe?.name}`);
    // Ici vous pouvez naviguer vers la prochaine étape
  };

  const handleSettingsPress = (): void => {
    console.log('Gérer les rations');
  };

  // Fonction pour obtenir une icône basée sur le nom de la recette
  const getRecipeIcon = (name: string, index: number): string => {
    const iconMap: { [key: string]: string } = {
      'Broutard': '🐄',
      'Génices': '🐂',
      'Vaches': '🐮'
    };
    
    if (iconMap[name]) {
      return iconMap[name];
    }
    
    // Icônes par défaut basées sur l'index
    const defaultIcons: string[] = ['🌾', '🌱', '🌿'];
    return defaultIcons[index % defaultIcons.length];
  };

  // Fonction pour obtenir une couleur basée sur l'index
  const getRecipeColor = (index: number): string => {
    const colors: string[] = ['#60A5FA', '#4ADE80', '#FBBF24'];
    return colors[index % colors.length];
  };

  // Fonction pour formater la description des ingrédients
  const formatIngredients = (ingredients: Recipe['ingredients']): string => {
    return ingredients
      .map(ingredient => `${ingredient.name} (${ingredient.percentage}%)`)
      .join('\n');
  };

  // Si on est sur l'écran de sélection du poids
  if (currentScreen === 'weight' && selectedRecipe) {
    return (
      <WeightSelectionScreen
        recipe={selectedRecipe}
        onBack={handleBackToHome}
        onContinue={handleWeightContinue}
      />
    );
  }

  // Écran d'accueil (code existant)
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContainer}>
          <Text style={[styles.subtitle, { color: '#FFFFFF' }]}>
            Chargement des rations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContainer}>
          <Text style={[styles.subtitle, { color: '#F87171' }]}>
            Erreur: {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>FarineAPP</Text>
          <Text style={styles.subtitle}>Choisissez la ration</Text>
        </View>

        <View style={styles.main}>
          {recipes.length > 0 ? (
            recipes.map((recipe, index) => (
              <TouchableOpacity
                key={recipe.name}
                style={styles.rationCard}
                onPress={() => handleRationPress(recipe)}
                activeOpacity={0.8}
              >
                <View style={styles.iconContainer}>
                  <Text style={[styles.icon, { color: getRecipeColor(index) }]}>
                    {getRecipeIcon(recipe.name, index)}
                  </Text>
                </View>
                <Text style={styles.rationTitle}>{recipe.name}</Text>
                <Text style={styles.rationDescription}>
                  {formatIngredients(recipe.ingredients)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.subtitle, { color: '#94A3B8' }]}>
              Aucune recette disponible
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettingsPress}
            activeOpacity={0.8}
          >
            <Text style={[styles.settingsIcon, { color: '#60A5FA' }]}>⚙️</Text>
            <Text style={styles.settingsText}>Gérer les rations</Text>
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
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#CBD5E1',
  },
  main: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    maxWidth: width - 64,
    marginBottom: 24,
    gap: 16,
  },
  rationCard: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    flex: 1,
    minHeight: height * 0.6,
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  rationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  rationDescription: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  settingsIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  settingsText: {
    color: '#60A5FA',
    fontSize: 14,
  },
});