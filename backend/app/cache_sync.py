import os
import glob
from app.cache_manager import cache_manager

async def sync_cache_to_storage(local_cache_dir: str):
    """Upload new cache files to Supabase storage"""
    # Get all cache files
    cache_files = glob.glob(os.path.join(local_cache_dir, '**/*'), recursive=True)
    
    for file_path in cache_files:
        if os.path.isfile(file_path):
            # Get relative path for storage
            relative_path = os.path.relpath(file_path, local_cache_dir)
            # Upload file
            await cache_manager.upload_file(file_path, relative_path)

async def sync_cache_from_storage(local_cache_dir: str):
    """Download cache files from Supabase storage"""
    try:
        # List all files in the bucket
        files = cache_manager.supabase.storage.from_(cache_manager.bucket_name).list()
        
        for file in files:
            # Download each file
            destination = os.path.join(local_cache_dir, file['name'])
            await cache_manager.download_file(file['name'], destination)
    except Exception as e:
        print(f"Error syncing from storage: {e}")

async def get_cache_url(file_path: str) -> str:
    """Get public URL for a cache file"""
    return cache_manager.get_public_url(file_path) 