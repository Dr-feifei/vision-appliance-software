from alembic import context

def run():
    connection = context.config.attributes.get('connection')
    if connection is None:
        from app.shared.config import Config
        from app.shared.db import make_engine
        config = Config()
        config.prepare()
        with make_engine(config).begin() as connection:
            context.configure(connection=connection)
            with context.begin_transaction():
                context.run_migrations()
    else:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()

run()
