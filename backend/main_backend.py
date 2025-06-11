from fastapi import FastAPI,HTTPException,Request
from pathlib import Path
import json
from datetime import datetime, timezone
from fastapi.middleware.cors import CORSMiddleware
import random
from collections import defaultdict

app = FastAPI()
RATIONS_DIR = Path("rations")
RATIONS_DIR.mkdir(exist_ok=True)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulated variable
weight = 0.0

# Simulated motor state
motor_state = {
    "corn": False,
    "alfalfa": False
}

# Simulated mix status + recipe if mix
mix_status = {
    "inProgress": False,
    "totalWeight": 0.0,
    "recipeID": None,
    "sessionStart": None
}

# --- RESOURCE USAGE FUNCTIONS (now using logs.json) ---

def load_resource_usage() -> dict:
    """Charge l'utilisation des ressources depuis logs.json"""
    if Path("logs.json").exists():
        try:
            with open("logs.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {"total_usage": {}, "monthly_usage": {}}
    return {"total_usage": {}, "monthly_usage": {}}

def save_resource_usage(usage: dict) -> None:
    """Sauvegarde l'utilisation des ressources dans logs.json"""
    try:
        with open("logs.json", "w", encoding="utf-8") as f:
            json.dump(usage, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Erreur lors de la sauvegarde des ressources: {e}")

def update_resource_usage(recipe: dict, total_weight: float, completion_percentage: float = 100) -> None:
    """Met à jour les statistiques d'utilisation des ressources"""
    usage_data = load_resource_usage()
    current_month = datetime.now().strftime("%Y-%m")
    
    # Calculer la quantité réellement utilisée
    effective_weight = total_weight * (completion_percentage / 100)
    
    for ingredient in recipe.get("ingredients", []):
        ingredient_name = ingredient["name"]
        quantity_used = (ingredient["percentage"] / 100) * effective_weight
        
        # Mise à jour usage total
        if ingredient_name not in usage_data["total_usage"]:
            usage_data["total_usage"][ingredient_name] = {
                "total_kg": 0,
                "total_sessions": 0,
                "first_used": datetime.now().strftime("%Y-%m-%d"),
                "last_used": datetime.now().strftime("%Y-%m-%d")
            }
        
        usage_data["total_usage"][ingredient_name]["total_kg"] += quantity_used
        usage_data["total_usage"][ingredient_name]["total_sessions"] += 1
        usage_data["total_usage"][ingredient_name]["last_used"] = datetime.now().strftime("%Y-%m-%d")
        
        # Mise à jour usage mensuel
        if current_month not in usage_data["monthly_usage"]:
            usage_data["monthly_usage"][current_month] = {}
        
        if ingredient_name not in usage_data["monthly_usage"][current_month]:
            usage_data["monthly_usage"][current_month][ingredient_name] = {
                "total_kg": 0,
                "sessions": 0
            }
        
        usage_data["monthly_usage"][current_month][ingredient_name]["total_kg"] += quantity_used
        usage_data["monthly_usage"][current_month][ingredient_name]["sessions"] += 1
    
    # Arrondir les valeurs
    for ingredient_data in usage_data["total_usage"].values():
        ingredient_data["total_kg"] = round(ingredient_data["total_kg"], 2)
    
    for month_data in usage_data["monthly_usage"].values():
        for ingredient_data in month_data.values():
            ingredient_data["total_kg"] = round(ingredient_data["total_kg"], 2)
    
    save_resource_usage(usage_data)

# --- RECIPES ---

@app.get("/api/recipes")
async def list_recipes():
    try:
        recipes = []
        for file in RATIONS_DIR.glob("*.json"):
            with file.open("r", encoding="utf-8") as f:
                data = json.load(f)
                recipes.append(data)
        
        return recipes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des recettes: {str(e)}")

@app.get("/api/recipes/{name}")
async def get_recipe(name: str):
    try:
        filepath = RATIONS_DIR / f"{name}.json"
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Recette non trouvée")
        
        with filepath.open("r", encoding="utf-8") as f:
            recipe = json.load(f)
        
        return recipe
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération de la recette: {str(e)}")
    
@app.delete("/api/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    try:
        filepath = RATIONS_DIR / f"{recipe_id}.json"
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Recette non trouvée")
        
        filepath.unlink()
        return {"message": f"Recette '{recipe_id}' supprimée avec succès."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")

@app.post("/api/recipes")
async def create_recipe(request: Request):
    try:
        data = await request.json()
        
        # Validation basique
        if not data.get("name"):
            raise HTTPException(status_code=400, detail="Le nom de la recette est requis")
        
        if not data.get("ingredients"):
            raise HTTPException(status_code=400, detail="Les ingrédients sont requis")
        
        # Validation des pourcentages
        total_percentage = sum(ingredient["percentage"] for ingredient in data["ingredients"])
        if abs(total_percentage - 100) > 0.01:
            raise HTTPException(status_code=400, detail=f"La somme des pourcentages doit être égale à 100%. Actuellement: {total_percentage}%")
        
        # Ajouter timestamp
        if "created_at" not in data:
            data["created_at"] = datetime.now(timezone.utc).isoformat() + "Z"
        
        # Vérifier si la recette existe déjà
        filepath = RATIONS_DIR / f"{data['name']}.json"
        if filepath.exists():
            raise HTTPException(status_code=409, detail="Une recette avec ce nom existe déjà")
        
        # Sauvegarder
        with filepath.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return {"message": f"Recette '{data['name']}' ajoutée avec succès."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création: {str(e)}")

@app.put("/api/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, request: Request):
    try:
        filepath = RATIONS_DIR / f"{recipe_id}.json"
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Recette non trouvée")
        
        data = await request.json()
        
        # Validation basique
        if not data.get("name"):
            raise HTTPException(status_code=400, detail="Le nom de la recette est requis")
        
        if not data.get("ingredients"):
            raise HTTPException(status_code=400, detail="Les ingrédients sont requis")
        
        # Validation des pourcentages
        total_percentage = sum(ingredient["percentage"] for ingredient in data["ingredients"])
        if abs(total_percentage - 100) > 0.01:
            raise HTTPException(status_code=400, detail=f"La somme des pourcentages doit être égale à 100%. Actuellement: {total_percentage}%")
        
        # Charger les données existantes
        with filepath.open("r", encoding="utf-8") as f:
            existing_data = json.load(f)
        
        # Conserver created_at, ajouter updated_at
        data["created_at"] = existing_data.get("created_at")
        data["updated_at"] = datetime.now(timezone.utc).isoformat() + "Z"
        
        # Si le nom change, renommer le fichier
        if data["name"] != recipe_id:
            new_filepath = RATIONS_DIR / f"{data['name']}.json"
            if new_filepath.exists():
                raise HTTPException(status_code=409, detail="Une recette avec ce nom existe déjà")
            filepath.unlink()
            filepath = new_filepath
        
        # Sauvegarder
        with filepath.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return {"message": f"Recette '{data['name']}' modifiée avec succès."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la modification: {str(e)}")

# --- MIXING PROCESS ---

@app.post("/api/mix/start")
async def start_mix(request: Request):
    if mix_status["inProgress"]:
        raise HTTPException(status_code=400, detail="Un mélange est déjà en cours.")
    
    try:
        body = await request.json()
        recipe = body.get("recipe")
        total_weight = body.get("totalWeight", 0.0)
        
        if not recipe:
            raise HTTPException(status_code=400, detail="Recipe data is required.")
        if not total_weight or total_weight <= 0:
            raise HTTPException(status_code=400, detail="Total weight must be greater than 0.")
        
        # Update mix status
        session_start = datetime.now().isoformat()
        mix_status["inProgress"] = True
        mix_status["recipeID"] = recipe.get("name")
        mix_status["totalWeight"] = total_weight
        mix_status["sessionStart"] = session_start
        
        return {
            "message": "Mélange démarré avec succès.",
            "recipe": recipe,
            "totalWeight": total_weight,
            "status": "started",
            "sessionId": session_start
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid JSON data.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du démarrage: {str(e)}")

@app.post("/api/mix/stop")
async def stop_mix():
    global weight
    
    if not mix_status["inProgress"]:
        raise HTTPException(status_code=400, detail="Aucun mélange en cours.")
    
    try:
        # Capture current mix info
        current_recipe_id = mix_status["recipeID"]
        current_total_weight = mix_status["totalWeight"]
        current_weight = weight
        session_start = mix_status.get("sessionStart")
        completion_percentage = (current_weight / current_total_weight * 100) if current_total_weight > 0 else 0
        
        # Trouver la recette pour mettre à jour les ressources
        recipe_filepath = RATIONS_DIR / f"{current_recipe_id}.json"
        if recipe_filepath.exists():
            with recipe_filepath.open("r", encoding="utf-8") as f:
                recipe = json.load(f)
            update_resource_usage(recipe, current_total_weight, completion_percentage)
        
        # Stop mix
        mix_status["inProgress"] = False
        mix_status["recipeID"] = None
        mix_status["totalWeight"] = 0.0
        mix_status["sessionStart"] = None
        weight = 0.0
        
        return {
            "message": "Mélange arrêté avec succès.",
            "completionPercentage": round(completion_percentage, 2),
            "finalWeight": current_weight
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'arrêt: {str(e)}")

@app.get("/api/mix/status")
async def get_mix_status():
    try:
        return {
            "inProgress": mix_status["inProgress"],
            "totalWeight": mix_status["totalWeight"],
            "recipeID": mix_status["recipeID"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération du statut: {str(e)}")

# --- MOTORS MANUAL START/STOP ---

@app.post("/api/motor/corn/toggle")
async def toggle_corn_motor():
    try:
        motor_state["corn"] = not motor_state["corn"]
        return {"message": f"Corn motor {'started' if motor_state['corn'] else 'stopped'}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du basculement du moteur: {str(e)}")

@app.post("/api/motor/alfalfa/toggle")
async def toggle_alfalfa_motor():
    try:
        motor_state["alfalfa"] = not motor_state["alfalfa"]
        return {"message": f"Alfalfa motor {'started' if motor_state['alfalfa'] else 'stopped'}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du basculement du moteur: {str(e)}")

@app.post("/api/motor/all/start")
async def start_all_motors():
    try:
        motor_state["corn"] = True
        motor_state["alfalfa"] = True
        return {"message": "All motors started."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du démarrage des moteurs: {str(e)}")

@app.post("/api/motor/all/stop")
async def stop_all_motors():
    try:
        motor_state["corn"] = False
        motor_state["alfalfa"] = False
        return {"message": "All motors stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'arrêt des moteurs: {str(e)}")

# --- MOTORS STATUS ---

@app.get("/api/motor/status")
async def get_motor_status():
    try:
        return {
            "corn": motor_state["corn"],
            "alfalfa": motor_state["alfalfa"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération du statut des moteurs: {str(e)}")

# --- LIVE WEIGHT FROM FT-111 ---

@app.get("/api/weight")
async def get_live_weight():
    global weight
    try:
        # Simulation of live weight reading
        increment = random.uniform(10.0, 20.0)
        weight += increment

        if weight >= mix_status["totalWeight"]:
            weight = mix_status["totalWeight"]

        result = {
            "value": round(weight, 1),
            "unit": "kg",
            "stable": random.choices([True, False], weights=[0.8, 0.2])[0]
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la lecture du poids: {str(e)}")

# --- RESOURCE USAGE LOGS ---
@app.get("/api/logs")
async def get_logs():
    """Récupère les données de resource usage"""
    try:
        usage_data = load_resource_usage()
        return {
            "resource_usage": usage_data,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des données: {str(e)}")