"""FoodGo API. Chạy: uv run uvicorn app.main:app --port 8000"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import admin, public
from .recsys.engine import Engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = Engine()
    yield


app = FastAPI(title="FoodGo API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(public.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"ok": True}
