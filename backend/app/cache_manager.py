from supabase import create_client, Client
import os
from dotenv import load_dotenv
import redis
import json
from fastapi import HTTPException
import pickle

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
REDIS_URL = os.getenv('REDIS_URL')

if not all([SUPABASE_URL, SUPABASE_KEY, REDIS_URL]):
    raise Exception("Missing required environment variables. Please check your .env file.")

class CacheManager:
    def __init__(self):
        self.bucket_name = "f1-cache"
        # Initialize Supabase client with service role key
        self.supabase: Client = create_client(
            supabase_url=SUPABASE_URL,
            supabase_key=SUPABASE_KEY
        )
        # Initialize Redis client
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        """Ensure the cache bucket exists"""
        try:
            self.supabase.storage.create_bucket(
                self.bucket_name,
                options={"public": True}
            )
            print("✅ Bucket created or already exists")
        except Exception as e:
            if 'already exists' not in str(e).lower():
                print(f"Error ensuring bucket exists: {e}")

    async def get_cached_data(self, key: str, ttl: int = 3600):
        """Get data from Redis cache"""
        try:
            data = self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            print(f"Redis error: {e}")
            return None

    async def set_cached_data(self, key: str, data: dict, ttl: int = 3600):
        """Set data in Redis cache"""
        try:
            self.redis.setex(key, ttl, json.dumps(data))
        except Exception as e:
            print(f"Redis error: {e}")

    async def upload_file(self, file_path: str, destination: str):
        """Upload a file to Supabase storage"""
        try:
            with open(file_path, 'rb') as f:
                self.supabase.storage.from_(self.bucket_name).upload(
                    path=destination,
                    file=f,
                    file_options={"cache-control": "public, max-age=31536000"}
                )
            print(f"✅ Uploaded {destination}")
            return True
        except Exception as e:
            if 'already exists' not in str(e).lower():
                print(f"Error uploading file: {e}")
            return False

    async def download_file(self, file_path: str, destination: str):
        """Download a file from Supabase storage"""
        try:
            # Check Redis cache first
            cached_data = await self.get_cached_data(f"file:{file_path}")
            if cached_data:
                return cached_data

            # If not in cache, download from Supabase
            data = self.supabase.storage.from_(self.bucket_name).download(file_path)
            
            # Cache the downloaded data
            await self.set_cached_data(f"file:{file_path}", data)
            
            return data
        except Exception as e:
            print(f"Error downloading file: {e}")
            return None

    def get_public_url(self, file_path: str) -> str:
        """Get public URL for a file"""
        try:
            return self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
        except Exception as e:
            print(f"Error getting public URL: {e}")
            return None

# Create a singleton instance
cache_manager = CacheManager() 