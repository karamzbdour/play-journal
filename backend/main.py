import asyncio
import random
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Play-Journal API",
    description="Backend service that analyzes journal entries and configures custom Phaser games.",
    version="1.0.0"
)

# Enable CORS for the Next.js frontend (default port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---

class JournalEntry(BaseModel):
    text: str

class Achievement(BaseModel):
    id: str
    title: str
    description: str
    points: int

class GameConfig(BaseModel):
    theme_id: str
    theme_name: str
    background_color: str
    player_sprite: str
    player_color: str
    player_speed: int
    collectible_type: str
    collectible_color: str
    enemy_type: str
    enemy_color: str
    spawn_rate: int  # ms between spawns
    win_score: int
    mood: str
    game_rules: str
    achievements: List[Achievement]

class ThemeInfo(BaseModel):
    id: str
    name: str
    description: str
    keywords: List[str]

# --- Static Metadata ---

AVAILABLE_THEMES = [
    ThemeInfo(
        id="coder_coffee",
        name="Coder's Coffee Chase",
        description="A high-intensity coding sprint! Collect hot cups of coffee to keep your energy up while dodging bugs, compilation errors, and crash warnings.",
        keywords=["productive", "work", "code", "coding", "study", "focus", "programming", "laptop", "office"]
    ),
    ThemeInfo(
        id="party_star",
        name="Party Star Dash",
        description="A joyful celebration! Float through the clouds collecting stars, balloons, and confetti while avoiding popping needles and storm clouds.",
        keywords=["happy", "fun", "party", "celebrate", "friends", "joy", "awesome", "excited", "birthday", "dance"]
    ),
    ThemeInfo(
        id="rainy_day",
        name="Rainy Day Shelter",
        description="A cozy, reflective adventure. Gather warm umbrellas and steaming mugs of tea while avoiding heavy raindrops and lightning bolts.",
        keywords=["sad", "rain", "tired", "stressed", "exhausted", "anxious", "rest", "cozy", "sleep", "storm"]
    ),
    ThemeInfo(
        id="daily_quest",
        name="Daily Quest",
        description="A balanced path. Move forward collecting glowing crystals and gems while leaping over solid obstacle blocks and time holes.",
        keywords=[]
    )
]

# --- Helper Logic ---

