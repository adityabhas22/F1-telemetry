from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import fastf1
import os
from app.routers import races
from app.cache_manager import CacheManager
import time
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure FastF1 cache with absolute path
cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')
os.makedirs(cache_dir, exist_ok=True)
fastf1.Cache.enable_cache(cache_dir)

# Initialize cache manager
cache_manager = CacheManager()

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        logger.info(f"Request to {request.url.path} took {process_time:.2f} seconds")
        return response

app = FastAPI(
    title="F1 Race Search API",
    description="API for searching and analyzing Formula 1 race data",
    version="1.0.0",
    docs_url="/docs" if os.getenv('ENVIRONMENT') != 'production' else None,
    redoc_url="/redoc" if os.getenv('ENVIRONMENT') != 'production' else None
)

# Add middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TimingMiddleware)

# Configure CORS with environment-specific settings
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Local development
    "https://f1-tracking.onrender.com",  # Production
    "https://f1-tracking-frontend.onrender.com"  # Production frontend
]

if ENVIRONMENT == 'development':
    ALLOWED_ORIGINS.append("http://localhost:*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(races.router)

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "F1 Race Search API is running",
        "cache_status": "connected" if cache_manager.redis.ping() else "disconnected",
        "environment": ENVIRONMENT
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error handler caught: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred",
            "path": request.url.path
        }
    ) 