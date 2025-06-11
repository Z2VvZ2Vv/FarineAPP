import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Home, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import API_URL from "../config";
import FarineLogsPage from './FarineLogsPage'; 

const FarineApp = () => {
  //change this for production
  const API_BASE = API_URL.replace("5173", "8000");

  const availableIngredients = ['Mais/Blé', 'Luzerne', 'Lin'];

  const [recipes, setRecipes] = useState([]);
  const [newRecipe, setNewRecipe] = useState({ 
    name: '', 
    ingredients: [
      { name: 'Mais/Blé', percentage: 0 },
      { name: 'Luzerne', percentage: 0 },
      { name: 'Lin', percentage: 0 }
    ]
  });
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  
  // Nouvel état pour la navigation
  const [currentPage, setCurrentPage] = useState('home'); // 'home' ou 'logs'

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // load initial recipes
    loadRecipes();
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Si on est sur la page logs, on affiche le composant logs
  if (currentPage === 'logs') {
    return <FarineLogsPage onBack={() => setCurrentPage('home')} />;
  }

  // alert function
  const showAlert = (message, type = 'error') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  // load recipes from the API
  const loadRecipes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/recipes`);
      if (response.ok) {
        const data = await response.json();
        setRecipes(data);
      } else {
        showAlert('Erreur lors du chargement des recettes');
      }
    } catch (error) {
      showAlert('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // add a new recipe
  const handleAddRecipe = async () => {
    const totalPercentage = newRecipe.ingredients.reduce((sum, ing) => sum + ing.percentage, 0);
    
    if (!newRecipe.name.trim()) {
      showAlert('Le nom de la recette est requis');
      return;
    }
    
    if (totalPercentage !== 100) {
      showAlert(`Le total des pourcentages doit être égal à 100% (actuellement ${totalPercentage}%)`);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/recipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRecipe.name,
          ingredients: newRecipe.ingredients.filter(ing => ing.percentage > 0)
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showAlert('Recette ajoutée avec succès !', 'success');
        resetForm();
        loadRecipes();
      } else {
        const error = await response.json();
        showAlert(error.detail || 'Erreur lors de l\'ajout de la recette');
      }
    } catch (error) {
      showAlert('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // edit a recipe
  const handleEditRecipe = (recipe) => {
    const formattedIngredients = availableIngredients.map(ingredientName => {
      const found = recipe.ingredients.find(ing => ing.name === ingredientName);
      return {
        name: ingredientName,
        percentage: found ? found.percentage : 0
      };
    });
    
    setNewRecipe({
      name: recipe.name,
      ingredients: formattedIngredients
    });
    setEditingRecipe(recipe);
    setShowAddForm(true);
  };

  // update an existing recipe
  const handleUpdateRecipe = async () => {
    const totalPercentage = newRecipe.ingredients.reduce((sum, ing) => sum + ing.percentage, 0);
    
    if (!newRecipe.name.trim()) {
      showAlert('Le nom de la recette est requis');
      return;
    }
    
    if (totalPercentage !== 100) {
      showAlert(`Le total des pourcentages doit être égal à 100% (actuellement ${totalPercentage}%)`);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/recipes/${editingRecipe.name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRecipe.name,
          ingredients: newRecipe.ingredients.filter(ing => ing.percentage > 0)
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showAlert('Recette modifiée avec succès !', 'success');
        resetForm();
        loadRecipes();
      } else {
        const error = await response.json();
        showAlert(error.detail || 'Erreur lors de la modification de la recette');
      }
    } catch (error) {
      showAlert('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // delete a recipe
  const handleDeleteRecipe = async (recipeName) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la recette "${recipeName}" ?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/recipes/${recipeName}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        showAlert('Recette supprimée avec succès !', 'success');
        loadRecipes();
      } else {
        const error = await response.json();
        showAlert(error.detail || 'Erreur lors de la suppression de la recette');
      }
    } catch (error) {
      showAlert('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // form reset function
  const resetForm = () => {
    setNewRecipe({ 
      name: '', 
      ingredients: [
        { name: 'Mais/Blé', percentage: 0 },
        { name: 'Luzerne', percentage: 0 },
        { name: 'Lin', percentage: 0 }
      ]
    });
    setEditingRecipe(null);
    setShowAddForm(false);
  };

  const handleIngredientChange = (index, value) => {
    const numValue = parseInt(value) || 0;
    const updatedIngredients = [...newRecipe.ingredients];
    updatedIngredients[index].percentage = numValue;
    setNewRecipe({
      ...newRecipe,
      ingredients: updatedIngredients
    });
  };

  const formatIngredients = (ingredients) => {
    return ingredients
      .filter(ing => ing.percentage > 0)
      .map(ing => `${ing.name} (${ing.percentage}%)`)
      .join(', ');
  };

  const getTotalPercentage = () => {
    return newRecipe.ingredients.reduce((sum, ing) => sum + ing.percentage, 0);
  };

  const styles = {
    container: {
      height: '100vh',
      width: '100vw',
      backgroundColor: '#1e293b',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    },
    flexContainer: {
      display: 'flex',
      width: '100%',
      height: '100%'
    },
    sidebar: {
      width: isMobile ? '0' : '320px',
      backgroundColor: '#1e293b',
      height: '100%',
      padding: isMobile ? '0' : '1rem',
      borderRight: isMobile ? 'none' : '1px solid #475569',
      overflowY: 'auto',
      display: isMobile ? 'none' : 'block'
    },
    logoMobile: {
      display: isMobile ? 'flex' : 'none',
      fontSize: '1rem',
      fontWeight: '600',
      color: 'white',
      justifyContent: 'center',
    },
    logo: {
      fontSize: '1rem',
      fontWeight: '600',
      color: 'white',
      marginBottom: '1.5rem'
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem',
      borderRadius: '0.5rem',
      marginBottom: '0.5rem',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      fontSize: '0.875rem'
    },
    activeNavItem: {
      backgroundColor: '#475569',
      color: 'white'
    },
    mainContent: {
      flex: 1,
      padding: isMobile ? '1rem' : '1.5rem',
      backgroundColor: '#1e293b',
      height: '100%',
      overflowY: 'auto',
      paddingBottom: isMobile ? '80px' : '1.5rem'
    },
    alert: {
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 50,
      padding: '1rem',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      minWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      animation: 'slideIn 0.3s ease-out'
    },
    successAlert: {
      backgroundColor: '#065f46',
      border: '1px solid #10b981',
      color: '#d1fae5'
    },
    errorAlert: {
      backgroundColor: '#7f1d1d',
      border: '1px solid #f87171',
      color: '#fecaca'
    },
    loadingOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60
    },
    spinner: {
      width: '40px',
      height: '40px',
      border: '4px solid #374151',
      borderTop: '4px solid #2563eb',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    title: {
      fontSize: isMobile ? '1.5rem' : '2rem',
      fontWeight: 'bold',
      marginBottom: isMobile ? '1.5rem' : '2rem',
      color: 'white'
    },
    formContainer: {
      backgroundColor: '#374151',
      borderRadius: '0.5rem',
      padding: isMobile ? '1rem' : '1.5rem',
      marginBottom: '1.5rem',
      border: '1px solid #4b5563'
    },
    formTitle: {
      fontSize: isMobile ? '1.125rem' : '1.25rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      color: 'white'
    },
    formGroup: {
      marginBottom: '1rem'
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '500',
      marginBottom: '0.5rem',
      color: 'white'
    },
    ingredientRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginBottom: '0.75rem'
    },
    ingredientLabel: {
      minWidth: '80px',
      fontSize: '0.875rem',
      fontWeight: '500',
      color: 'white'
    },
    ingredientInput: {
      width: '80px',
      padding: '0.5rem',
      backgroundColor: '#4b5563',
      border: '1px solid #6b7280',
      borderRadius: '0.375rem',
      color: 'white',
      outline: 'none',
      fontSize: '0.875rem',
      textAlign: 'center'
    },
    percentageInfo: {
      fontSize: '0.875rem',
      color: '#9ca3af',
      marginTop: '0.5rem'
    },
    errorText: {
      color: '#f87171',
      fontSize: '0.875rem',
      marginTop: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      backgroundColor: '#4b5563',
      border: '1px solid #6b7280',
      borderRadius: '0.5rem',
      color: 'white',
      outline: 'none',
      fontSize: '0.875rem',
      boxSizing: 'border-box'
    },
    buttonGroup: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: '0.75rem'
    },
    primaryButton: {
      padding: '0.75rem 1rem',
      backgroundColor: '#2563eb',
      color: 'white',
      borderRadius: '0.5rem',
      border: 'none',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      fontSize: '0.875rem'
    },
    secondaryButton: {
      padding: '0.75rem 1rem',
      backgroundColor: '#4b5563',
      color: 'white',
      borderRadius: '0.5rem',
      border: 'none',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      fontSize: '0.875rem'
    },
    sectionTitle: {
      fontSize: isMobile ? '1.25rem' : '1.375rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      color: 'white'
    },
    tableContainer: {
      backgroundColor: '#1e293b',
      border: '1px solid #4b5563',
      borderRadius: '0.5rem',
      overflow: 'hidden'
    },
    tableHeader: {
      backgroundColor: '#374151',
      padding: '0.75rem 1rem',
      display: isMobile ? 'none' : 'grid',
      gridTemplateColumns: '1fr 2fr 1fr',
      gap: '1rem',
      borderBottom: '1px solid #4b5563'
    },
    tableHeaderCell: {
      fontSize: '0.875rem',
      fontWeight: '500',
      color: 'white'
    },
    tableRow: {
      padding: '1rem',
      display: isMobile ? 'block' : 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr 1fr',
      gap: isMobile ? '0.5rem' : '1rem',
      borderBottom: '1px solid #4b5563',
      transition: 'background-color 0.2s'
    },
    mobileRecipeCard: {
      backgroundColor: '#374151',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '1rem',
      border: '1px solid #4b5563'
    },
    mobileRecipeName: {
      fontSize: '1rem',
      fontWeight: '600',
      color: 'white',
      marginBottom: '0.5rem'
    },
    mobileRecipeIngredients: {
      fontSize: '0.875rem',
      color: '#9ca3af',
      marginBottom: '1rem',
      lineHeight: '1.4'
    },
    tableCell: {
      fontSize: '0.875rem',
      color: 'white',
      display: 'flex',
      alignItems: 'center'
    },
    ingredientsCell: {
      fontSize: '0.875rem',
      color: '#9ca3af',
      display: 'flex',
      alignItems: 'center'
    },
    actionButtons: {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '0.5rem' : '0.75rem',
      flexWrap: 'wrap'
    },
    actionButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'color 0.2s',
      background: 'none',
      border: 'none',
      padding: '0.5rem',
      borderRadius: '0.375rem'
    },
    editButton: {
      color: '#60a5fa',
      backgroundColor: 'rgba(96, 165, 250, 0.1)'
    },
    deleteButton: {
      color: '#f87171',
      backgroundColor: 'rgba(248, 113, 113, 0.1)'
    },
    emptyState: {
      padding: '2rem 1rem',
      textAlign: 'center',
      color: '#9ca3af'
    },
    fabButton: {
      display: isMobile ? 'flex' : 'none',
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      width: '56px',
      height: '56px',
      backgroundColor: '#2563eb',
      borderRadius: '50%',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      zIndex: 30
    }
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Loading Overlay */}
      {loading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner}></div>
        </div>
      )}

      {/* Alert */}
      {alert && (
        <div style={{
          ...styles.alert,
          ...(alert.type === 'success' ? styles.successAlert : styles.errorAlert)
        }}>
          {alert.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{alert.message}</span>
        </div>
      )}

      <div style={styles.flexContainer}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.logo}>
            <h1>🔧FarineAPP</h1>
          </div>

          <nav>
            <div style={{...styles.navItem, ...styles.activeNavItem}}>
              <Home size={20} />
              <span>Rations</span>
            </div>
            
            <div 
              style={styles.navItem}
              onClick={() => setShowAddForm(true)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#374151'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <Plus size={20} />
              <span>Ajouter une ration</span>
            </div>

            {/* Nouveau lien vers les logs */}
            <div 
              style={styles.navItem}
              onClick={() => setCurrentPage('logs')}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#374151'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <BarChart3 size={20} />
              <span>Logs de ressources</span>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div style={styles.mainContent}>
          {/* Header */}
          <div style={styles.logoMobile}>
            <h1>🔧 FarineAPP</h1>
          </div>
          <div>
            <h1 style={styles.title}>Gérer les rations</h1>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div style={styles.formContainer}>
              <h2 style={styles.formTitle}>
                {editingRecipe ? 'Modifier la recette' : 'Ajouter une nouvelle recette'}
              </h2>
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Nom de la recette
                  </label>
                  <input
                    type="text"
                    value={newRecipe.name}
                    onChange={(e) => setNewRecipe({...newRecipe, name: e.target.value})}
                    style={styles.input}
                    placeholder="Entrez le nom de la recette"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Ingrédients (Total: {getTotalPercentage()}%)
                  </label>
                  {newRecipe.ingredients.map((ingredient, index) => (
                    <div key={ingredient.name} style={styles.ingredientRow}>
                      <span style={styles.ingredientLabel}>{ingredient.name}:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ingredient.percentage}
                        onChange={(e) => handleIngredientChange(index, e.target.value)}
                        style={styles.ingredientInput}
                      />
                      <span style={styles.percentageInfo}>%</span>
                    </div>
                  ))}
                  {getTotalPercentage() !== 100 && (
                    <div style={styles.errorText}>
                      Le total doit être égal à 100% (actuellement {getTotalPercentage()}%)
                    </div>
                  )}
                </div>
                <div style={styles.buttonGroup}>
                  <button
                    onClick={editingRecipe ? handleUpdateRecipe : handleAddRecipe}
                    style={styles.primaryButton}
                    disabled={loading}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
                  >
                    {editingRecipe ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                  <button
                    onClick={resetForm}
                    style={styles.secondaryButton}
                    disabled={loading}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#374151'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#4b5563'}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Recipes Section */}
          <div>
            <h2 style={styles.sectionTitle}>Recettes existantes</h2>
            
            {isMobile ? (
              // Mobile Card Layout
              <div>
                {recipes.map((recipe) => (
                  <div key={recipe.name} style={styles.mobileRecipeCard}>
                    <div style={styles.mobileRecipeName}>
                      {recipe.name}
                    </div>
                    <div style={styles.mobileRecipeIngredients}>
                      {formatIngredients(recipe.ingredients)}
                    </div>
                    <div style={styles.actionButtons}>
                      <button
                        onClick={() => handleEditRecipe(recipe)}
                        style={{...styles.actionButton, ...styles.editButton}}
                        disabled={loading}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(96, 165, 250, 0.2)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(96, 165, 250, 0.1)'}
                      >
                        <Edit3 size={14} />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteRecipe(recipe.name)}
                        style={{...styles.actionButton, ...styles.deleteButton}}
                        disabled={loading}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(248, 113, 113, 0.2)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
                      >
                        <Trash2 size={14} />
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
                {recipes.length === 0 && !loading && (
                  <div style={styles.emptyState}>
                    <span>Aucune recette disponible. Ajoutez-en une nouvelle !</span>
                  </div>
                )}
              </div>
            ) : (
              // Desktop Table Layout
              <div style={styles.tableContainer}>
                <div style={styles.tableHeader}>
                  <div style={styles.tableHeaderCell}>
                    <span>Nom de la recette</span>
                  </div>
                  <div style={styles.tableHeaderCell}>
                    <span>Ingrédients</span>
                  </div>
                  <div style={styles.tableHeaderCell}>
                    <span>Actions</span>
                  </div>
                </div>

                <div>
                  {recipes.map((recipe) => (
                    <div 
                      key={recipe.name} 
                      style={styles.tableRow}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={styles.tableCell}>
                        <span>{recipe.name}</span>
                      </div>
                      <div style={styles.ingredientsCell}>
                        <span>{formatIngredients(recipe.ingredients)}</span>
                      </div>
                      <div style={styles.actionButtons}>
                        <button
                          onClick={() => handleEditRecipe(recipe)}
                          style={{...styles.actionButton, ...styles.editButton}}
                          disabled={loading}
                          onMouseEnter={(e) => e.target.style.color = '#3b82f6'}
                          onMouseLeave={(e) => e.target.style.color = '#60a5fa'}
                        >
                          <Edit3 size={14} />
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteRecipe(recipe.name)}
                          style={{...styles.actionButton, ...styles.deleteButton}}
                          disabled={loading}
                          onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.target.style.color = '#f87171'}
                        >
                          <Trash2 size={14} />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {recipes.length === 0 && !loading && (
                  <div style={styles.emptyState}>
                    <span>Aucune recette disponible. Ajoutez-en une nouvelle !</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB Button pour mobile */}
      {isMobile && (
        <button 
          style={styles.fabButton}
          onClick={() => setShowAddForm(true)}
          disabled={loading}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
};

export default FarineApp;