from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import fastf1
from app.routers import races
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure FastF1 cache
cache_dir = os.getenv('FF1_CACHE_DIR', 'cache')
fastf1.Cache.enable_cache(cache_dir)

app = FastAPI(
    title="F1 Race Search API",
    description="API for searching and analyzing Formula 1 race data",
    version="1.0.0"
)

# Configure CORS
allowed_origins = [
    "http://localhost:3000",  # Local development
    "http://localhost:5000",  # Local development alternative
    os.getenv("FRONTEND_URL", ""),  # Production frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(races.router)

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "F1 Race Search API is running"} 