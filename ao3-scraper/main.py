import os
import re
import logging
from contextlib import asynccontextmanager
from typing import Optional

import AO3
import uvicorn
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# AO3 session — one shared session for the lifetime of the process
# ---------------------------------------------------------------------------

session: Optional[AO3.Session] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global session
    username = os.environ.get("AO3_USERNAME")
    password = os.environ.get("AO3_PASSWORD")
    if username and password:
        try:
            session = AO3.Session(username, password)
            logger.info("AO3 session established for user: %s", username)
        except Exception as e:
            logger.warning("AO3 login failed: %s — falling back to anonymous", e)
            session = None
    else:
        logger.warning("AO3_USERNAME / AO3_PASSWORD not set — running unauthenticated")
    yield
    session = None


app = FastAPI(title="AO3 Scraper Service", lifespan=lifespan)

# ---------------------------------------------------------------------------
# CORS — only allow requests from your Vercel frontend
# ---------------------------------------------------------------------------

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---------------------------------------------------------------------------
# Simple bearer-token auth so only your Next.js backend can call this
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=False)

def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    expected = os.environ.get("SCRAPER_SECRET")
    if not expected:
        return  # No secret set — open (fine for local dev)
    if not credentials or credentials.credentials != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing token")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_work_id(url: str) -> str:
    match = re.search(r"/works/(\d+)", url)
    if not match:
        raise HTTPException(status_code=400, detail="Could not extract work ID from URL")
    return match.group(1)


def serialize_work(work: AO3.Work) -> dict:
    """Pull every useful field off the AO3.Work object."""
    work.reload()  # Ensure all metadata is loaded

    def safe_list(val) -> list[str]:
        if not val:
            return []
        if isinstance(val, list):
            return [str(v) for v in val]
        return [str(val)]

    def safe_int(val) -> Optional[int]:
        try:
            return int(val) if val is not None else None
        except (ValueError, TypeError):
            return None

    def safe_date(val) -> Optional[str]:
        if val is None:
            return None
        try:
            return val.strftime("%Y-%m-%d")
        except AttributeError:
            return str(val)

    # Chapter count string e.g. "12/?" or "12/12"
    chapters_posted = safe_int(work.chapters)
    chapters_expected = safe_int(work.expected_chapters)
    chapter_count = (
        f"{chapters_posted}/{chapters_expected}"
        if chapters_expected
        else f"{chapters_posted}/?"
        if chapters_posted is not None
        else "?"
    )

    status = "Complete" if work.complete else "In Progress"

    return {
        "ao3_id": str(work.id),
        "ao3_url": f"https://archiveofourown.org/works/{work.id}",
        "title": work.title or "Unknown Title",
        "author": ", ".join(str(a) for a in work.authors) if work.authors else "Anonymous",
        "fandom": safe_list(work.fandoms),
        "ao3_rating": work.rating or "Not Rated",
        "warnings": safe_list(work.warnings),
        "categories": safe_list(work.categories),
        "characters": safe_list(work.characters),
        "relationships": safe_list(work.relationships),
        "additional_tags": safe_list(work.tags),
        "summary": work.summary or "",
        "word_count": safe_int(work.words),
        "chapter_count": chapter_count,
        "status": status,
        "language": work.language or "English",
        "published_date": safe_date(work.date_published),
        "updated_date": safe_date(work.date_updated),
        "kudos": safe_int(work.kudos),
        "bookmarks": safe_int(work.bookmarks),
        "hits": safe_int(work.hits),
        "comments": safe_int(work.comments),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "authenticated": session is not None,
        "user": session.username if session else None,
    }


@app.post("/scrape")
def scrape_work(body: ScrapeRequest, _=Security(verify_token)):
    work_id = extract_work_id(body.url)

    try:
        if session:
            work = AO3.Work(int(work_id), session=session, load=True)
        else:
            work = AO3.Work(int(work_id), load=True)
    except AO3.utils.AuthError:
        raise HTTPException(
            status_code=403,
            detail="This work is locked and requires an AO3 account. Check your credentials."
        )
    except AO3.utils.InvalidIdError:
        raise HTTPException(status_code=404, detail=f"No AO3 work found with ID {work_id}")
    except Exception as e:
        logger.exception("Unexpected error loading work %s", work_id)
        raise HTTPException(status_code=500, detail=str(e))

    return serialize_work(work)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=False)
