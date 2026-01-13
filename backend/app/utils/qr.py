from decimal import Decimal


def build_spayd(
    account: str,
    amount: Decimal,
    currency: str,
    variable_symbol: str,
    message: str,
) -> str:
    amount_str = f"{amount:.2f}"
    parts = [
        "SPD*1.0",
        f"ACC:{account}",
        f"AM:{amount_str}",
        f"CC:{currency}",
    ]
    if variable_symbol:
        parts.append(f"X-VS:{variable_symbol}")
    if message:
        parts.append(f"MSG:{message}")
    return "*".join(parts)
