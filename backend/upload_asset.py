import os
import argparse
import sys
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
# Use service role key if available for administrative writes, fallback to anon key
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

def main():
    parser = argparse.ArgumentParser(description="Upload game asset spritesheets to Supabase Storage and database.")
    parser.add_argument("--file", required=True, help="Path to the local WebP spritesheet file")
    parser.add_argument("--name", required=True, help="Name of the asset")
    parser.add_argument("--description", required=True, help="Detailed description of the asset (for LLM context)")
    parser.add_argument("--type", required=True, choices=["enemy", "collectible", "boss", "weapon", "pickup_item", "projectile"], help="Type of game asset")
    parser.add_argument("--tags", default="", help="Comma-separated list of tags")

    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set in .env")
        sys.exit(1)

    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Validate file existence
    if not os.path.exists(args.file):
        print(f"Error: File '{args.file}' does not exist.")
        sys.exit(1)

    # Generate unique storage path
    file_ext = os.path.splitext(args.file)[1].lower()
    if file_ext != ".webp":
        print("Warning: It is recommended to upload WebP files as specified by the project schema.")

    unique_filename = f"{uuid.uuid4()}{file_ext or '.webp'}"
    storage_path = f"{args.type}/{unique_filename}"

    print(f"Uploading '{args.file}' to storage bucket 'sprites' at '{storage_path}'...")
    try:
        with open(args.file, "rb") as f:
            supabase.storage.from_("sprites").upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "image/webp"}
            )
        print("✓ File uploaded to storage successfully.")
    except Exception as e:
        print(f"Error uploading file to storage: {e}")
        sys.exit(1)

    # Get public URL
    try:
        public_url = supabase.storage.from_("sprites").get_public_url(storage_path)
        print(f"Public URL: {public_url}")
    except Exception as e:
        print(f"Error generating public URL: {e}")
        sys.exit(1)

    # Insert metadata into public.game_assets
    tags_list = [t.strip() for t in args.tags.split(",") if t.strip()] if args.tags else []
    
    metadata = {
        "name": args.name,
        "description": args.description,
        "storage_path": public_url,  # Public URL is stored directly in storage_path
        "type": args.type,
        "tags": tags_list
    }

    print("Registering asset in public.game_assets database table...")
    try:
        res = supabase.table("game_assets").insert(metadata).execute()
        print("✓ Asset metadata registered in database successfully.")
        print(f"Registered record: {res.data}")
    except Exception as e:
        print(f"Error saving to database: {e}")
        print("Attempting to clean up uploaded storage file...")
        try:
            supabase.storage.from_("sprites").remove([storage_path])
            print("✓ Storage file cleaned up.")
        except Exception as cleanup_err:
            print(f"Failed to clean up storage file: {cleanup_err}")
        sys.exit(1)

    print("\nAsset load complete!")

if __name__ == "__main__":
    main()
