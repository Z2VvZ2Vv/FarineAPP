import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Recipe, apiUrl } from '../../components/OtherComp';
import CompletionScreen from './completionScreen';

// Types pour les API responses
interface WeightResponse {
  value: number;
  unit: string;
}

interface MixStatusResponse {
  inProgress: boolean;
  totalWeight: number;
  recipeID: string;
}

interface StepInfo {
  ingredient: string;
  percentage: number;
  targetWeight: number;
  stepNumber: number;
  totalSteps: number;
  emoji: string;
}

interface WeighingScreenProps {
  recipe: Recipe;
  totalWeight: number;
  onHome: () => void;
}

export default function RationScreen({ 
  recipe, 
  totalWeight,
  onHome
}: WeighingScreenProps): React.ReactElement {

  const [currentWeight, setCurrentWeight] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [lastWeightUpdate, setLastWeightUpdate] = useState(Date.now());
  const [mixStatus, setMixStatus] = useState<MixStatusResponse | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  // Ordre fixe des étapes : Blé/Maïs, Luzerne, Lin
  const generateSteps = (): StepInfo[] => {
    const stepOrder = ['Mais/Blé', 'Luzerne', 'Lin'];
    const orderedIngredients: StepInfo[] = [];
    
    stepOrder.forEach((stepName, index) => {
      const ingredient = recipe.ingredients.find(ing => 
        ing.name.toLowerCase().includes(stepName.toLowerCase()) ||
        stepName.toLowerCase().includes(ing.name.toLowerCase())
      );
      
      if (ingredient) {
        orderedIngredients.push({
          ingredient: ingredient.name,
          percentage: ingredient.percentage,
          targetWeight: (totalWeight * ingredient.percentage) / 100,
          stepNumber: index + 1,
          totalSteps: 3,
          emoji: getIngredientEmoji(ingredient.name)
        });
      }
    });
    
    return orderedIngredients;
  };

  const getIngredientEmoji = (ingredientName: string): string => {
    const name = ingredientName.toLowerCase();
    if (name.includes('maïs') || name.includes('mais') || name.includes('blé')) return '🌽';
    if (name.includes('luzerne')) return '🌿';
    if (name.includes('lin')) return '🌾';
    return '🌱';
  };

  const steps = generateSteps();
  const currentStep = steps[currentStepIndex];
  const previousStepsWeight = steps.slice(0, currentStepIndex).reduce((sum, step) => sum + step.targetWeight, 0);
  const currentStepProgress = Math.min(Math.max((currentWeight - previousStepsWeight) / currentStep.targetWeight * 100, 0), 100);
  const overallProgress = Math.min((currentWeight / totalWeight) * 100, 100);

 // Fonction pour faire les appels API
const apiCall = async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
  try {
    const response = await fetch(`${apiUrl}/api${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    setIsConnected(true);
    return await response.json();
  } catch (err) {
    console.error(`API call failed for ${endpoint}:`, err);
    setIsConnected(false);
    
    // Alerte uniquement pour les erreurs critiques (pas pour le poids et statut en temps réel)
    if (endpoint !== '/weight' && endpoint !== '/mix/status') {
      if (Platform.OS === 'web') {
        alert(`Erreur de connexion API: ${endpoint}\n${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      } else {
        Alert.alert(
          'Erreur de connexion',
          `Impossible de se connecter à l'API pour ${endpoint}.\n\n${err instanceof Error ? err.message : 'Erreur inconnue'}`,
          [{ text: 'OK' }]
        );
      }
    }
    
    return null;
  }
};

