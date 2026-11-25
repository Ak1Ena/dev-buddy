"""Local stub of the Anthropic and OpenAI HTTP APIs, for connection tests without real keys.

Not used by the app. Run:  python scripts/stub_ai_server.py 8790
Accepts only the key "stub-key" (x-api-key or Authorization: Bearer); anything else gets 401.
Serves:  GET /v1/models (both formats), POST /v1/messages (Anthropic), POST /v1/chat/completions (OpenAI).
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STUB_KEY = "stub-key"


class Handler(BaseHTTPRequestHandler):
    def _authed(self) -> bool:
        bearer = self.headers.get("Authorization", "")
        return self.headers.get("x-api-key") == STUB_KEY or bearer == f"Bearer {STUB_KEY}"

    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):  # request line only, never headers
        sys.stderr.write("stub: " + fmt % args + "\n")

    def do_GET(self):
        if not self._authed():
            return self._send(401, {"error": {"type": "authentication_error", "message": "invalid key"}})
        if self.path.startswith("/v1/models"):
            if "anthropic-version" in self.headers:
                return self._send(200, {"data": [
                    {"id": "claude-stub-1", "display_name": "Claude Stub 1", "type": "model"}]})
            return self._send(200, {"object": "list", "data": [
                {"id": "gpt-stub-1", "object": "model", "owned_by": "stub"},
                {"id": "gpt-stub-2", "object": "model", "owned_by": "stub"}]})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(length) or b"{}")
        if not self._authed():
            return self._send(401, {"error": {"type": "authentication_error", "message": "invalid key"}})
        if self.path == "/v1/messages":
            return self._send(200, {
                "id": "msg_stub", "type": "message", "role": "assistant", "model": req.get("model"),
                "content": [{"type": "text", "text": "stub anthropic reply"}],
                "stop_reason": "end_turn", "stop_sequence": None,
                "usage": {"input_tokens": 5, "output_tokens": 3}})
        if self.path == "/v1/chat/completions":
            return self._send(200, {
                "id": "chatcmpl-stub", "object": "chat.completion", "created": 0, "model": req.get("model"),
                "choices": [{"index": 0, "finish_reason": "stop",
                             "message": {"role": "assistant", "content": "stub openai reply"}}],
                "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8}})
        self._send(404, {"error": "not found"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
