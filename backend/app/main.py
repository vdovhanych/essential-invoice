from fastapi import FastAPI

from app.api.routes import ares, clients, invoices
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import client, email_log, invoice, invoice_item, payment, user

app = FastAPI(title=settings.app_name)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


app.include_router(clients.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(ares.router, prefix="/api")
