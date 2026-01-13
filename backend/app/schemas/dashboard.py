from typing import Dict

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_invoices: int
    total_outstanding: float
    by_status: Dict[str, int]
    open_payment_notifications: int
