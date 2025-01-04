import fastf1
import logging
from pathlib import Path
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure FastF1 cache
CACHE_DIR = Path(__file__).parent / "fastf1_cache"
CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

def initialize_cache():
    """Initialize FastF1 cache with Saudi Arabian GP 2024"""
    try:
        logger.info("Loading 2024 Saudi Arabian GP data...")
        
        # Load Saudi Arabian GP (Round 2)
        logger.info("Caching Saudi Arabian GP sessions...")
        race = fastf1.get_session(2024, 2, 'R')
        race.load()  # This will cache the full session data
        
        quali = fastf1.get_session(2024, 2, 'Q')
        quali.load()  # This will cache the full session data
        
        logger.info("Successfully cached Saudi Arabian GP sessions")
        
    except Exception as e:
        logger.error(f"Error caching race data: {str(e)}")

if __name__ == "__main__":
    initialize_cache() 