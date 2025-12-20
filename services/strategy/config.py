import os
from typing import List

from pydantic import BaseModel, Field


class Settings(BaseModel):
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    database_url: str = Field(default="", alias="DATABASE_URL")
    symbols: List[str] = Field(default_factory=list, alias="SYMBOLS")
    strategy_name: str = Field(default="moving_average_cross", alias="STRATEGY_NAME")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    enable_http: bool = Field(default=False, alias="ENABLE_HTTP")
    http_port: int = Field(default=8000, alias="HTTP_PORT")

    class Config:
        populate_by_name = True
        extra = "ignore"


def load_settings() -> Settings:
    # Split SYMBOLS by comma if present
    raw_symbols = os.getenv("SYMBOLS", "")
    parsed_symbols = [s.strip() for s in raw_symbols.split(",") if s.strip()]
    data = {
        "REDIS_URL": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        "DATABASE_URL": os.getenv("DATABASE_URL", ""),
        "SYMBOLS": parsed_symbols,
        "STRATEGY_NAME": os.getenv("STRATEGY_NAME", "moving_average_cross"),
        "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
        "ENABLE_HTTP": os.getenv("ENABLE_HTTP", "false").lower() == "true",
        "HTTP_PORT": int(os.getenv("HTTP_PORT", "8000")),
    }
    return Settings(**data)

