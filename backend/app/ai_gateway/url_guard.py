"""SSRF guard for provider base URLs a user typed (Vex review F1).

Lives in the gateway because every outbound provider call is built here
(build_checked_adapter) and every saved base URL passes through credentials.py,
so one check covers save, connection test, model list and generation.

Rules, after resolving the host:
- Link-local (169.254.0.0/16, fe80::/10, cloud metadata) is always refused.
- Any other non-global address (loopback, private, CGNAT, unique-local, reserved)
  is refused unless settings.allow_private_base_urls (true in development, so
  local Ollama / LM Studio keep working).

Known gap (not sure it matters before public hosting): DNS can change between
this check and the SDK's own connect (rebinding). Pinning the resolved IP is the
fix if Nexora is ever hosted for strangers. Redirects are off in the adapters,
so a public URL cannot 302 inward.
"""
from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

from app.ai_gateway.errors import GatewayError
from app.config import get_settings

_METADATA_HOSTS = {"metadata", "metadata.google.internal", "metadata.goog", "instance-data"}

_BLOCKED = ("This base URL points to a {what} address, which this server does not allow. "
            "Use the provider's public URL.")


def _ip(addr: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    ip = ipaddress.ip_address(addr.split("%", 1)[0])  # drop an IPv6 zone id
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return ip.ipv4_mapped
    return ip


def check_addresses(addresses: list[str], allow_private: bool) -> None:
    """Raise GatewayError(bad_request) if any resolved address is not allowed."""
    for addr in addresses:
        ip = _ip(addr)
        if ip.is_link_local:
            raise GatewayError("bad_request", _BLOCKED.format(what="link-local"))
        if not allow_private and not ip.is_global:
            raise GatewayError("bad_request", _BLOCKED.format(what="private or local"))


async def check_base_url(url: str | None) -> None:
    """Check the URL a user-chosen config will call. No-op for an empty URL
    (the adapter's built-in public default, e.g. api.openai.com)."""
    if not url:
        return
    host = (urlsplit(url).hostname or "").lower().rstrip(".")
    if not host:
        raise GatewayError("bad_request", "The base URL has no host name.")
    if host in _METADATA_HOSTS:
        raise GatewayError("bad_request", _BLOCKED.format(what="link-local"))
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError) as exc:
        raise GatewayError("unreachable", "The base URL's host name could not be found.") from exc
    check_addresses([info[4][0] for info in infos], get_settings().allow_private_base_urls)
