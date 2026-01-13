from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Essential Invoice"
    environment: str = "development"
    database_url: str = "postgresql+psycopg2://invoice:invoice@db:5432/invoice"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60 * 24

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from: str = ""

    imap_host: str = ""
    imap_port: int = 993
    imap_username: str = ""
    imap_password: str = ""
    imap_sender_pattern: str = "noreply@airbank.cz"
    imap_poll_interval_seconds: int = 300

    ares_base_url: str = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest"


settings = Settings()
