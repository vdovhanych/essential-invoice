from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.services.ares import lookup_company

router = APIRouter(prefix="/ares", tags=["ares"])


@router.get("/{ico}")
async def get_company(ico: str, _=Depends(get_current_user)) -> dict:
    try:
        return await lookup_company(ico)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="ARES lookup failed") from exc
