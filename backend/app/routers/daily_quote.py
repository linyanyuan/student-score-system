from datetime import date

import requests
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.daily_quote import DailyQuote
from app.schemas.schedule import DailyQuoteResponse

router = APIRouter(prefix="/api/daily-quote", tags=["每日语句"])


DEFAULT_QUOTES = [
    {"content": "教育的目的是让学生能够进行自我教育。", "source": "默认"},
    {"content": "成功不是终点，失败也不是末日：重要的是继续前进的勇气。", "source": "温斯顿·丘吉尔"},
    {"content": "教育不是注满一桶水，而是点燃一把火。", "source": "威廉·巴特勒·叶芝"},
]


@router.get("/", response_model=DailyQuoteResponse)
def get_daily_quote(db: Session = Depends(get_db)):
    """获取今日语句"""
    today = date.today()

    # 1. 检查缓存
    cached = db.query(DailyQuote).filter(DailyQuote.date == today).first()
    if cached:
        return DailyQuoteResponse(content=cached.content, source=cached.source)

    # 2. 调用一言API
    try:
        response = requests.get("https://v1.hitokoto.cn", timeout=3)
        if response.status_code == 200:
            data = response.json()
            quote = DailyQuote(
                content=data.get('hitokoto', ''),
                source=data.get('from', ''),
                date=today
            )
            db.add(quote)
            db.commit()
            return DailyQuoteResponse(content=quote.content, source=quote.source)
    except Exception:
        pass

    # 3. API失败，返回默认语句
    import random
    default = random.choice(DEFAULT_QUOTES)
    return DailyQuoteResponse(content=default["content"], source=default["source"])