def analyze_journal(text: str) -> GameConfig:
    text_lower = text.lower()
    
    # 1. Determine theme based on keyword match
    selected_theme_id = "daily_quest"
    for theme in AVAILABLE_THEMES:
        if any(keyword in text_lower for keyword in theme.keywords):
            selected_theme_id = theme.id
            break

    # 2. Build the appropriate Phaser Game Configuration
    if selected_theme_id == "coder_coffee":
        return GameConfig(
            theme_id="coder_coffee",
            theme_name="Coder's Coffee Chase",
            background_color="#0f172a",  # slate-900
            player_sprite="programmer",
            player_color="#38bdf8",      # sky-400
            player_speed=350,
            collectible_type="coffee",
            collectible_color="#b45309", # amber-700
            enemy_type="bug",
            enemy_color="#ef4444",       # red-500
            spawn_rate=1200,
            win_score=10,
            mood="productive",
            game_rules="Use the ARROW keys or WASD to move. Catch the coffee cups (+1 point) and avoid the red bugs (-1 point or collision). Reach 10 points to deploy your build!",
            achievements=[
                Achievement(id="caffeine_rush", title="Caffeine Addict", description="Collect 5 coffee cups in a row", points=50),
                Achievement(id="bug_squasher", title="Senior Engineer", description="Win the game with 0 bugs hit", points=100),
                Achievement(id="quick_deploy", title="CI/CD Master", description="Complete the game in under 20 seconds", points=75),
            ]
        )
    elif selected_theme_id == "party_star":
        return GameConfig(
            theme_id="party_star",
            theme_name="Party Star Dash",
            background_color="#1e1b4b",  # indigo-950
            player_sprite="star_catcher",
            player_color="#fcd34d",      # amber-300
            player_speed=400,
            collectible_type="star",
            collectible_color="#a855f7", # purple-500
            enemy_type="needle",
            enemy_color="#ec4899",       # pink-500
            spawn_rate=1000,
            win_score=12,
            mood="happy",
            game_rules="Bounce across the screen to collect glowing stars (+1 point). Avoid falling needles that pop your balloons. Get 12 points to light up the dance floor!",
            achievements=[
                Achievement(id="superstar", title="Constellation", description="Collect 3 stars within 3 seconds", points=40),
                Achievement(id="invincible_party", title="Party Animal", description="Collect 10 stars without losing points", points=90),
                Achievement(id="dance_off", title="Dancing Queen", description="Complete the game", points=50)
            ]
        )
    elif selected_theme_id == "rainy_day":
        return GameConfig(
            theme_id="rainy_day",
            theme_name="Rainy Day Shelter",
            background_color="#172554",  # blue-950
            player_sprite="umbrella_carrier",
            player_color="#cbd5e1",      # slate-300
            player_speed=280,
            collectible_type="tea",
            collectible_color="#10b981", # emerald-500
            enemy_type="raindrop",
            enemy_color="#60a5fa",       # blue-400
            spawn_rate=1500,
            win_score=8,
            mood="reflective",
            game_rules="Take it slow. Move side-to-side to collect warm tea mugs (+1 point) while avoiding heavy raindrop hazards. Reach 8 points to find shelter and rest.",
            achievements=[
                Achievement(id="cozy_vibes", title="Zen Master", description="Stay still for 5 seconds without hitting raindrops", points=60),
                Achievement(id="tea_time", title="Earl Grey Enthusiast", description="Win the game", points=40),
                Achievement(id="rain_dodger", title="Dry & Happy", description="Win with 100% health", points=80)
            ]
        )
    else:  # daily_quest / default
        return GameConfig(
            theme_id="daily_quest",
            theme_name="Daily Quest Adventure",
            background_color="#022c22",  # emerald-950
            player_sprite="adventurer",
            player_color="#22c55e",      # green-500
            player_speed=320,
            collectible_type="gem",
            collectible_color="#eab308", # yellow-500
            enemy_type="obstacle",
            enemy_color="#d97706",       # amber-600
            spawn_rate=1400,
            win_score=10,
            mood="balanced",
            game_rules="Guide your adventurer to collect sparkling gems (+1 point). Avoid crashing into obstacle blocks. Reach 10 points to complete your daily log!",
            achievements=[
                Achievement(id="gem_collector", title="Gem Hoarder", description="Collect 8 gems", points=30),
                Achievement(id="adventure_time", title="Pathfinder", description="Complete the game", points=50),
                Achievement(id="perfect_run", title="Perfect Day", description="No hits taken", points=100)
            ]
        )

# --- Routes ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "Play-Journal API",
        "endpoints": {
            "REST": ["/api/themes", "/api/generate-game"],
            "WS": ["/ws/live-feed"]
        }
    }

@app.get("/api/themes", response_model=List[ThemeInfo])
def get_themes():
    return AVAILABLE_THEMES

@app.post("/api/generate-game", response_model=GameConfig)
def generate_game(entry: JournalEntry):
    # Process text and return dynamic Phaser configuration
    return analyze_journal(entry.text)

# --- WebSocket Setup ---

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/live-feed")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial connection success message
        await manager.send_personal_message(
            {"type": "info", "message": "WebSocket connection established! Simulated game feed active."}, 
            websocket
        )
        
        simulated_events = [
            {"type": "achievement", "achievement_id": "caffeine_rush", "message": "Achievement Unlocked: Caffeine Addict (+50 pts)!"},
            {"type": "achievement", "achievement_id": "bug_squasher", "message": "Achievement Unlocked: Senior Engineer (+100 pts)!"},
            {"type": "reward", "value": "Double Score Active!", "message": "Combo multiplier activated! Points x2."},
            {"type": "reward", "value": "Shield Active!", "message": "Power-up: Shield collected. Next damage blocked!"},
            {"type": "achievement", "achievement_id": "cozy_vibes", "message": "Achievement Unlocked: Zen Master (+60 pts)!"},
            {"type": "info", "message": "Daily streak bonus active! Keep journaling to gain multipliers."}
        ]
        
        while True:
            # We wait for the client to send a message, OR we stream random updates periodically.
            # To handle both, we use asyncio.sleep to check periodically and simulate streaming notifications.
            try:
                # Check for incoming client message with a timeout of 4 seconds.
                # If no message is received, we catch asyncio.TimeoutError and push an update.
                data = await asyncio.wait_for(websocket.receive_text(), timeout=4.0)
                # Client sent a ping or custom action
                await manager.send_personal_message(
                    {"type": "echo", "message": f"Client feedback received: '{data}'"},
                    websocket
                )
            except asyncio.TimeoutError:
                # Timeout occurred, so send a random simulated game achievement or tip
                event = random.choice(simulated_events)
                await manager.send_personal_message(event, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)
