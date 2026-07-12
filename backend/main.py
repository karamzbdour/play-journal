import asyncio
import os
import random
import re
from typing import List, cast
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from google import genai
from google.genai import types
load_dotenv()

from auth import UserSignUp, UserSignIn, get_current_user
from database import get_supabase_client
from supabase_auth.types import SignUpWithEmailAndPasswordCredentials, SignInWithEmailAndPasswordCredentials


app = FastAPI(
    title="Play-Journal API",
    description="Backend service that analyzes journal entries using Gemini to configure custom Phaser games.",
    version="2.0.0"
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

class AssetSelection(BaseModel):
    type: str = Field(description="The asset type key, e.g. weapon, enemy, collectible, boss, pickup_item, projectile")
    url: str = Field(description="The public storage URL of the selected asset")

class GameConfig(BaseModel):
    theme_id: str
    theme_name: str
    background_color: str = Field(description="Background hex color, e.g. #0f172a")
    player_sprite: str
    player_speed: int = Field(ge=200, le=500, description="Player speed in pixels per second")
    collectible_type: str
    enemy_type: str
    enemy_color: str = Field(description="Enemy hex color, e.g. #ef4444")
    spawn_rate: int = Field(ge=500, le=3000, description="Spawn interval in milliseconds")
    win_score: int = Field(ge=3, le=20, description="Items needed to win the game")
    mood: str
    game_rules: List[str]
    levels : int
    bosses : List[str]
    weapon : str
    theme_song : str
    length_of_day : int = Field(ge=1, le=10, description="Length of the game in minutes")
    asset_urls: List[AssetSelection] = Field(default=[], description="List of public URLs of game assets selected for the game matching the journal theme")

    @field_validator("background_color", "enemy_color")
    @classmethod
    def validate_hex_colors(cls, v: str) -> str:
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError(f"Color {v} must be a valid 6-character hex color starting with '#'")
        return v

# --- Routes ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "Play-Journal API (Gemini-Powered)",
        "endpoints": {
            "REST": ["/api/generate-game"],
            "WS": ["/ws/live-feed"]
        }
    }

@app.post("/api/auth/signup")
def signup(user_data: UserSignUp):
    """
    Registers a new user in Supabase Auth.
    """
    supabase_client = get_supabase_client()
    try:
        options = {}
        if user_data.full_name:
            options["data"] = {"full_name": user_data.full_name}

        credentials = cast(
            SignUpWithEmailAndPasswordCredentials,
            {
                "email": user_data.email,
                "password": user_data.password,
                "options": options
            }
        )
        response = supabase_client.auth.sign_up(credentials)
        
        user = response.user
        session = response.session
        
        return {
            "message": "User registered successfully.",
            "user_id": user.id if user else None,
            "session_active": session is not None
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Registration failed: {str(e)}"
        )

@app.post("/api/auth/login")
def login(user_data: UserSignIn):
    """
    Authenticates a user with email and password in Supabase.
    Returns access and refresh tokens.
    """
    supabase_client = get_supabase_client()
    try:
        credentials = cast(
            SignInWithEmailAndPasswordCredentials,
            {
                "email": user_data.email,
                "password": user_data.password
            }
        )
        response = supabase_client.auth.sign_in_with_password(credentials)
        
        if not response.session or not response.user:
            raise HTTPException(
                status_code=400,
                detail="Authentication failed: No session or user returned."
            )
            
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "token_type": "bearer",
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Login failed: {str(e)}"
        )


