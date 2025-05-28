import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Recipe } from '../../components/Recipe';
import ManualPage from './manualPage';

// Utilise 'screen' au lieu de 'window' pour les vraies dimensions
const { width, height } = Dimensions.get(Platform.OS === 'web' ? 'window' : 'screen');

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
  const [currentScreen, setCurrentScreen] = useState<'home' | 'weight' | 'manual'>('home');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Fonction pour récupérer les recettes depuis l'API
  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/recipes`);
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

  const handleManualPress = (): void => {
    setCurrentScreen('manual');
  };

  const handleSettingsPress = async (): Promise<void> => {
    try {
      // temporairement, on ouvre une URL fixe
      const url = 'http://10.0.2.2:5173/';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log("L'URL n'est pas supportée : " + url);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de l\'URL:', error);
    }
  };

  const handleReloadPress = (): void => {
    fetchRecipes();
  };

  // Fonction pour obtenir une icône basée sur le nom de la recette
  const getRecipeIcon = (recipe: Recipe, index: number): string => {
    const iconMap: { [key: string]: string } = {
      'Broutard': '🐄',
      'Génices': '🐂',
      'Vaches': '🐮'
    };
    
    if (iconMap[recipe.name]) {
      recipe.emoji = iconMap[recipe.name];
      return iconMap[recipe.name];
    }
    
    // Icônes par défaut basées sur l'index
    const defaultIcons: string[] = ['☘️', '🌱', '🌿'];
    let result = defaultIcons[index % defaultIcons.length];

    recipe.emoji = result;
    return result;
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

  if (currentScreen === 'manual') {
    return (
      <ManualPage onBack={() => setCurrentScreen('home')} />
    );
  }

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
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden={true} />

        {/* Bouton Manuel en haut à gauche */}
        <TouchableOpacity
          style={styles.manualButton}
          onPress={handleManualPress}
          activeOpacity={0.8}
        >
          <Text style={styles.manualIcon}>📖</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.reloadButton}
          onPress={handleReloadPress}
          activeOpacity={0.8}
        >
          <Text style={styles.reloadIcon}>🔄</Text>
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <Text style={[styles.subtitle, { color: '#FFFFFF' }]}>
            Chargement des rations...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden={true} />
        
        {/* Bouton Manuel en haut à gauche */}
        <TouchableOpacity
          style={styles.manualButton}
          onPress={handleManualPress}
          activeOpacity={0.8}
        >
          <Text style={styles.manualIcon}>📖</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.reloadButton}
          onPress={handleReloadPress}
          activeOpacity={0.8}
        >
          <Text style={styles.reloadIcon}>🔄</Text>
        </TouchableOpacity>
        <View style={styles.contentContainer}>
          <Text style={[styles.subtitle, { color: '#F87171' }]}>
            Erreur: {error}
          </Text>
        </View>
      </View>
    );
  }

  const MainContent = () => (
    <View style={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>🌾FarineAPP</Text>
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
                  {getRecipeIcon(recipe, index)}
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
    </View>
  );

  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar hidden={true} />
      
      {/* Bouton Manuel en haut à gauche */}
      <TouchableOpacity
        style={styles.manualButton}
        onPress={handleManualPress}
        activeOpacity={0.8}
      >
        <Text style={styles.manualIcon}>📖</Text>
      </TouchableOpacity>

      {/* Bouton Recharger en haut à droite */}
      <TouchableOpacity
        style={styles.reloadButton}
        onPress={handleReloadPress}
        activeOpacity={0.8}
      >
        <Text style={styles.reloadIcon}>🔄</Text>
      </TouchableOpacity>

      {/* Sur web, on utilise ScrollView si plus de 3 recettes, sinon View normal */}
      {Platform.OS === 'web' && recipes.length > 3 ? (
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <MainContent />
        </ScrollView>
      ) : (
        <MainContent />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Nouveau style pour le plein écran absolu
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: Platform.OS === 'web' ? '100vw' as any : width,
    height: Platform.OS === 'web' ? '100vh' as any : height,
    backgroundColor: '#0F172A',
    ...(Platform.OS === 'web' && {
      minHeight: '100vh' as any,
      overflow: 'hidden' as any,
    }),
  } as any,
  // Nouveau style pour le ScrollView sur web
  scrollContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      overflowY: 'auto' as any,
      overflowX: 'hidden' as any,
    }),
  } as any,
  scrollContent: {
    flexGrow: 1,
    ...(Platform.OS === 'web' && {
      minHeight: '100vh' as any,
    }),
  } as any,
  // Bouton Manuel en haut à gauche
  manualButton: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 30 : 20,
    left: Platform.OS === 'web' ? 30 : 20,
    zIndex: 10,
    backgroundColor: '#1E293B',
    borderRadius: 25,
    width: Platform.OS === 'web' ? 60 : 50,
    height: Platform.OS === 'web' ? 60 : 50,
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
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease' as any,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' as any,
    }),
  } as any,
  manualIcon: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    ...(Platform.OS === 'web' && {
      userSelect: 'none' as any,
      top: -2,
    }),
  } as any,
  // Bouton Recharger en haut à droite
  reloadButton: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 30 : 20,
    right: Platform.OS === 'web' ? 30 : 20,
    zIndex: 10,
    backgroundColor: '#1E293B',
    borderRadius: 25,
    width: Platform.OS === 'web' ? 60 : 50,
    height: Platform.OS === 'web' ? 60 : 50,
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
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease' as any,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' as any,
    }),
  } as any,
  reloadIcon: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    ...(Platform.OS === 'web' && {
      userSelect: 'none' as any,
    }),
  } as any,
  // Container pour tout le contenu (sans scroll)
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 64 : 32,
    paddingVertical: Platform.OS === 'web' ? 32 : 16,
    ...(Platform.OS === 'web' && {
      maxWidth: 1200,
      alignSelf: 'center' as any,
      width: '100%',
    }),
  } as any,
  header: {
    alignItems: 'center',
    marginBottom: Platform.OS === 'web' ? 60 : height * 0.03,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 48 : Math.min(36, height * 0.08),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: Platform.OS === 'web' ? 16 : 8,
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      textAlign: 'center' as any,
      userSelect: 'none' as any,
    }),
  } as any,
  subtitle: {
    fontSize: Platform.OS === 'web' ? 24 : Math.min(18, height * 0.04),
    color: '#CBD5E1',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      textAlign: 'center' as any,
      userSelect: 'none' as any,
    }),
  } as any,
  main: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    flex: 1,
    gap: Platform.OS === 'web' ? 32 : 16,
    marginBottom: Platform.OS === 'web' ? 40 : height * 0.02,
    ...(Platform.OS === 'web' && {
      maxWidth: 1000,
      flexWrap: 'wrap' as any,
      justifyContent: 'center' as any,
    }),
  } as any,
  rationCard: {
    backgroundColor: '#1E293B',
    padding: Platform.OS === 'web' ? 32 : 20,
    borderRadius: Platform.OS === 'web' ? 20 : 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    flex: Platform.OS === 'web' ? 0 : 1,
    height: Platform.OS === 'web' ? 400 : height * 0.5,
    justifyContent: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.3s ease' as any,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' as any,
      minWidth: 280,
      maxWidth: 320,
      width: 300,
    }),
  } as any,
  iconContainer: {
    marginBottom: Platform.OS === 'web' ? 20 : 12,
  },
  icon: {
    fontSize: Platform.OS === 'web' ? 64 : Math.min(48, height * 0.1),
    ...(Platform.OS === 'web' && {
      userSelect: 'none' as any,
      filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))' as any,
    }),
  } as any,
  rationTitle: {
    fontSize: Platform.OS === 'web' ? 32 : Math.min(28, height * 0.06),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: Platform.OS === 'web' ? 20 : 12,
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      userSelect: 'none' as any,
    }),
  } as any,
  rationDescription: {
    fontSize: Platform.OS === 'web' ? 18 : Math.min(16, height * 0.035),
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 26 : 20,
    paddingHorizontal: Platform.OS === 'web' ? 16 : 8,
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      userSelect: 'none' as any,
    }),
  } as any,
  footer: {
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      marginTop: 20,
    }),
  } as any,
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 12 : 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      borderRadius: 8,
      transition: 'all 0.2s ease' as any,
    }),
  } as any,
  settingsIcon: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    marginRight: Platform.OS === 'web' ? 12 : 8,
    ...(Platform.OS === 'web' && {
      userSelect: 'none' as any,
    }),
  } as any,
  settingsText: {
    color: '#60A5FA',
    fontSize: Platform.OS === 'web' ? 18 : 14,
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      userSelect: 'none' as any,
    }),
  } as any,
});