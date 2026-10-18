from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import APIKeyCookie
from sqlalchemy import select, func, text
from datetime import datetime, timedelta, timezone
import secrets
import hmac
from ..shared.db import get_db
from ..shared.models import User, Session, now, Log
from ..shared.security import password_hasher, digest
from argon2.exceptions import VerificationError
from ..shared.errors import Error
from ..schemas import Credentials, UserDTO

router = APIRouter(prefix='/auth', tags=['auth'])
session_cookie = APIKeyCookie(name='vision_session', auto_error=False)

def current_user(request: Request, token=Depends(session_cookie), db=Depends(get_db)):
    session = db.get(Session,digest(token)) if token else None
    if not session or session.expires_at <= now():
        raise Error(401,'authentication_required','请先登录。')
    user = db.get(User,session.user_id)
    if not user:
        raise Error(401,'authentication_required','会话已失效，请重新登录。')
    if request.method not in ('GET','HEAD','OPTIONS'):
        csrf = request.headers.get('x-csrf-token','')
        if not csrf or not hmac.compare_digest(session.csrf_hash,digest(csrf)):
            raise Error(403,'csrf_invalid','安全校验失败，请刷新页面重试。')
    return user

def writer(user=Depends(current_user)):
    if user.role not in ('admin','operator'):
        raise Error(403,'permission_denied','当前账户没有修改权限。')
    return user

def administrator(user=Depends(current_user)):
    if user.role != 'admin':
        raise Error(403,'permission_denied','此操作需要管理员权限。')
    return user

def set_session(request, response, db, user):
    from .settings import values_for
    minutes = values_for(db,'security')['session_timeout_minutes']
    token, csrf = secrets.token_urlsafe(40), secrets.token_urlsafe(32)
    db.add(Session(token_hash=digest(token),csrf_hash=digest(csrf),user_id=user.id,expires_at=(datetime.now(timezone.utc)+timedelta(minutes=minutes)).isoformat().replace('+00:00','Z')))
    options = dict(secure=request.app.state.config.cookie_secure,samesite='strict',max_age=minutes*60,path='/')
    response.set_cookie('vision_session',token,httponly=True,**options)
    response.set_cookie('vision_csrf',csrf,httponly=False,**options)

@router.get('/setup-status')
def setup_status(db=Depends(get_db)):
    return {'initialized':bool(db.scalar(select(func.count()).select_from(User)))}

@router.post('/setup', response_model=UserDTO)
def setup(body: Credentials, request: Request, response: Response, db=Depends(get_db)):
    if len(body.password)<12:
        raise Error(422,'password_too_short','密码至少为 12 个字符。')
    db.execute(text('BEGIN IMMEDIATE'))
    if db.scalar(select(func.count()).select_from(User)):
        raise Error(409,'already_initialized','管理员已初始化，请登录。')
    user = User(username=body.username,password_hash=password_hasher.hash(body.password),role='admin')
    db.add(user)
    db.flush()
    set_session(request,response,db,user)
    db.add(Log(level='INFO',module='auth',message='首次管理员初始化完成。'))
    return user

@router.post('/login', response_model=UserDTO)
def login(body: Credentials, request: Request, response: Response, db=Depends(get_db)):
    request.app.state.login_guard.check(request.client.host if request.client else 'unknown')
    user = db.scalar(select(User).where(User.username==body.username))
    try:
        valid = user is not None and password_hasher.verify(user.password_hash,body.password)
    except VerificationError:
        valid = False
    if not valid:
        raise Error(401,'invalid_credentials','用户名或密码不正确。')
    set_session(request,response,db,user)
    return user

@router.get('/me', response_model=UserDTO)
def me(user=Depends(current_user)):
    return user

@router.post('/logout',status_code=204)
def logout(request: Request,response:Response,user=Depends(current_user),db=Depends(get_db)):
    session = db.get(Session,digest(request.cookies['vision_session']))
    db.delete(session)
    response.delete_cookie('vision_session',path='/')
    response.delete_cookie('vision_csrf',path='/')
