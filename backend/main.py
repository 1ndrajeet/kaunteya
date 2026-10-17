from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from schemas import HealthResponse, RootResponse
from utils import get_utc_now_iso

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Hackathon starter FastAPI backend service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=RootResponse, tags=["General"])
async def root() -> RootResponse:
    """Service root endpoint returning basic API metadata."""
    return RootResponse(
        message=f"Welcome to {settings.app_name}",
        docs_url="/docs",
        health_url="/health",
    )


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health() -> HealthResponse:
    """Health check endpoint for monitoring service status."""
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.app_env,
        timestamp=get_utc_now_iso(),
        version="0.1.0",
    )
