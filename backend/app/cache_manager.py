import os
import json
from pathlib import Path

class CacheManager:
    def __init__(self):
        self.cache_dir = Path("app/cache")
        self._ensure_cache_dir_exists()

    def _ensure_cache_dir_exists(self):
        """Ensure the cache directory exists"""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        print("✅ Cache directory ready")

    async def get_cached_data(self, key: str, ttl: int = 3600):
        """Get data from file system cache"""
        try:
            cache_file = self.cache_dir / f"{key}.json"
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    return json.load(f)
            return None
        except Exception as e:
            print(f"Cache read error: {e}")
            return None

    async def set_cached_data(self, key: str, data: dict, ttl: int = 3600):
        """Set data in file system cache"""
        try:
            cache_file = self.cache_dir / f"{key}.json"
            with open(cache_file, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            print(f"Cache write error: {e}")

# Create a singleton instance
cache_manager = CacheManager() 