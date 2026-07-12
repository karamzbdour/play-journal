# Play-Journal

> **Why just read your journal entries when you can play them?**

Play-Journal is an interactive diary app that turns your daily entries into custom, 2D games, tailored to your mood and the contents of your entry.
---

## Key Features

- **Interactive Chronicle:** Turn your daily text journal logs into playable, 2D fantasy dungeon crawling experiences in real time.
- **Dynamic Mood Visualization:** Experientially feel your diary entry with custom tints, visual vignette effects, speeds, rules, and background music matching your mood.
- **Themed Fantasy Book Interface:** A gorgeous, medieval book-themed diary UI complete with leather overlays, realistic page layouts, and animated brand graphics.
- **Custom Character Sprite Crawl:** Play with dynamic custom weapons, collectible items, and combat entities generated automatically to fit the themes in your logs.
- **Secure Chronicles:** Write and play privately with protected routes and personalized game configs linked to your user account.

---

## Technical Implementation Details

- **FastAPI & Gemini AI Pipeline:** Processes journal entries using the modern `google-genai` SDK with Structured Outputs to parse logs into type-validated `GameConfig` parameters.
- **Supabase & LLM Selection:** Queries the `game_assets` database metadata table and injects available assets into the Gemini context window so the model can mix-and-match WebP spritesheets.
- **Phaser 3 Engine Asset Loading:** Hooks into the scene lifecycle, preloads selected public asset URLs from Supabase Storage dynamically, and renders `Phaser.GameObjects.Sprite` classes in place of basic shapes.
- **Next.js Frontend & Transitions:** Built with Next.js App Router and Tailwind CSS, leveraging custom CSS animations (`::before` slides) for micro-interactions.
- **JWT Authentication Guard:** Secures both REST API and Next.js page routes by validating bearer tokens using the project's HS256 JWT Secret.
- **CLI Asset Uploader:** A Python CLI tool (`upload_asset.py`) that manages storage uploads to the public `sprites` bucket and inserts matching database rows.

---

## Tech Stack

### Frontend
- **Framework:** Next.js (App Router, Tailwind CSS, TypeScript)
- **Game Engine:** Phaser 3 (HTML5 Canvas/WebGL game framework)
- **Database Client:** Supabase JS Client

### Backend
- **Framework:** FastAPI (Python 3.10+, Uvicorn)
- **AI Core:** Google GenAI SDK (Gemini API with Structured JSON Outputs)
- **Database Client:** Supabase Python Client

---

## Repository Structure

```
├── backend/
│   ├── main.py            # FastAPI main router, endpoints, and schemas
│   ├── auth.py            # JWT token validation and custom dependencies
│   ├── database.py        # Supabase client instantiation
│   ├── upload_asset.py    # CLI tool to register and upload spritesheets
│   ├── run.py             # Server bootstrapper script
│   └── requirements.txt   # Backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js pages (play, journal, account, login)
│   │   ├── components/    # UI elements (Tome pages, navigation bar)
│   │   ├── game/          # Phaser configurations, entities (Player, Enemy), and scenes
│   │   ├── lib/           # Auth helpers, formatting, and database wrappers
│   │   └── types/         # TypeScript interface definitions (GameConfig)
```

---

## Setting Up


### 1. Backend Setup (FastAPI)

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file inside the `backend` folder:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_JWT_SECRET=your_supabase_jwt_secret
   GEMINI_API_KEY=your_gemini_api_key
   ```
5. Run the server:
   ```bash
   python run.py
   ```

---

### 2. Frontend Setup (Next.js)

1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file inside the `frontend` folder:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`.

---

## Importing Spritesheets into the Game

If you find or create a new spritesheet (using standard 32x32px frames, WebP format):

1. Put the file in your directory and run the uploader CLI:
   ```bash
   .venv\Scripts\python upload_asset.py --file path/to/enemy.webp --name "Skeleton Warrior" --description "A scary skeleton wearing iron armor and carrying a rusty shield" --type enemy --tags skeleton,undead,armored
   ```
2. Open the UI, log a themed journal entry (e.g., *"Felt a chill down my spine like walking through a graveyard..."*).
3. The backend Gemini LLM will automatically matching-select the **Skeleton Warrior** from your database, and your Phaser engine will load and display it in real time!
