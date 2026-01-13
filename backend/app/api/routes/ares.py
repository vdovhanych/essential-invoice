from fastapi import APIRouter, HTTPException

from app.services.ares import lookup_company

router = APIRouter(prefix="/ares", tags=["ares"])


@router.get("/{ico}")
async def get_company(ico: str) -> dict:
    try:
        return await lookup_company(ico)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="ARES lookup failed") from exc