@app.post("/api/generate-game", response_model=GameConfig)
def generate_game(entry: JournalEntry, current_user: dict = Depends(get_current_user)):
    # Ensure the Gemini API key is configured
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "GEMINI_API_KEY environment variable is not configured. "
                "Please create a `.env` file inside the `backend` folder containing "
                "`GEMINI_API_KEY=your_gemini_api_key` to activate the dynamic game pipeline."
            )
        )

    try:
        gemini_client = genai.Client()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize the Gemini client: {str(e)}"
        )

    # Clean the input text
    journal_text = entry.text.strip()
    if not journal_text:
        raise HTTPException(status_code=400, detail="Journal entry text cannot be empty.")

    # Fetch available assets from database
    try:
        supabase_client = get_supabase_client()
        assets_res = supabase_client.table("game_assets").select("name, description, storage_path, type, tags").execute()
        db_assets = cast(List[dict], assets_res.data or [])
    except Exception as e:
        # Fallback to empty if DB query fails
        print(f"Failed to fetch game_assets, continuing with no assets: {e}")
        db_assets = []

    assets_summary = "\n".join([
        f"- Type: {a['type']}, Name: {a['name']}, URL: {a['storage_path']}, Description: {a['description']}, Tags: {a['tags']}"
        for a in db_assets
    ])

    # Construct the prompt instructing Gemini on how to map the journal log to game parameters and choose matching assets
    prompt = f"""Analyse the following user's journal entry and translate it into a custom game configurations JSON:
"{journal_text}"

Available Game Assets:
{assets_summary}

Task: Choose exactly one asset from the available assets for each of the types that fit the theme (e.g. a matching weapon, enemy, collectible). List these in 'asset_urls' matching the type and its public URL. If no matching asset is found in the list for a type, do not include it. Make sure to mix and match them creatively to match the mood of the entry.
"""

    try:
        # Call Gemini using Structured Outputs
        response = gemini_client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GameConfig,
                system_instruction=(
                    "You are a game designer. Analyse user journals and output game configuration "
                    "JSON that strictly matches the schema parameters. Use appropriate color contrasts "
                    "and thematic entities."
                )
            ),
        )
        
        # Verify response text is present
        if not response.text:
            raise ValueError("Empty response received from the Gemini API model.")

        print(f"Gemini response JSON:\n{response.text}")

        # Parse and validate the response against the Pydantic schema
        game_config = GameConfig.model_validate_json(response.text)
        return game_config

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini pipeline failed to generate config: {str(e)}"
        )

# --- WebSocket Setup (commented out for now but may be needed for any persistent game features) ---

# class ConnectionManager:
#     def __init__(self):
#         self.active_connections: List[WebSocket] = []

#     async def connect(self, websocket: WebSocket):
#         await websocket.accept()
#         self.active_connections.append(websocket)

#     def disconnect(self, websocket: WebSocket):
#         self.active_connections.remove(websocket)

#     async def send_personal_message(self, message: dict, websocket: WebSocket):
#         await websocket.send_json(message)

# manager = ConnectionManager()

# @app.websocket("/ws/live-feed")
# async def websocket_endpoint(websocket: WebSocket):
#     await manager.connect(websocket)
#     try:
#         await manager.send_personal_message(
#             {"type": "info", "message": "WebSocket connection established! Simulated game feed active."}, 
#             websocket
#         )
        
#         simulated_events = [
#             {"type": "achievement", "achievement_id": "gemini_bonus", "message": "Achievement: Gemini Integrator (+100 pts)!"},
#             {"type": "reward", "value": "Double Score Active!", "message": "Combo multiplier activated! Points x2."},
#             {"type": "reward", "value": "Shield Active!", "message": "Power-up: Shield collected. Next damage blocked!"},
#             {"type": "achievement", "achievement_id": "streak_3day", "message": "Achievement: 3-Day Streak (+50 pts)!"},
#             {"type": "info", "message": "Dynamic achievements updated from Gemini pipeline."}
#         ]
        
#         while True:
#             try:
#                 data = await asyncio.wait_for(websocket.receive_text(), timeout=4.0)
#                 await manager.send_personal_message(
#                     {"type": "echo", "message": f"Client feedback received: '{data}'"},
#                     websocket
#                 )
#             except asyncio.TimeoutError:
#                 event = random.choice(simulated_events)
#                 await manager.send_personal_message(event, websocket)

#     except WebSocketDisconnect:
#         manager.disconnect(websocket)
#     except Exception:
#         manager.disconnect(websocket)
