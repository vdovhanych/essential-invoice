from typing import Any

import httpx

from app.core.config import settings


async def lookup_company(ico: str) -> dict[str, Any]:
    url = f"{settings.ares_base_url}/ekonomicke-subjekty/{ico}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()
