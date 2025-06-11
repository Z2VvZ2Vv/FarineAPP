import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ViewStyle,
  TextStyle,
  ScrollView,
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

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={isWeb ? styles.appTitleWeb : styles.appTitle}>🌾 FarineAPP</Text>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section de succès */}
        <View style={isWeb ? styles.successCardWeb : styles.successCard}>
          <View style={styles.successIconContainer}>
            <Text style={isWeb ? styles.successIconWeb : styles.successIcon}>✅</Text>
          </View>
          <Text style={isWeb ? styles.successTitleWeb : styles.successTitle}>
            Mélange Terminé !
          </Text>
          <Text style={isWeb ? styles.successSubtitleWeb : styles.successSubtitle}>
            Votre ration {recipe.name} est prête
          </Text>
        </View>

        {/* Statistiques */}
        <View style={isWeb ? styles.statsContainerWeb : styles.statsContainer}>
          <Text style={isWeb ? styles.statsTitleWeb : styles.statsTitle}>Résumé</Text>
          
          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <Text style={isWeb ? styles.statLabelWeb : styles.statLabel}>Poids total</Text>
              <Text style={isWeb ? styles.statValueWeb : styles.statValue}>
                {totalWeight.toFixed(1)} kg
              </Text>
            </View>
            <Text style={styles.statIcon}>🎯</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <Text style={isWeb ? styles.statLabelWeb : styles.statLabel}>Recette</Text>
              <Text style={isWeb ? styles.statValueWeb : styles.statValue}>
                {recipe.name}
              </Text>
            </View>
            <Text style={styles.statIcon}>📋</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[
              isWeb ? styles.actionButtonWeb : styles.actionButton,
              styles.primaryButton
            ]}
            onPress={onHome}
            activeOpacity={0.8}
          >
            <Text style={isWeb ? styles.actionButtonTextWeb : styles.actionButtonText}>
              Retour à l'accueil
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  } as ViewStyle,

  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  } as TextStyle,

  appTitleWeb: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  } as TextStyle,

  content: {
    flex: 1,
  } as ViewStyle,

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  } as ViewStyle,

  successCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  } as ViewStyle,

  successCardWeb: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#10B981',
    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)',
  } as ViewStyle,

  successIconContainer: {
    marginBottom: 16,
  } as ViewStyle,

  successIcon: {
    fontSize: 48,
  } as TextStyle,

  successIconWeb: {
    fontSize: 64,
  } as TextStyle,

  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 8,
    textAlign: 'center',
  } as TextStyle,

  successTitleWeb: {
    fontSize: 36,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 12,
    textAlign: 'center',
  } as TextStyle,

  successSubtitle: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 24,
  } as TextStyle,

  successSubtitleWeb: {
    fontSize: 18,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 28,
  } as TextStyle,

  statsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  } as ViewStyle,

  statsContainerWeb: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#334155',
  } as ViewStyle,

  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  } as TextStyle,

  statsTitleWeb: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  } as TextStyle,

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  } as ViewStyle,

  statInfo: {
    flex: 1,
  } as ViewStyle,

  statLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  } as TextStyle,

  statLabelWeb: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 6,
  } as TextStyle,

  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  } as TextStyle,

  statValueWeb: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  } as TextStyle,

  statIcon: {
    fontSize: 24,
    marginLeft: 12,
  } as TextStyle,

  actionContainer: {
    gap: 12,
  } as ViewStyle,

  actionButton: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  } as ViewStyle,

  actionButtonWeb: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as ViewStyle,

  primaryButton: {
    backgroundColor: '#059669',
  } as ViewStyle,

  actionButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  } as TextStyle,

  actionButtonTextWeb: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  } as TextStyle,
});