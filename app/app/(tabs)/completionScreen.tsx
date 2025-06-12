import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ViewStyle,
  TextStyle,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Recipe } from '../../components/OtherComp';

interface CompletionScreenProps {
  recipe: Recipe;
  totalWeight: number;
  onHome: () => void;
}

export default function CompletionScreen({ 
  recipe, 
  totalWeight,
  onHome
}: CompletionScreenProps): React.ReactElement {

  const isWeb = Platform.OS === 'web';
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  
  // Mobile toujours en paysage (locked), Web détecte l'orientation
  const isLandscape = isWeb ? screenWidth > screenHeight : true;

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Layout principal - Toujours horizontal pour mobile paysage */}
      <View style={[
        styles.mainLayout,
        isWeb && !isLandscape && styles.webPortraitLayout
      ]}>
        
        {/* Section gauche - Branding et succès */}
        <View style={[
          styles.leftSection,
          isWeb && !isLandscape && styles.leftSectionPortrait
        ]}>
          {/* Header avec branding */}
          <View style={styles.brandingSection}>
            <Text style={[
              styles.appTitle,
              isWeb && styles.appTitleWeb
            ]}>
              🌾 FarineAPP
            </Text>
            <View style={styles.brandingLine} />
          </View>

          {/* Succès principal */}
          <View style={[
            styles.successSection,
            isWeb && styles.successSectionWeb
          ]}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={[
              styles.successTitle,
              isWeb && styles.successTitleWeb
            ]}>
              Mélange Terminé !
            </Text>
            <Text style={[
              styles.successSubtitle,
              isWeb && styles.successSubtitleWeb
            ]}>
              Votre ration {recipe.name} est prête
            </Text>
          </View>
        </View>

        {/* Section droite - Stats et actions */}
        <View style={[
          styles.rightSection,
          isWeb && !isLandscape && styles.rightSectionPortrait
        ]}>
          {/* Statistiques */}
          <View style={[
            styles.statsContainer,
            isWeb && styles.statsContainerWeb
          ]}>
            <Text style={[
              styles.statsTitle,
              isWeb && styles.statsTitleWeb
            ]}>
              Résumé de la préparation
            </Text>
            
            <View style={styles.statsGrid}>
              {/* Stat 1 - Poids total */}
              <View style={[
                styles.statCard,
                isWeb && styles.statCardWeb
              ]}>
                <View style={styles.statHeader}>
                  <Text style={styles.statIcon}>🎯</Text>
                  <Text style={[
                    styles.statLabel,
                    isWeb && styles.statLabelWeb
                  ]}>
                    Poids total
                  </Text>
                </View>
                <Text style={[
                  styles.statValue,
                  isWeb && styles.statValueWeb,
                  styles.statValuePrimary
                ]}>
                  {totalWeight.toFixed(1)} kg
                </Text>
              </View>

              {/* Stat 2 - Recette */}
              <View style={[
                styles.statCard,
                isWeb && styles.statCardWeb
              ]}>
                <View style={styles.statHeader}>
                  <Text style={styles.statIcon}>📋</Text>
                  <Text style={[
                    styles.statLabel,
                    isWeb && styles.statLabelWeb
                  ]}>
                    Recette utilisée
                  </Text>
                </View>
                <Text style={[
                  styles.statValue,
                  isWeb && styles.statValueWeb,
                  styles.statValueSecondary
                ]}>
                  {recipe.name}
                </Text>
              </View>


            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.primaryButton,
                isWeb && styles.actionButtonWeb
              ]}
              onPress={onHome}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.actionButtonText,
                isWeb && styles.actionButtonTextWeb
              ]}>
                🏠 Retour à l'accueil
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
      width: '100vw',
    }),
    ...(Platform.OS !== 'web' && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
  } as ViewStyle,

  mainLayout: {
    flex: 1,
    flexDirection: 'row', // Toujours horizontal pour mobile paysage
    padding: Platform.OS === 'web' ? 24 : 16,
    gap: Platform.OS === 'web' ? 32 : 20,
    alignItems: 'stretch',
  } as ViewStyle,

  webPortraitLayout: {
    flexDirection: 'column',
    maxWidth: 480,
    alignSelf: 'center',
    paddingVertical: 40,
  } as ViewStyle,

  // === SECTION GAUCHE ===
  leftSection: {
    flex: 0.45, // Mobile paysage : 45% de largeur
    justifyContent: 'space-between',
    paddingVertical: 8,
  } as ViewStyle,

  leftSectionPortrait: {
    flex: 0,
    paddingVertical: 0,
    marginBottom: 32,
  } as ViewStyle,

  brandingSection: {
    alignItems: 'center',
    marginBottom: 24,
  } as ViewStyle,

  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  } as TextStyle,

  appTitleWeb: {
    fontSize: 36,
    marginBottom: 16,
  } as TextStyle,

  brandingLine: {
    width: 60,
    height: 4,
    backgroundColor: '#10B981',
    borderRadius: 2,
  } as ViewStyle,

  successSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  } as ViewStyle,

  successSectionWeb: {
    alignItems: 'center',
    textAlign: 'center',
  } as ViewStyle,

  successIcon: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 50,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  } as ViewStyle,

  successEmoji: {
    fontSize: 32,
  } as TextStyle,

  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 8,
    lineHeight: 28,
    textAlign: 'center',
  } as TextStyle,

  successTitleWeb: {
    fontSize: 28,
    marginBottom: 12,
    textAlign: 'center',
  } as TextStyle,

  successSubtitle: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    maxWidth: 200,
    textAlign: 'center',
  } as TextStyle,

  successSubtitleWeb: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 300,
  } as TextStyle,

  // === SECTION DROITE ===
  rightSection: {
    flex: 0.55, // Mobile paysage : 55% de largeur
    justifyContent: 'space-between',
  } as ViewStyle,

  rightSectionPortrait: {
    flex: 1,
  } as ViewStyle,

  // === STATISTIQUES ===
  statsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  } as ViewStyle,

  statsContainerWeb: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  } as ViewStyle,

  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  } as TextStyle,

  statsTitleWeb: {
    fontSize: 18,
    marginBottom: 20,
  } as TextStyle,

  statsGrid: {
    gap: 12,
  } as ViewStyle,

  statCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#475569',
  } as ViewStyle,

  statCardWeb: {
    padding: 16,
    borderRadius: 16,
    transition: 'all 0.2s ease',
  } as ViewStyle,

  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  } as ViewStyle,

  statIcon: {
    fontSize: 16,
  } as TextStyle,

  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  } as TextStyle,

  statLabelWeb: {
    fontSize: 13,
  } as TextStyle,

  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  } as TextStyle,

  statValueWeb: {
    fontSize: 15,
  } as TextStyle,

  statValuePrimary: {
    color: '#10B981',
  } as TextStyle,

  statValueSecondary: {
    color: '#60A5FA',
  } as TextStyle,

  // === ACTIONS ===
  actionsContainer: {
    gap: 12,
  } as ViewStyle,

  actionButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    minHeight: 48,
  } as ViewStyle,

  actionButtonWeb: {
    borderRadius: 16,
    padding: 16,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: 52,
  } as ViewStyle,

  primaryButton: {
    backgroundColor: '#059669',
  } as ViewStyle,

  actionButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.3,
  } as TextStyle,

  actionButtonTextWeb: {
    fontSize: 16,
    letterSpacing: 0.5,
  } as TextStyle,
});