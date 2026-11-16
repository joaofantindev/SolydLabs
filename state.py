# -*- coding: utf-8 -*-
"""Estado em memória dos laboratórios (por sessão de navegador)."""
import secrets
import threading
import time

from flask import session

_LOCK = threading.Lock()
_STATE = {}
TTL = 60 * 60 * 2  # 2 horas


def sid():
    if "sid" not in session:
        session["sid"] = secrets.token_urlsafe(16)
    return session["sid"]


def _bucket():
    s = sid()
    with _LOCK:
        b = _STATE.setdefault(s, {"labs": {}})
        return b


def get(slug):
    b = _bucket()
    entry = b["labs"].get(slug)
    if not entry:
        return None
    if time.time() - entry["started"] > TTL:
        with _LOCK:
            b["labs"].pop(slug, None)
        return None
    return entry


def is_running(slug):
    return get(slug) is not None


def start(slug):
    b = _bucket()
    with _LOCK:
        entry = b["labs"].get(slug)
        if entry and time.time() - entry["started"] <= TTL:
            return entry
        entry = {"started": time.time(), "ctx": {}}
        b["labs"][slug] = entry
        return entry


def stop(slug):
    b = _bucket()
    with _LOCK:
        b["labs"].pop(slug, None)


def reset(slug):
    b = _bucket()
    with _LOCK:
        b["labs"].pop(slug, None)


def uptime(slug):
    e = get(slug)
    return int(time.time() - e["started"]) if e else 0


def ctx(slug, create=False):
    e = get(slug)
    if e:
        return e["ctx"]
    if create:
        e = start(slug)
        return e["ctx"]
    return None


def running_slugs():
    b = _bucket()
    now = time.time()
    out = []
    for slug, e in list(b["labs"].items()):
        if now - e["started"] <= TTL:
            out.append(slug)
    return out
