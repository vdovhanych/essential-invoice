from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["ui"])


@router.get("/ui", response_class=HTMLResponse)
def ui_index() -> HTMLResponse:
    html_path = Path(__file__).resolve().parents[2] / "ui" / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))
