import { useState, useEffect } from 'react';
import { BarChart3, Calendar, TrendingUp, Package, ArrowLeft, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const FarineLogsPage = ({ onBack }) => {
  // Configuration API - change this for production
  const API_BASE = "http://localhost:8000";

  const [logsData, setLogsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Charger les données depuis l'API
    loadLogs();
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogsData(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || 'Erreur lors du chargement des logs');
      }
    } catch (err) {
      console.error('Erreur lors du chargement des logs:', err);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // Préparer les données pour les graphiques
  const prepareChartData = () => {
    if (!logsData?.resource_usage) return { barData: [], pieData: [], monthlyData: [] };

    const totalUsage = logsData.resource_usage.total_usage || {};
    const monthlyUsage = logsData.resource_usage.monthly_usage || {};
    
    // Données pour le graphique total
    const barData = Object.entries(totalUsage).map(([ingredient, data]) => ({
      ingredient,
      kg: data.total_kg,
      sessions: data.total_sessions
    }));

    const pieData = Object.entries(totalUsage).map(([ingredient, data]) => ({
      name: ingredient,
      value: data.total_kg
    }));

    // Données pour le graphique mensuel
    const monthlyData = Object.entries(monthlyUsage).map(([month, ingredients]) => {
      const monthData = { month };
      Object.entries(ingredients).forEach(([ingredient, data]) => {
        monthData[ingredient] = data.total_kg;
      });
      return monthData;
    }).sort((a, b) => a.month.localeCompare(b.month));

    return { barData, pieData, monthlyData };
  };

  const { barData, pieData, monthlyData } = prepareChartData();

  // Couleurs pour les graphiques
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalKg = () => {
    if (!logsData?.resource_usage?.total_usage) return 0;
    return Object.values(logsData.resource_usage.total_usage)
      .reduce((sum, data) => sum + data.total_kg, 0);
  };

  const getTotalSessions = () => {
    if (!logsData?.resource_usage?.total_usage) return 0;
    return Object.values(logsData.resource_usage.total_usage)
      .reduce((sum, data) => sum + data.total_sessions, 0);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Fallback si onBack n'est pas fourni
      window.history.back();
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      width: '100vw',
      maxWidth: '100%',
      backgroundColor: '#1e293b',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      padding: isMobile ? '1rem' : '2rem',
      boxSizing: 'border-box',
      margin: 0
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '2rem',
      flexWrap: 'wrap',
      gap: '1rem',
      width: '100%'
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      backgroundColor: '#374151',
      border: 'none',
      borderRadius: '0.5rem',
      color: 'white',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      transition: 'background-color 0.2s'
    },
    title: {
      fontSize: isMobile ? '1.5rem' : '2rem',
      fontWeight: 'bold',
      color: 'white',
      margin: 0
    },
    refreshButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      backgroundColor: '#2563eb',
      border: 'none',
      borderRadius: '0.5rem',
      color: 'white',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      transition: 'background-color 0.2s'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: '1rem',
      marginBottom: '2rem',
      width: '100%'
    },
    statCard: {
      backgroundColor: '#374151',
      padding: '1.5rem',
      borderRadius: '0.75rem',
      border: '1px solid #4b5563',
      width: '100%',
      boxSizing: 'border-box'
    },
    statIcon: {
      width: '40px',
      height: '40px',
      backgroundColor: '#2563eb',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1rem'
    },
    statValue: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '0.5rem'
    },
    statLabel: {
      fontSize: '0.875rem',
      color: '#9ca3af'
    },
    chartsGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '2rem',
      marginBottom: '2rem',
      width: '100%'
    },
    chartCard: {
      backgroundColor: '#374151',
      padding: '1.5rem',
      borderRadius: '0.75rem',
      border: '1px solid #4b5563',
      width: '100%',
      boxSizing: 'border-box'
    },
    chartTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    tableCard: {
      backgroundColor: '#374151',
      borderRadius: '0.75rem',
      border: '1px solid #4b5563',
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box'
    },
    tableHeader: {
      backgroundColor: '#4b5563',
      padding: '1rem',
      borderBottom: '1px solid #6b7280'
    },
    tableTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: 'white',
      margin: 0
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    tableHeaderRow: {
      backgroundColor: '#4b5563'
    },
    tableHeaderCell: {
      padding: '0.75rem 1rem',
      textAlign: 'left',
      fontSize: '0.875rem',
      fontWeight: '500',
      color: 'white',
      borderBottom: '1px solid #6b7280'
    },
    tableRow: {
      borderBottom: '1px solid #4b5563',
      transition: 'background-color 0.2s'
    },
    tableCell: {
      padding: '0.75rem 1rem',
      fontSize: '0.875rem',
      color: 'white'
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem',
      gap: '1rem',
      width: '100%'
    },
    spinner: {
      width: '40px',
      height: '40px',
      border: '4px solid #374151',
      borderTop: '4px solid #2563eb',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    errorContainer: {
      backgroundColor: '#7f1d1d',
      border: '1px solid #f87171',
      borderRadius: '0.5rem',
      padding: '1rem',
      color: '#fecaca',
      textAlign: 'center',
      width: '100%',
      boxSizing: 'border-box'
    },
    timestampInfo: {
      marginTop: '2rem',
      backgroundColor: '#1e293b',
      padding: '1rem',
      borderRadius: '0.5rem',
      border: '1px solid #4b5563',
      fontSize: '0.875rem',
      color: '#9ca3af',
      textAlign: 'center',
      width: '100%',
      boxSizing: 'border-box'
    },
    noDataContainer: {
      backgroundColor: '#374151',
      padding: '3rem',
      borderRadius: '0.75rem',
      border: '1px solid #4b5563',
      textAlign: 'center',
      color: '#9ca3af',
      width: '100%',
      boxSizing: 'border-box'
    },
    noDataTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '1rem'
    },
    noDataText: {
      fontSize: '0.875rem',
      marginBottom: '1.5rem'
    }
  };

  // Fonction pour créer un label personnalisé pour la pie chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="500"
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Chargement des logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button 
            style={styles.backButton}
            onClick={handleBack}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#374151'}
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        </div>
        <div style={styles.errorContainer}>
          <p>{error}</p>
          <button 
            style={styles.refreshButton}
            onClick={loadLogs}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Vérifier si on a des données
  const hasData = logsData && logsData.resource_usage && 
                 Object.keys(logsData.resource_usage.total_usage || {}).length > 0;

  if (!hasData) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button 
            style={styles.backButton}
            onClick={handleBack}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#374151'}
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          
          <h1 style={styles.title}>📊 FarineAPP</h1>
          
          <button 
            style={styles.refreshButton}
            onClick={loadLogs}
            disabled={loading}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>

        <div style={styles.noDataContainer}>
          <div style={styles.noDataTitle}>Aucune donnée disponible</div>
          <div style={styles.noDataText}>
            Il n'y a pas encore de logs d'utilisation. Les données apparaîtront ici une fois que des recettes auront été utilisées.
          </div>
          <button 
            style={styles.refreshButton}
            onClick={loadLogs}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <div style={styles.header}>
        <button 
          style={styles.backButton}
          onClick={handleBack}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#374151'}
        >
          <ArrowLeft size={16} />
          Retour
        </button>
        
        <h1 style={styles.title}>📊 FarineAPP</h1>
        
        <button 
          style={styles.refreshButton}
          onClick={loadLogs}
          disabled={loading}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {/* Statistics Cards - Maintenant seulement 3 cartes */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <Package size={20} />
          </div>
          <div style={styles.statValue}>{getTotalKg().toFixed(1)} kg</div>
          <div style={styles.statLabel}>Total Consommé</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#10b981'}}>
            <TrendingUp size={20} />
          </div>
          <div style={styles.statValue}>{getTotalSessions()}</div>
          <div style={styles.statLabel}>Sessions Totales</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#8b5cf6'}}>
            <Calendar size={20} />
          </div>
          <div style={styles.statValue}>
            {Object.keys(logsData?.resource_usage?.monthly_usage || {}).length}
          </div>
          <div style={styles.statLabel}>Mois Actifs</div>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartsGrid}>
        {/* Bar Chart - Consommation Totale */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>
            <BarChart3 size={20} />
            Consommation Totale par Ingrédient
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
              <XAxis 
                dataKey="ingredient" 
                tick={{ fill: 'white', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: 'white', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#374151', 
                  border: '1px solid #4b5563',
                  borderRadius: '0.5rem',
                  color: 'white'
                }}
                labelStyle={{ color: 'white' }}
              />
              <Bar dataKey="kg" fill="#3b82f6" name="Kilogrammes (Total)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Améliorée avec labels externes */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>
            <Package size={20} />
            Répartition de la Consommation Totale
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#374151', 
                  border: '1px solid #4b5563',
                  borderRadius: '0.5rem',
                  color: 'white'
                }}
                formatter={(value, name) => [`${value.toFixed(1)} kg`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Charts */}
      {monthlyData.length > 0 && (
        <div style={{ marginBottom: '2rem', width: '100%' }}>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>
              <Calendar size={20} />
              Consommation Mensuelle par Ingrédient
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'white', fontSize: 12 }}
                  tickFormatter={formatMonth}
                />
                <YAxis tick={{ fill: 'white', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#374151', 
                    border: '1px solid #4b5563',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                  labelStyle={{ color: 'white' }}
                  labelFormatter={(value) => `Mois: ${formatMonth(value)}`}
                />
                {Object.keys(logsData?.resource_usage?.total_usage || {}).map((ingredient, index) => (
                  <Bar 
                    key={ingredient}
                    dataKey={ingredient} 
                    fill={colors[index % colors.length]} 
                    name={ingredient}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Usage Table */}
      {Object.keys(logsData?.resource_usage?.monthly_usage || {}).length > 0 && (
        <div style={{ ...styles.tableCard, marginBottom: '2rem' }}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>Consommation Mensuelle Détaillée</h3>
          </div>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Mois</th>
                {Object.keys(logsData.resource_usage.total_usage).map(ingredient => (
                  <th key={ingredient} style={styles.tableHeaderCell}>{ingredient} (kg)</th>
                ))}
                <th style={styles.tableHeaderCell}>Total Mois (kg)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(logsData.resource_usage.monthly_usage).map(([month, ingredients]) => {
                const monthTotal = Object.values(ingredients).reduce((sum, data) => sum + data.total_kg, 0);
                return (
                  <tr 
                    key={month} 
                    style={styles.tableRow}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={styles.tableCell}>
                      <strong>{formatMonth(month)}</strong>
                    </td>
                    {Object.keys(logsData.resource_usage.total_usage).map(ingredient => (
                      <td key={ingredient} style={styles.tableCell}>
                        {ingredients[ingredient]?.total_kg?.toFixed(1) || '0.0'} kg
                      </td>
                    ))}
                    <td style={{...styles.tableCell, fontWeight: 'bold', color: '#60a5fa'}}>
                      {monthTotal.toFixed(1)} kg
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>Détails par Ingrédient</h3>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.tableHeaderCell}>Ingrédient</th>
              <th style={styles.tableHeaderCell}>Total (kg)</th>
              <th style={styles.tableHeaderCell}>Sessions</th>
              <th style={styles.tableHeaderCell}>Première Utilisation</th>
              <th style={styles.tableHeaderCell}>Dernière Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(logsData?.resource_usage?.total_usage || {}).map(([ingredient, data]) => (
              <tr 
                key={ingredient} 
                style={styles.tableRow}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={styles.tableCell}>
                  <strong>{ingredient}</strong>
                </td>
                <td style={styles.tableCell}>{data.total_kg.toFixed(1)} kg</td>
                <td style={styles.tableCell}>{data.total_sessions}</td>
                <td style={styles.tableCell}>{formatDate(data.first_used)}</td>
                <td style={styles.tableCell}>{formatDate(data.last_used)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Timestamp Info */}
      <div style={styles.timestampInfo}>
        Dernière mise à jour: {logsData?.timestamp ? formatTimestamp(logsData.timestamp) : 'N/A'}
      </div>
    </div>
  );
};

export default FarineLogsPage;