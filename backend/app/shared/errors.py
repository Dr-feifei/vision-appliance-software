from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

class Error(Exception):
    def __init__(self, status, code, message, details=None, retryable=False):
        self.status, self.code, self.message = status, code, message
        self.details, self.retryable = details, retryable

def error_response(request, status, code, message, details=None, retryable=False):
    return JSONResponse(status_code=status, content={'error':{'code':code,'message':message,'details':details,'retryable':retryable,'request_id':getattr(request.state,'request_id','unknown')}})

async def handle_error(request, exc):
    return error_response(request, exc.status, exc.code, exc.message, exc.details, exc.retryable)
