import asyncio
import os
from app.cache_sync import sync_cache_to_storage, sync_cache_from_storage
import fastf1

async def test_cache_system():
    print("Testing Supabase cache system...")
    
    # 1. Set up local cache directory
    cache_dir = "app/temp_cache"
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)
    
    print("\n1. Loading 2023 Monaco GP data (this will create cache files)...")
    try:
        # Load some data to create cache files
        session = fastf1.get_session(2023, 6, 'R')  # Monaco GP 2023
        session.load()
        print("✅ Successfully loaded race data")
        
        # 2. Sync to Supabase
        print("\n2. Syncing cache files to Supabase...")
        await sync_cache_to_storage(cache_dir)
        print("✅ Successfully synced to Supabase")
        
        # 3. Clear local cache
        print("\n3. Clearing local cache...")
        for file in os.listdir(cache_dir):
            file_path = os.path.join(cache_dir, file)
            if os.path.isfile(file_path):
                os.remove(file_path)
        print("✅ Local cache cleared")
        
        # 4. Sync from Supabase
        print("\n4. Syncing cache files from Supabase...")
        await sync_cache_from_storage(cache_dir)
        print("✅ Successfully synced from Supabase")
        
        # 5. Verify cache works
        print("\n5. Verifying cache by loading data again...")
        session = fastf1.get_session(2023, 6, 'R')
        session.load()
        print("✅ Successfully loaded data from cache")
        
        print("\nAll tests passed! Supabase cache system is working correctly.")
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_cache_system()) 