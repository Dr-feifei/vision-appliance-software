"""Initial foundation schema, frozen for reproducible migrations."""
from alembic import op
import sqlalchemy as sa
revision = '0001_foundation'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('jobs',
        sa.Column('id', sa.String(), primary_key=True, nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('source_id', sa.String(), nullable=False),
        sa.Column('upload_id', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('lease_owner', sa.String(), nullable=True),
        sa.Column('lease_until', sa.Float(), nullable=True),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
    )
    op.create_table('logs',
        sa.Column('id', sa.String(), primary_key=True, nullable=False),
        sa.Column('occurred_at', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('module', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
    )
    op.create_table('notifications',
        sa.Column('sequence', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('event_id', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('occurred_at', sa.String(), nullable=False),
        sa.Column('aggregate_id', sa.String(), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=False),
    )
    op.create_table('sessions',
        sa.Column('token_hash', sa.String(), primary_key=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('csrf_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.String(), nullable=False),
    )
    op.create_table('settings',
        sa.Column('section', sa.String(), primary_key=True, nullable=False),
        sa.Column('values', sa.JSON(), nullable=False),
        sa.Column('row_version', sa.Integer(), nullable=False),
    )
    op.create_table('sources',
        sa.Column('id', sa.String(), primary_key=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('updated_at', sa.String(), nullable=False),
        sa.Column('row_version', sa.Integer(), nullable=False),
        sa.Column('observed_at', sa.String(), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('credentials', sa.Text(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('fps', sa.Float(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('sha256', sa.String(), nullable=True),
        sa.Column('media_key', sa.String(), nullable=True),
        sa.Column('thumbnail_key', sa.String(), nullable=True),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('archived', sa.Boolean(), nullable=False),
    )
    op.create_table('uploads',
        sa.Column('id', sa.String(), primary_key=True, nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('received_bytes', sa.Integer(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('chunks', sa.JSON(), nullable=False),
        sa.Column('source_id', sa.String(), nullable=True),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
    )
    op.create_table('users',
        sa.Column('id', sa.String(), primary_key=True, nullable=False),
        sa.Column('username', sa.String(), nullable=False, unique=True),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
    )
    op.create_table('workers',
        sa.Column('id', sa.String(), primary_key=True, nullable=False),
        sa.Column('heartbeat_at', sa.Float(), nullable=False),
        sa.Column('pid', sa.Integer(), nullable=False),
    )

def downgrade():
    op.drop_table('workers')
    op.drop_table('users')
    op.drop_table('uploads')
    op.drop_table('sources')
    op.drop_table('settings')
    op.drop_table('sessions')
    op.drop_table('notifications')
    op.drop_table('logs')
    op.drop_table('jobs')
