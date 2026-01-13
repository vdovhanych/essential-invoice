import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional

AMOUNT_RE = re.compile(r"částku\s+([\d\s]+,\d{2})\s+CZK", re.IGNORECASE)
VS_RE = re.compile(r"Variabilní symbol:\s*(\d+)")
SENDER_RE = re.compile(r"Příchozí úhrada z účtu\s+(.+?)\s+číslo", re.IGNORECASE)
MESSAGE_RE = re.compile(r"Zpráva pro příjemce:\s*(.+)")
DATE_RE = re.compile(r"Datum zaúčtování:\s*(\d{2}\.\d{2}\.\d{4})")
CODE_RE = re.compile(r"Kód transakce:\s*(\d+)")


@dataclass
class ParsedPayment:
    amount: Decimal
    variable_symbol: Optional[str]
    sender: Optional[str]
    message: Optional[str]
    booked_date: Optional[datetime]
    transaction_code: Optional[str]


def parse_airbank_email(text: str) -> Optional[ParsedPayment]:
    if "se snížil o částku" in text:
        return None

    amount_match = AMOUNT_RE.search(text)
    if not amount_match:
        return None

    amount_raw = amount_match.group(1).replace(" ", "").replace(",", ".")
    amount = Decimal(amount_raw)

    vs_match = VS_RE.search(text)
    sender_match = SENDER_RE.search(text)
    message_match = MESSAGE_RE.search(text)
    date_match = DATE_RE.search(text)
    code_match = CODE_RE.search(text)

    booked_date = None
    if date_match:
        booked_date = datetime.strptime(date_match.group(1), "%d.%m.%Y")

    return ParsedPayment(
        amount=amount,
        variable_symbol=vs_match.group(1) if vs_match else None,
        sender=sender_match.group(1) if sender_match else None,
        message=message_match.group(1) if message_match else None,
        booked_date=booked_date,
        transaction_code=code_match.group(1) if code_match else None,
    )
