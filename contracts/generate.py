"""Export OpenAPI without touching the deployment database.
Run: .venv/Scripts/python contracts/generate.py
"""
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.main import create_app

if __name__=='__main__':
    with TemporaryDirectory(prefix='vision-contract-') as directory:
        app=create_app(var_root=directory,testing=True)
        schema=app.openapi()
        (ROOT/'contracts/openapi.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        app.state.engine.dispose()
    print('Exported contracts/openapi.json')
