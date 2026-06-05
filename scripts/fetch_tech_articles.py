#!/usr/bin/env python3
"""Fetch fresh technology links for the homepage repost feed.

This intentionally stores only titles, short generated summaries, and source links.
It does not mirror article bodies.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "articles" / "tech-feed.json"
MAX_ITEMS = int(os.environ.get("TECH_FEED_MAX_ITEMS", "10"))
KEEP_ITEMS = int(os.environ.get("TECH_FEED_KEEP_ITEMS", "30"))
HN_TOP_STORIES = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{id}.json"

KEYWORDS = {
    "ai", "agent", "agents", "llm", "model", "models", "openai", "anthropic",
    "claude", "codex", "assistant", "homeassistant",
    "google", "deepmind", "robot", "robotics", "vision", "video", "gpu",
    "chip", "chips", "database", "security", "browser", "developer",
    "programming", "python", "rust", "javascript", "linux", "cloud",
    "inference", "training", "research", "startup", "github",
}

TECH_SOURCE_DOMAINS = (
    "github.com",
    "anthropic.com",
    "openai.com",
    "deepmind.google",
    "googleblog.com",
    "microsoft.com",
    "cloudflare.com",
    "blog.kog.ai",
)

TECH_PHRASES = (
    "artificial intelligence",
    "machine learning",
    "large language model",
    "home assistant",
    "claude code",
    "front end",
    "front-end",
)


def fetch_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": "greasebig-homepage-tech-feed/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def source_name(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host or "news.ycombinator.com"


def normalize_title(title: str) -> str:
    return " ".join((title or "").split())


# --- Translation (Google Translate + MyMemory fallback) ---

def translate_google(text: str) -> str | None:
    """Translate text via Google Translate free API."""
    try:
        url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return "".join([part[0] for part in data[0]])
    except Exception as e:
        print(f"  Google Translate failed: {e}")
        return None


def translate_mymemory(text: str) -> str | None:
    """Translate text via MyMemory free API."""
    try:
        params = {"q": text, "langpair": "en|zh-CN"}
        url = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("responseStatus") == 200:
                return data.get("responseData", {}).get("translatedText")
        return None
    except Exception as e:
        print(f"  MyMemory failed: {e}")
        return None


def translate_title(text: str) -> str:
    """Translate English title to Chinese, with fallback chain."""
    if not text or not text.strip():
        return ""
    res = translate_google(text)
    if res:
        return res
    time.sleep(0.5)
    res = translate_mymemory(text)
    return res or ""


def is_interesting(item: dict) -> bool:
    title = normalize_title(item.get("title", ""))
    title_lower = title.lower()
    title_tokens = {token.strip(".,:;!?()[]{}'\"").lower() for token in title.split()}
    source = source_name(item.get("url") or "")
    return (
        bool(title_tokens & KEYWORDS)
        or any(phrase in title_lower for phrase in TECH_PHRASES)
        or any(source == domain or source.endswith("." + domain) for domain in TECH_SOURCE_DOMAINS)
    )


def is_feed_item_tech(item: dict) -> bool:
    title = normalize_title(item.get("title", ""))
    title_lower = title.lower()
    title_tokens = {token.strip(".,:;!?()[]{}'\"").lower() for token in title.split()}
    source = str(item.get("source") or "").lower()
    return (
        bool(title_tokens & KEYWORDS)
        or any(phrase in title_lower for phrase in TECH_PHRASES)
        or any(source == domain or source.endswith("." + domain) for domain in TECH_SOURCE_DOMAINS)
    )


def to_feed_item(item: dict) -> dict:
    item_id = item["id"]
    url = item.get("url") or f"https://news.ycombinator.com/item?id={item_id}"
    score = int(item.get("score") or 0)
    comments = int(item.get("descendants") or 0)
    published = datetime.fromtimestamp(int(item.get("time") or time.time()), timezone.utc)
    source = source_name(url)
    title = normalize_title(item.get("title", ""))
    print(f"  Translating: {title[:60]}...")
    title_zh = translate_title(title)
    if title_zh:
        print(f"  -> {title_zh[:60]}")
    result = {
        "title": title,
        "url": url,
        "source": source,
        "date": published.strftime("%Y-%m-%d"),
        "repost": True,
        "summary": f"转载 / Curated repost from {source}. Hacker News score {score}, {comments} comments. Click through to read the original article.",
        "discussion_url": f"https://news.ycombinator.com/item?id={item_id}",
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if title_zh:
        result["title_zh"] = title_zh
    return result


def load_existing() -> list[dict]:
    if not OUT.exists():
        return []
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def main() -> None:
    story_ids = fetch_json(HN_TOP_STORIES)[:120]
    fresh: list[dict] = []

    for story_id in story_ids:
        try:
            item = fetch_json(HN_ITEM.format(id=story_id))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            continue
        if item.get("type") != "story" or not item.get("title"):
            continue
        if not item.get("url"):
            continue
        if not is_interesting(item):
            continue
        fresh.append(to_feed_item(item))
        if len(fresh) >= MAX_ITEMS:
            break
        time.sleep(0.08)

    existing = load_existing()
    # Build existing lookup for title_zh preservation
    existing_by_key: dict[str, dict] = {}
    for item in existing:
        key = item.get("url") or item.get("title")
        if key:
            existing_by_key[key] = item

    merged: dict[str, dict] = {}
    for item in fresh + existing:
        key = item.get("url") or item.get("title")
        if key and key not in merged:
            merged[key] = item

    # Preserve title_zh from existing items if the fresh item lacks it
    for key, item in merged.items():
        if "title_zh" not in item and key in existing_by_key and "title_zh" in existing_by_key[key]:
            item["title_zh"] = existing_by_key[key]["title_zh"]

    feed = [item for item in merged.values() if is_feed_item_tech(item)]
    feed = sorted(feed, key=lambda item: (item.get("date", ""), item.get("fetched_at", "")), reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(feed[:KEEP_ITEMS], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {min(len(feed), KEEP_ITEMS)} reposted technology links to {OUT}")


if __name__ == "__main__":
    main()
