import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle } from 'react-native-svg';

const { width, height } = Dimensions.get(Platform.OS === 'web' ? 'window' : 'screen');

interface ManualPageProps {
  onBack: () => void;
}

interface WeightApiResponse {
  value: number;
  unit: string;
  stable: boolean;
}

interface MotorStatusResponse {
  corn: boolean;
  alfalfa: boolean;
}

export default function ManualPage({ onBack }: ManualPageProps): React.ReactElement {
  const apiUrl = Platform.select({
    android: 'http://10.0.2.2:8000',
    default: 'http://localhost:8000',
  });

  const [currentWeight, setCurrentWeight] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [motorStates, setMotorStates] = useState({
    corn: false,
    alfalfa: false,
  });
  
  const circleRadius = 45;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeight = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/weight`);
      
      if (!response.ok) {
        throw new Error('Erreur de connexion');
      }
      
      const data: WeightApiResponse = await response.json();
      const weight = data.value || 0;
      
      setCurrentWeight(weight);
      setIsLoading(false);
      setError(null);
      
    } catch (err) {
      setError('Connexion perdue');
      setIsLoading(false);
    }
  };

  const fetchMotorStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/motor/status`);
      
      if (!response.ok) {
        throw new Error('Erreur de statut moteur');
      }
      
      const data: MotorStatusResponse = await response.json();
      setMotorStates({
        corn: data.corn,
        alfalfa: data.alfalfa,
      });
      
    } catch (err) {
      console.log('Erreur lors de la récupération du statut des moteurs:', err);
    }
  };

  const callMotorApi = async (endpoint: string) => {
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Récupérer le nouveau statut après l'action
        await fetchMotorStatus();
      }
    } catch (err) {
      console.log('Erreur lors de l\'appel API:', err);
    }
  };

  useEffect(() => {
    // Récupérer les données initiales
    fetchWeight();
    fetchMotorStatus();
    
    // Mise à jour périodique du poids et du statut des moteurs
    intervalRef.current = setInterval(() => {
      fetchWeight();
      fetchMotorStatus();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleMotorControl = async (motor: 'corn' | 'alfalfa' | 'all') => {
    if (motor === 'corn') {
      await callMotorApi('/api/motor/corn/toggle');
    } else if (motor === 'alfalfa') {
      await callMotorApi('/api/motor/alfalfa/toggle');
    } else if (motor === 'all') {
      // Démarrer ou arrêter tous les moteurs selon l'état actuel
      const allRunning = motorStates.corn && motorStates.alfalfa;
      if (allRunning) {
        await callMotorApi('/api/motor/all/stop');
      } else {
        await callMotorApi('/api/motor/all/start');
      }
    }
  };

  const getMotorStatusColor = () => {
    if (!motorStates.corn && !motorStates.alfalfa) return '#EF4444'; // Rouge - tous arrêtés
    if (motorStates.corn && motorStates.alfalfa) return '#10B981'; // Vert - tous en marche
    return '#F59E0B'; // Orange - partiellement en marche
  };

  const getMotorStatusText = () => {
    if (!motorStates.corn && !motorStates.alfalfa) return 'Moteurs arrêtés';
    if (motorStates.corn && motorStates.alfalfa) return 'Moteurs en marche';
    return 'Fonctionnement partiel';
  };

  // Layout pour mobile paysage
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden={true} />
        
        <View style={styles.landscapeContainer}>
          {/* Header avec logo centré et bouton retour */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.logo}>🌾</Text>
              <Text style={styles.title}>FarineAPP</Text>
            </View>
            
            <View style={styles.spacer} />
          </View>

          {/* Contenu principal */}
          <View style={styles.mainContent}>
            {/* Section gauche - Informations et contrôles */}
            <View style={styles.leftSection}>
              <Text style={styles.modeTitle}>Mode Manuel</Text>
              
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.statusIcon}>⚠️</Text>
                  <Text style={styles.errorMessage}>{error}</Text>
                </View>
              )}

              <View style={styles.motorStatusContainer}>
                <Text style={[styles.motorStatusText, { color: getMotorStatusColor() }]}>
                  {getMotorStatusText()}
                </Text>
              </View>

              <View style={styles.controlsContainer}>
                <TouchableOpacity
                  style={[styles.motorButton, motorStates.corn ? styles.motorButtonStop : styles.motorButtonStart]}
                  onPress={() => handleMotorControl('corn')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.motorButtonIcon}>{motorStates.corn ? '⏹' : '▶️'}</Text>
                  <Text style={styles.motorButtonText}>
                    {motorStates.corn ? 'Arrêter' : 'Démarrer'} Maïs/Blé
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.motorButton, motorStates.alfalfa ? styles.motorButtonStop : styles.motorButtonStart]}
                  onPress={() => handleMotorControl('alfalfa')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.motorButtonIcon}>{motorStates.alfalfa ? '⏹' : '▶️'}</Text>
                  <Text style={styles.motorButtonText}>
                    {motorStates.alfalfa ? 'Arrêter' : 'Démarrer'} Luzerne
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.motorButton, styles.motorButtonAll, 
                    (motorStates.corn || motorStates.alfalfa) ? styles.motorButtonStopAll : styles.motorButtonStartAll]}
                  onPress={() => handleMotorControl('all')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.motorButtonIcon}>
                    {(motorStates.corn || motorStates.alfalfa) ? '⏹' : '▶️'}
                  </Text>
                  <Text style={styles.motorButtonText}>
                    {(motorStates.corn || motorStates.alfalfa) ? 'Arrêter tout' : 'Démarrer tout'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section droite - Affichage du poids et cercle de progression */}
            <View style={styles.rightSection}>
              <View style={styles.circleContainer}>
                <Svg width={200} height={200} viewBox="0 0 100 100">
                  <Circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    stroke="#374151"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <Circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    stroke={error ? "#F87171" : "#06B6D4"}
                    strokeWidth="8"
                    fill="transparent"
                  />
                </Svg>
                
                <View style={styles.weightDisplay}>
                  <Text style={[styles.weightText, error && styles.weightTextError]}>
                    {isLoading ? '--' : `${currentWeight.toFixed(1)}`}
                  </Text>
                  <Text style={[styles.weightUnit, error && styles.weightUnitError]}>
                    {!isLoading ? 'kg' : ''}
                  </Text>
                  <Text style={styles.weightLabel}>
                    {error ? 'Connexion perdue' : 'Poids actuel'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Layout pour web
  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar hidden={true} />
      
      <TouchableOpacity
        style={styles.webBackButton}
        onPress={onBack}
        activeOpacity={0.8}
      >
        <Text style={styles.webBackIcon}>←</Text>
      </TouchableOpacity>

      <View style={styles.webContentContainer}>
        <View style={styles.webHeader}>
          <Text style={styles.webTitle}>🌾FarineAPP</Text>
          <Text style={styles.webSubtitle}>Mode Manuel</Text>
        </View>

        <View style={styles.webMain}>
          <View style={styles.webCard}>
            <View style={styles.webCircleContainer}>
              <Svg width={300} height={300} viewBox="0 0 100 100">
                <Circle
                  cx="50"
                  cy="50"
                  r={circleRadius}
                  stroke="#374151"
                  strokeWidth="6"
                  fill="transparent"
                />
                <Circle
                  cx="50"
                  cy="50"
                  r={circleRadius}
                  stroke={error ? "#F87171" : "#06B6D4"}
                  strokeWidth="6"
                  fill="transparent"
                />
              </Svg>
              
              <View style={styles.webWeightDisplay}>
                <Text style={[styles.webWeightText, error && styles.webWeightTextError]}>
                  {isLoading ? '--' : `${currentWeight.toFixed(1)}`}
                </Text>
                <Text style={[styles.webWeightUnit, error && styles.webWeightUnitError]}>
                  {!isLoading ? 'kg' : ''}
                </Text>
                <Text style={styles.webWeightLabel}>
                  {error ? 'Connexion perdue' : 'Poids actuel'}
                </Text>
              </View>
            </View>

            {error && (
              <View style={styles.webErrorContainer}>
                <Text style={styles.webStatusIcon}>⚠️</Text>
                <Text style={styles.webErrorMessage}>{error}</Text>
              </View>
            )}

            <View style={styles.webMotorStatusContainer}>
              <Text style={[styles.webMotorStatus, { color: getMotorStatusColor() }]}>
                {getMotorStatusText()}
              </Text>
            </View>

            <View style={styles.webControlsContainer}>
              <TouchableOpacity
                style={[styles.webMotorButton, motorStates.corn ? styles.webMotorButtonStop : styles.webMotorButtonStart]}
                onPress={() => handleMotorControl('corn')}
                activeOpacity={0.8}
              >
                <Text style={styles.webMotorButtonIcon}>{motorStates.corn ? '⏹' : '▶️'}</Text>
                <Text style={styles.webMotorButtonText}>
                  {motorStates.corn ? 'Arrêter' : 'Démarrer'} Maïs/Blé
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.webMotorButton, motorStates.alfalfa ? styles.webMotorButtonStop : styles.webMotorButtonStart]}
                onPress={() => handleMotorControl('alfalfa')}
                activeOpacity={0.8}
              >
                <Text style={styles.webMotorButtonIcon}>{motorStates.alfalfa ? '⏹' : '▶️'}</Text>
                <Text style={styles.webMotorButtonText}>
                  {motorStates.alfalfa ? 'Arrêter' : 'Démarrer'} Luzerne
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.webMotorButton, styles.webMotorButtonAll,
                  (motorStates.corn || motorStates.alfalfa) ? styles.webMotorButtonStopAll : styles.webMotorButtonStartAll]}
                onPress={() => handleMotorControl('all')}
                activeOpacity={0.8}
              >
                <Text style={styles.webMotorButtonIcon}>
                  {(motorStates.corn || motorStates.alfalfa) ? '⏹' : '▶️'}
                </Text>
                <Text style={styles.webMotorButtonText}>
                  {(motorStates.corn || motorStates.alfalfa) ? 'Arrêter tout' : 'Démarrer tout'}
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
  // Styles communs
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

  // Styles pour mobile paysage
  landscapeContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  spacer: {
    width: 40,
  },

  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  
  leftSection: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 20,
  },
  
  rightSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 20,
  },
  
  backButton: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  
  backIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
    top: -4,
  },
  
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  logo: {
    fontSize: 28,
    marginRight: 8,
  },
  
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  modeTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: '#06B6D4',
    textAlign: 'center',
    marginBottom: 20,
  },
  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7F1D1D',
    alignSelf: 'center',
    maxWidth: '90%',
    marginBottom: 15,
  },
  
  statusIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  
  errorMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FCA5A5',
  },

  motorStatusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },

  motorStatusText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },

  controlsContainer: {
    alignItems: 'center',
    gap: 12,
  },

  motorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 180,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  motorButtonStart: {
    backgroundColor: '#059669',
  },

  motorButtonStop: {
    backgroundColor: '#F97316',
  },

  motorButtonAll: {
    minWidth: 200,
  },

  motorButtonStartAll: {
    backgroundColor: '#065F46',
  },

  motorButtonStopAll: {
    backgroundColor: '#DC2626',
  },

  motorButtonIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 8,
  },

  motorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  circleContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  weightDisplay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  weightText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#06B6D4',
    textAlign: 'center',
  },
  
  weightTextError: {
    color: '#F87171',
  },
  
  weightUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: '#06B6D4',
    textAlign: 'center',
    marginTop: -5,
  },
  
  weightUnitError: {
    color: '#F87171',
  },
  
  weightLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },

  // Styles pour web
  webBackButton: {
    position: 'absolute',
    top: 30,
    left: 30,
    zIndex: 10,
    backgroundColor: '#1E293B',
    borderRadius: 25,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease' as any,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' as any,
    }),
  } as any,

  webBackIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
    ...(Platform.OS === 'web' && {
      userSelect: 'none' as any,
      top: -4,
    }),
  } as any,

  webContentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
    paddingVertical: 32,
    ...(Platform.OS === 'web' && {
      maxWidth: 1200,
      alignSelf: 'center' as any,
      width: '100%',
    }),
  } as any,

  webHeader: {
    alignItems: 'center',
    marginBottom: 60,
  },

  webTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      textAlign: 'center' as any,
      userSelect: 'none' as any,
    }),
  } as any,

  webSubtitle: {
    fontSize: 24,
    color: '#06B6D4',
    fontWeight: '600',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      textAlign: 'center' as any,
      userSelect: 'none' as any,
    }),
  } as any,

  webMain: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  webCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' as any,
    }),
  } as any,

  webCircleContainer: {
    position: 'relative',
    width: 300,
    height: 300,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  webWeightDisplay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  webWeightText: {
    fontSize: 64,
    fontWeight: '700',
    color: '#06B6D4',
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      userSelect: 'none' as any,
    }),
  } as any,

  webWeightTextError: {
    color: '#F87171',
  },

  webWeightUnit: {
    fontSize: 28,
    fontWeight: '600',
    color: '#06B6D4',
    textAlign: 'center',
    marginTop: -8,
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      userSelect: 'none' as any,
    }),
  } as any,

  webWeightUnitError: {
    color: '#F87171',
  },

  webWeightLabel: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 12,
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      userSelect: 'none' as any,
    }),
  } as any,

  webErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#7F1D1D',
    marginBottom: 32,
  },

  webStatusIcon: {
    fontSize: 24,
    marginRight: 12,
  },

  webErrorMessage: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FCA5A5',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
    }),
  } as any,

  webMotorStatusContainer: {
    marginBottom: 30,
  },

  webMotorStatus: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
    }),
  } as any,

  webControlsContainer: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  webMotorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease' as any,
    }),
  } as any,

  webMotorButtonStart: {
    backgroundColor: '#059669',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 32px rgba(5, 150, 105, 0.4)' as any,
    }),
  } as any,

  webMotorButtonStop: {
    backgroundColor: '#F97316',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 32px rgba(249, 115, 22, 0.4)' as any,
    }),
  } as any,

  webMotorButtonAll: {
    minWidth: 180,
  },

  webMotorButtonStartAll: {
    backgroundColor: '#065F46',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 32px rgba(6, 95, 70, 0.4)' as any,
    }),
  } as any,

  webMotorButtonStopAll: {
    backgroundColor: '#DC2626',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 32px rgba(220, 38, 38, 0.4)' as any,
    }),
  } as any,

  webMotorButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 8,
    ...(Platform.OS === 'web' && {
      userSelect: 'none' as any,
    }),
  } as any,

  webMotorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    ...(Platform.OS === 'web' && {
      fontFamily: 'system-ui, -apple-system, sans-serif' as any,
      userSelect: 'none' as any,
    }),
  } as any,
});