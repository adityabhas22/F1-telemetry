from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import fastf1
from app.routers import races

# Configure FastF1 cache
fastf1.Cache.enable_cache('cache')

app = FastAPI(
    title="F1 Race Search API",
    description="API for searching and analyzing Formula 1 race data",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
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