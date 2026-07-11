import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    # We do not crash the application immediately, but we warning log.
    # When routes needing supabase are called, they will raise an appropriate exception.
    import logging
    logger = logging.getLogger("uvicorn.error")
    logger.warning("SUPABASE_URL or SUPABASE_ANON_KEY is not set in environment variables.")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def get_supabase_client() -> Client:
    if not supabase:
        raise ValueError("Supabase client is not initialized. Check your environment variables.")
    return supabase
