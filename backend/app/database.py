from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
)


def _sqlite_secure_delete(dbapi_conn, _record) -> None:
    # Deleted rows (a revoked or replaced provider key's ciphertext) are zeroed in
    # the file instead of left in free pages. Per connection, so set on connect.
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA secure_delete=ON")
    cur.close()


if engine.dialect.name == "sqlite":
    event.listen(engine.sync_engine, "connect", _sqlite_secure_delete)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
