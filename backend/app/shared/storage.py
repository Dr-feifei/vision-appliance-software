from pathlib import Path
from .errors import Error

def controlled_path(config, area, key):
    base = (config.var_root / area).resolve()
    path = (base / key).resolve()
    if path == base or base not in path.parents:
        raise Error(400,'invalid_storage_key','媒体位置无效。')
    return path
