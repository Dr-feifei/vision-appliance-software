from pathlib import Path
from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from alembic.config import Config as AlembicConfig
from alembic import command

def make_engine(config):
    engine = create_engine(config.database_url, connect_args={'check_same_thread':False, 'timeout':30})
    @event.listens_for(engine, 'connect')
    def sqlite_config(connection, _):
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('PRAGMA busy_timeout=30000')
        connection.execute('PRAGMA foreign_keys=ON')
    return engine

def migrate(engine):
    config = AlembicConfig()
    config.set_main_option('script_location', str(Path(__file__).resolve().parents[2] / 'alembic'))
    with engine.begin() as connection:
        config.attributes['connection'] = connection
        command.upgrade(config, 'head')

def session_factory(engine):
    return sessionmaker(engine, expire_on_commit=False)

def get_db(request: Request):
    with request.app.state.sessions() as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