// Récupération du poids en temps réel
useEffect(() => {
  if (showCompletion) return; // Arrêter les appels si le mélange est terminé

  // Variable locale pour éviter les appels multiples dans la même session d'effet
  let completionInProgress = false;

  const fetchWeight = async () => {
    try {
      const weightData: WeightResponse | null = await apiCall('/weight');
      if (weightData) {
        setCurrentWeight(weightData.value);
        setLastWeightUpdate(Date.now());
        setIsConnected(true);
        
        // Vérifier si le poids cible est atteint
        if (weightData.value >= totalWeight && !showCompletion && !completionInProgress) {
          console.log('Poids cible atteint, arrêt du mélange...');
          
          // Marquer immédiatement que la completion est en cours
          completionInProgress = true;
          
          // Afficher l'écran de completion après un délai
          setTimeout(() => {
            setShowCompletion(true);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du poids:', error);
    }
  };

  if (!showCompletion) {
    fetchWeight();
    const interval = setInterval(fetchWeight, 1000);
    return () => clearInterval(interval);
  }
}, [totalWeight, showCompletion]);

// Récupération du statut du mélange en temps réel
useEffect(() => {
  if (showCompletion) return; // Arrêter les appels si le mélange est terminé

  const fetchMixStatus = async () => {
    try {
      const statusData: MixStatusResponse | null = await apiCall('/mix/status');
      if (statusData) {
        setMixStatus(statusData);
        
        // Si le mélange n'est plus en cours et qu'on était initialisé, retourner à l'accueil
        // MAIS seulement si on n'est pas en mode completion
        if (hasInitialized && !statusData.inProgress && !showCompletion) {
          console.log('Mélange terminé par le serveur, retour à l\'accueil');
          onHome();
          return;
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du statut:', error);
    }
  };

  if (!showCompletion) {
    fetchMixStatus();
    const interval = setInterval(fetchMixStatus, 2000);
    return () => clearInterval(interval);
  }
}, [hasInitialized, onHome, showCompletion]);

// Vérification de la connexion (alerte si pas de mise à jour de poids depuis 10 secondes)
useEffect(() => {
  if (showCompletion) return; // Arrêter la vérification si le mélange est terminé

  const checkConnection = () => {
    const now = Date.now();
    if (now - lastWeightUpdate > 10000) { // 10 secondes
      console.log('Perte de connexion détectée - pas de mise à jour de poids depuis 10 secondes');
      setIsConnected(false);
    }
  };

  if (!showCompletion) {
    const connectionInterval = setInterval(checkConnection, 5000);
    return () => clearInterval(connectionInterval);
  }
}, [lastWeightUpdate, showCompletion]);

// Alerte de perte de connexion (uniquement si pas en mode completion)
useEffect(() => {
  if (!isConnected && !showCompletion) {
    console.log('Affichage de l\'alerte de perte de connexion');
    
    if (Platform.OS === 'web') {
      alert('⚠️ Connexion perdue avec la balance!\nVérifiez votre connexion réseau.');
    } else {
      Alert.alert(
        '⚠️ Connexion perdue',
        'La connexion avec la balance a été perdue.\n\nVérifiez votre connexion réseau et redémarrez l\'application si nécessaire.',
        [{ text: 'OK' }]
      );
    }
  }
}, [isConnected, showCompletion]);

// Nettoyage lors du démontage du composant
useEffect(() => {
  return () => {
    // Arrêter le mélange si le composant est démonté et que le mélange est encore en cours
    if (!showCompletion) {
      console.log('Démontage du composant, arrêt du mélange...');
      apiCall('/mix/stop', 'POST').catch(error => 
        console.error('Erreur lors de l\'arrêt du mélange au démontage:', error)
      );
    }
  };
}, [showCompletion]);

  // Passage automatique à l'étape suivante basé sur le poids
  useEffect(() => {
    if (currentWeight >= previousStepsWeight + currentStep.targetWeight && currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentWeight, previousStepsWeight, currentStep?.targetWeight, currentStepIndex]);

  // Initialisation intelligente du mix
  useEffect(() => {
    const initializeMix = async () => {
      if (hasInitialized) return;

      // Attendre d'avoir le statut du mélange
      if (!mixStatus) return;

      // Si un mélange est déjà en cours
      if (mixStatus.inProgress) {
        console.log('Mélange déjà en cours, pas de nouveau démarrage');
        setIsPaused(false);
        setHasInitialized(true);
        return;
      }

      // Si aucun mélange en cours, démarrer un nouveau
      console.log('Démarrage d\'un nouveau mélange');
      const rationData = {
        recipe: recipe,
        totalWeight: totalWeight
      };
      
      const result = await apiCall('/mix/start', 'POST', rationData);
      if (result !== null) {
        setIsPaused(false);
        console.log('Nouveau mélange démarré avec succès');
      }
      
      setHasInitialized(true);
    };

    initializeMix();
  }, [mixStatus, hasInitialized, recipe, totalWeight]);

  const handlePauseResume = async () => {
    if (isPaused) {
      const result = await apiCall('/mix/start', 'POST');
      if (result !== null) setIsPaused(false);
    } else {
      const result = await apiCall('/mix/stop', 'POST');
      if (result !== null) setIsPaused(true);
    }
  };

  const handleStop = async () => {
    const result = await apiCall('/mix/stop', 'POST');
    if (result !== null) {
      setIsPaused(false);
    }
    // Toujours retourner à la home, même si l'API échoue
    onHome();
  };

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const isWeb = Platform.OS === 'web';

  if (showCompletion) {
    return (
      <CompletionScreen 
        recipe={recipe} 
        totalWeight={totalWeight}
        onHome={onHome} 
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={isWeb ? styles.appTitleWeb : styles.appTitle}>🌾 FarineAPP</Text>
          {!isConnected && (
            <Text style={isWeb ? styles.connectionWarningWeb : styles.connectionWarning}>
              ⚠️ Connexion perdue
            </Text>
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.controlBtn, 
              isPaused ? styles.playBtn : styles.pauseBtn,
              isWeb && styles.controlBtnWeb
            ]}
            onPress={handlePauseResume}
          >
            <Text style={isWeb ? styles.controlTextWeb : styles.controlText}>
              {isPaused ? '▶️' : '⏸️'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlBtn, styles.stopBtn, isWeb && styles.controlBtnWeb]} 
            onPress={handleStop}
          >
            <Text style={isWeb ? styles.controlTextWeb : styles.controlText}>🛑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenu principal */}
      <View style={styles.mainContent}>
        
        {/* Étape actuelle */}
        <View style={isWeb ? styles.stepCardWeb : styles.stepCard}>
          <View style={styles.stepHeader}>
            <TouchableOpacity 
              style={[
                styles.navBtn, 
                currentStepIndex === 0 && styles.navBtnDisabled,
                isWeb && styles.navBtnWeb
              ]}
              onPress={handlePrevStep}
              disabled={currentStepIndex === 0}
            >
              <Text style={isWeb ? styles.navIconWeb : styles.navIcon}>◀</Text>
            </TouchableOpacity>

            <View style={styles.stepCenter}>
              <Text style={isWeb ? styles.stepNumberWeb : styles.stepNumber}>
                ÉTAPE {currentStep.stepNumber}/3
              </Text>
              <View style={styles.stepIngredient}>
                <Text style={isWeb ? styles.stepEmojiWeb : styles.stepEmoji}>
                  {currentStep.emoji}
                </Text>
                <Text style={isWeb ? styles.stepNameWeb : styles.stepName}>
                  {currentStep.ingredient}
                </Text>
              </View>
              <Text style={isWeb ? styles.stepTargetWeb : styles.stepTarget}>
                {currentStep.targetWeight.toFixed(1)} kg ({currentStep.percentage}%)
              </Text>
            </View>

            <TouchableOpacity 
              style={[
                styles.navBtn, 
                currentStepIndex === steps.length - 1 && styles.navBtnDisabled,
                isWeb && styles.navBtnWeb
              ]}
              onPress={handleNextStep}
              disabled={currentStepIndex === steps.length - 1}
            >
              <Text style={isWeb ? styles.navIconWeb : styles.navIcon}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Barre de progression étape */}
          <View style={styles.progressContainer}>
            <Text style={isWeb ? styles.progressTextWeb : styles.progressText}>
              {Math.round(currentStepProgress)}% de cette étape
            </Text>
            <View style={isWeb ? styles.progressBarWeb : styles.progressBar}>
              <View style={[styles.progressFill, { width: `${currentStepProgress}%` }]} />
            </View>
          </View>
        </View>

        {/* Section poids et progression */}
        <View style={isWeb ? styles.bottomSectionWeb : styles.bottomSection}>
          
          {/* Poids */}
          <View style={isWeb ? styles.weightCardWeb : styles.weightCard}>
            <View style={isWeb ? styles.weightCircleWeb : styles.weightCircle}>
              <Text style={isWeb ? styles.weightValueWeb : styles.weightValue}>
                {currentWeight.toFixed(1)}
              </Text>
              <Text style={isWeb ? styles.weightUnitWeb : styles.weightUnit}>kg</Text>
            </View>
          </View>

          {/* Progression globale */}
          <View style={isWeb ? styles.progressCardWeb : styles.progressCard}>
            <Text style={isWeb ? styles.progressTitleWeb : styles.progressTitle}>
              PROGRESSION TOTALE
            </Text>
            <Text style={isWeb ? styles.progressValueWeb : styles.progressValue}>
              {Math.round(overallProgress)}%
            </Text>
            <Text style={isWeb ? styles.progressDetailWeb : styles.progressDetail}>
              {currentWeight.toFixed(1)} / {totalWeight} kg
            </Text>
            <View style={isWeb ? styles.globalProgressBarWeb : styles.globalProgressBar}>
              <View style={[styles.globalProgressFill, { width: `${overallProgress}%` }]} />
            </View>
            <Text style={isWeb ? styles.remainingWeb : styles.remaining}>
              Restant: {Math.max(totalWeight - currentWeight, 0).toFixed(1)} kg
            </Text>
          </View>

          {/* Prochaines étapes */}
          <View style={isWeb ? styles.nextStepsCardWeb : styles.nextStepsCard}>
            <Text style={isWeb ? styles.nextTitleWeb : styles.nextTitle}>
              PROCHAINES ÉTAPES
            </Text>
            {steps.slice(currentStepIndex + 1, currentStepIndex + 3).map((step, index) => (
              <View key={step.stepNumber} style={isWeb ? styles.nextStepWeb : styles.nextStep}>
                <Text style={isWeb ? styles.nextEmojiWeb : styles.nextEmoji}>
                  {step.emoji}
                </Text>
                <Text style={isWeb ? styles.nextNameWeb : styles.nextName}>
                  {step.ingredient}
                </Text>
                <Text style={isWeb ? styles.nextWeightWeb : styles.nextWeight}>
                  {step.targetWeight.toFixed(1)}kg
                </Text>
              </View>
            ))}
            {steps.slice(currentStepIndex + 1).length === 0 && (
              <Text style={isWeb ? styles.finalStepWeb : styles.finalStep}>
                ✅ Dernière étape
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      width: '100vw',
    }),
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  } as ViewStyle,

  homeButton: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  homeIcon: {
    fontSize: 20,
  } as TextStyle,

  homeIconWeb: {
    fontSize: 24,
    color: '#FFFFFF',
  } as TextStyle,

  titleContainer: {
    flex: 1,
    alignItems: 'center',
  } as ViewStyle,

  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  } as TextStyle,

  appTitleWeb: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  } as TextStyle,

  connectionWarning: {
    fontSize: 10,
    color: '#F59E0B',
    textAlign: 'center',
    fontWeight: 'bold',
  } as TextStyle,

  connectionWarningWeb: {
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
    fontWeight: 'bold',
  } as TextStyle,

  controls: {
    flexDirection: 'row',
    gap: 8,
  } as ViewStyle,

  controlBtn: {
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  controlBtnWeb: {
    width: 56,
    height: 56,
    borderRadius: 28,
  } as ViewStyle,

  playBtn: {
    backgroundColor: '#059669',
  } as ViewStyle,

  pauseBtn: {
    backgroundColor: '#F59E0B',
  } as ViewStyle,

  stopBtn: {
    backgroundColor: '#DC2626',
  } as ViewStyle,

  controlText: {
    fontSize: 18,
  } as TextStyle,

  controlTextWeb: {
    fontSize: 22,
  } as TextStyle,

  mainContent: {
    flex: 1,
    padding: 12,
    gap: 12,
  } as ViewStyle,

  stepCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  } as ViewStyle,

  stepCardWeb: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
  } as ViewStyle,

  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  } as ViewStyle,

  navBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  navBtnWeb: {
    width: 40,
    height: 40,
    borderRadius: 20,
  } as ViewStyle,

  navBtnDisabled: {
    opacity: 0.3,
  } as ViewStyle,

  navIcon: {
    fontSize: 16,
    color: '#60A5FA',
    fontWeight: 'bold',
  } as TextStyle,

  navIconWeb: {
    fontSize: 18,
  } as TextStyle,

  stepCenter: {
    flex: 1,
    alignItems: 'center',
  } as ViewStyle,

  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#60A5FA',
    marginBottom: 6,
  } as TextStyle,

  stepNumberWeb: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#60A5FA',
    marginBottom: 12,
  } as TextStyle,

  stepIngredient: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  } as ViewStyle,

  stepEmoji: {
    fontSize: 28,
    marginRight: 8,
  } as TextStyle,

  stepEmojiWeb: {
    fontSize: 32,
    marginRight: 12,
  } as TextStyle,

  stepName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,

  stepNameWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,

  stepTarget: {
    fontSize: 14,
    color: '#94A3B8',
  } as TextStyle,

  stepTargetWeb: {
    fontSize: 16,
    color: '#94A3B8',
  } as TextStyle,

  progressContainer: {
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,

  progressText: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '600',
  } as TextStyle,

  progressTextWeb: {
    fontSize: 16,
    color: '#CBD5E1',
    fontWeight: '600',
  } as TextStyle,

  progressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    width: '100%',
  } as ViewStyle,

  progressBarWeb: {
    height: 12,
    backgroundColor: '#334155',
    borderRadius: 6,
    width: '100%',
  } as ViewStyle,

  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  } as ViewStyle,

  bottomSection: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  } as ViewStyle,

  bottomSectionWeb: {
    flexDirection: 'row',
    gap: 20,
    flex: 1,
  } as ViewStyle,

  weightCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  weightCardWeb: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  weightCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#60A5FA',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  weightCircleWeb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#60A5FA',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  weightValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#60A5FA',
  } as TextStyle,

  weightValueWeb: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#60A5FA',
  } as TextStyle,

  weightUnit: {
    fontSize: 14,
    color: '#64748B',
  } as TextStyle,

  weightUnitWeb: {
    fontSize: 16,
    color: '#64748B',
  } as TextStyle,

  progressCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  } as ViewStyle,

  progressCardWeb: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,

  progressTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#CBD5E1',
  } as TextStyle,

  progressTitleWeb: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#CBD5E1',
  } as TextStyle,

  progressValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  } as TextStyle,

  progressValueWeb: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10B981',
  } as TextStyle,

  progressDetail: {
    fontSize: 14,
    color: '#FFFFFF',
  } as TextStyle,

  progressDetailWeb: {
    fontSize: 16,
    color: '#FFFFFF',
  } as TextStyle,

  globalProgressBar: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    width: '100%',
  } as ViewStyle,

  globalProgressBarWeb: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    width: '100%',
  } as ViewStyle,

  globalProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  } as ViewStyle,

  remaining: {
    fontSize: 12,
    color: '#94A3B8',
  } as TextStyle,

  remainingWeb: {
    fontSize: 14,
    color: '#94A3B8',
  } as TextStyle,

  nextStepsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    flex: 1,
  } as ViewStyle,

  nextStepsCardWeb: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flex: 1,
  } as ViewStyle,

  nextTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 8,
  } as TextStyle,

  nextTitleWeb: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 16,
  } as TextStyle,

  nextStep: {
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  } as ViewStyle,

  nextStepWeb: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  } as ViewStyle,

  nextEmoji: {
    fontSize: 16,
    marginRight: 6,
  } as TextStyle,

  nextEmojiWeb: {
    fontSize: 18,
    marginRight: 8,
  } as TextStyle,

  nextName: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
  } as TextStyle,

  nextNameWeb: {
    fontSize: 14,
    color: '#CBD5E1',
    flex: 1,
  } as TextStyle,

  nextWeight: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: 'bold',
  } as TextStyle,

  nextWeightWeb: {
    fontSize: 14,
    color: '#60A5FA',
    fontWeight: 'bold',
  } as TextStyle,

  finalStep: {
    fontSize: 14,
    color: '#10B981',
    textAlign: 'center',
    fontStyle: 'italic',
  } as TextStyle,

  finalStepWeb: {
    fontSize: 16,
    color: '#10B981',
    textAlign: 'center',
    fontStyle: 'italic',
  } as TextStyle,
});