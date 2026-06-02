"""
3Q Hatchery Cross-Bot API helpers
Lets the 3Q貢丸 bot share member & inquiry data with the main Hatchery worker.

Usage:
    from hatchery_api import get_member_tier, record_inquiry

Required env vars (add to Render service):
    HATCHERY_WORKER_URL  https://3q-hatchery-webhook.<subdomain>.workers.dev
    TRIGGER_TOKEN        (same value as the Cloudflare secret)
"""

import os
import urllib.request
import urllib.error
import json
import logging

logger = logging.getLogger("hatchery_api")

_WORKER = os.environ.get("HATCHERY_WORKER_URL", "").rstrip("/")
_TOKEN  = os.environ.get("TRIGGER_TOKEN", "")


def _auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {_TOKEN}",
        "Content-Type": "application/json",
    }


def get_member_tier(uid: str) -> str:
    """
    Look up a user's membership tier in the main Hatchery CRM.
    Returns: 'visitor' | 'inquired' | 'partner' | 'unknown'
    """
    if not _WORKER or not _TOKEN or not uid:
        return "unknown"
    url = f"{_WORKER}/api/member/{uid}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {_TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            return data.get("tier", "visitor")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "unknown"
        logger.warning(f"get_member_tier HTTP {e.code}: {uid}")
        return "unknown"
    except Exception as e:
        logger.warning(f"get_member_tier failed: {e}")
        return "unknown"


def record_inquiry(uid: str, free_text: str = "", service: str = "") -> bool:
    """
    Record an inquiry from this bot into the central Hatchery CRM D1.
    Returns True on success.
    """
    if not _WORKER or not _TOKEN or not uid:
        return False
    url = f"{_WORKER}/api/inquiry"
    payload = json.dumps({
        "userId":    uid,
        "freeText":  free_text,
        "service":   service or None,
        "sourceOa":  "3q-gongwan",
    }).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers=_auth_headers(),
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        logger.warning(f"record_inquiry failed: {e}")
        return False


def get_referral_code(uid: str) -> dict | None:
    """
    Issue/return this user's referral code from the single shared engine.
    Returns {'code', 'refCount', 'deepLink', 'siteLink'} or None.
    """
    if not _WORKER or not _TOKEN or not uid:
        return None
    url = f"{_WORKER}/api/referral/code/{uid}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {_TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            return data if data.get("ok") else None
    except Exception as e:
        logger.warning(f"get_referral_code failed: {e}")
        return None


def capture_referral(uid: str, code: str) -> bool:
    """Stash a pending attribution when this bot's user sends '引薦 CODE'."""
    if not _WORKER or not _TOKEN or not uid or not code:
        return False
    url = f"{_WORKER}/api/referral/capture"
    payload = json.dumps({"userId": uid, "code": code}).encode()
    req = urllib.request.Request(url, data=payload, headers=_auth_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        logger.warning(f"capture_referral failed: {e}")
        return False


def finalize_referral(uid: str) -> dict | None:
    """
    Qualify a pending attribution when this bot's user completes an inquiry.
    The worker rewards the inviter (on its own channel) and returns the invitee
    reward payload so THIS bot can deliver it with its own LINE token.
    """
    if not _WORKER or not _TOKEN or not uid:
        return None
    url = f"{_WORKER}/api/referral/finalize"
    payload = json.dumps({"userId": uid, "sourceOa": "3q-gongwan"}).encode()
    req = urllib.request.Request(url, data=payload, headers=_auth_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read())
            return data if data.get("ok") else None
    except Exception as e:
        logger.warning(f"finalize_referral failed: {e}")
        return None


def is_configured() -> bool:
    """Returns True if env vars are set (use for health-check logging)."""
    return bool(_WORKER and _TOKEN)
