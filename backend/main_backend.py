from fastapi import FastAPI,HTTPException,Request
from pathlib import Path
import json
from datetime import datetime, timezone
from fastapi.middleware.cors import CORSMiddleware
import random

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
weight = {"value": 0.0}

# Simulated motor state
motor_state = {
    "corn": False,
    "alfalfa": False
}

# Simulated mix status + recipe if mix
mix_status = {
    "in_progress": False,
    "final_weight": 0.0,
    "recipe": None
}

# A l'intialisation on check si les moteurs sont en marche

# --- RECIPES ---

@app.get("/api/recipes")
async def list_recipes():
    recipes = []
    for file in RATIONS_DIR.glob("*.json"):
        with file.open("r", encoding="utf-8") as f:
            data = json.load(f)
            recipes.append(data)
    return recipes

@app.get("/api/recipes/{name}")
async def get_recipe(name: str):
    filepath = RATIONS_DIR / f"{name}.json"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Recette non trouvée")
    with filepath.open("r", encoding="utf-8") as f:
        return json.load(f)
    
@app.delete("/api/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    filepath = RATIONS_DIR / f"{recipe_id}.json"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Recette non trouvée")
    
    filepath.unlink()  # Supprime le fichier
    return {"message": f"Recette '{recipe_id}' supprimée avec succès."}

@app.post("/api/recipes")
async def create_recipe(request: Request):
    data = await request.json()
    
    # Validation basique
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Le nom de la recette est requis")
    
    if not data.get("ingredients"):
        raise HTTPException(status_code=400, detail="Les ingrédients sont requis")
    
    # Validation des pourcentages
    total_percentage = 0
    for ingredient in data["ingredients"]:
        if "percentage" not in ingredient:
            raise HTTPException(status_code=400, detail="Chaque ingrédient doit avoir un pourcentage")
        total_percentage += ingredient["percentage"]
    
    if abs(total_percentage - 100) > 0.01:
        raise HTTPException(
            status_code=400, 
            detail=f"La somme des pourcentages doit être égale à 100%. Actuellement: {total_percentage}%"
        )
    
    # Ajouter timestamp si pas présent
    if "created_at" not in data:
        data["created_at"] = data["created_at"] = datetime.now(timezone.utc).isoformat() + "Z"
    
    # Vérifier si la recette existe déjà
    filepath = RATIONS_DIR / f"{data['name']}.json"
    if filepath.exists():
        raise HTTPException(status_code=409, detail="Une recette avec ce nom existe déjà")
    
    # Sauvegarder dans un fichier JSON
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return {"message": f"Recette '{data['name']}' ajoutée avec succès."}

@app.put("/api/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, request: Request):
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
    total_percentage = 0
    for ingredient in data["ingredients"]:
        if "percentage" not in ingredient:
            raise HTTPException(status_code=400, detail="Chaque ingrédient doit avoir un pourcentage")
        total_percentage += ingredient["percentage"]
    
    if abs(total_percentage - 100) > 0.01:
        raise HTTPException(
            status_code=400, 
            detail=f"La somme des pourcentages doit être égale à 100%. Actuellement: {total_percentage}%"
        )
    
    # Charger les données existantes pour conserver created_at
    with filepath.open("r", encoding="utf-8") as f:
        existing_data = json.load(f)
    
    # Conserver la date de création, ajouter date de mise à jour
    data["created_at"] = existing_data.get("created_at")
    data["updated_at"] = datetime.now(timezone.utc).isoformat() + "Z"
    
    # Si le nom change, renommer le fichier
    if data["name"] != recipe_id:
        new_filepath = RATIONS_DIR / f"{data['name']}.json"
        if new_filepath.exists():
            raise HTTPException(status_code=409, detail="Une recette avec ce nom existe déjà")
        filepath.unlink()  # Supprimer l'ancien fichier
        filepath = new_filepath
    
    # Sauvegarder les données mises à jour
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return {"message": f"Recette '{data['name']}' modifiée avec succès."}


# --- MIXING PROCESS ---

@app.post("/api/mix/start")
async def start_mix():
    pass

@app.post("/api/mix/stop")
async def stop_mix():
    pass

@app.get("/api/mix/status")
async def get_mix_status():
    pass

# --- MOTORS MANUAL START/STOP ---

@app.post("/api/motor/corn/toggle")
async def toggle_corn_motor():
    motor_state["corn"] = not motor_state["corn"]
    return {
        "message": f"Corn motor {'started' if motor_state['corn'] else 'stopped'}."
    }
@app.post("/api/motor/alfalfa/toggle")
async def toggle_alfalfa_motor():
    motor_state["alfalfa"] = not motor_state["alfalfa"]
    return {
        "message": f"Alfalfa motor {'started' if motor_state['alfalfa'] else 'stopped'}."
    }

@app.post("/api/motor/all/start")
async def stop_all_motors():
    motor_state["corn"] = True
    motor_state["alfalfa"] = True
    return {"message": "All motors started."}

@app.post("/api/motor/all/stop")
async def stop_all_motors():
    motor_state["corn"] = False
    motor_state["alfalfa"] = False
    return {"message": "All motors stopped."}

# --- MOTORS STATUS ---

@app.get("/api/motor/status")
async def get_motor_status():
    return {
        "corn": motor_state["corn"],
        "alfalfa": motor_state["alfalfa"]
    }

# --- LIVE WEIGHT FROM FT-111 ---

@app.get("/api/weight")
async def get_live_weight():
    # Simulation of live weight reading
    increment = random.uniform(0.0, 1.0)
    weight["value"] += increment

    if weight["value"] > 2000:
        weight["value"] = 2000.0

    return {
        "value": round(weight["value"], 1),
        "unit": "kg",
        "stable": random.choices([True, False], weights=[0.8, 0.2])[0]
    }


# --- LOGS ---

@app.get("/api/logs")
async def list_logs():
    pass

