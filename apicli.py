#!/usr/bin/env python3
"""
apicli.py — Interactive CLI for manual API calls and debug testing
Usage: python3 apicli.py [OPTIONS] METHOD URL
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

# ── ANSI colors ──────────────────────────────────────────────────────────────
R = "\033[31m"; G = "\033[32m"; Y = "\033[33m"; B = "\033[34m"; M = "\033[35m"
C = "\033[36m"; W = "\033[37m"; BOLD = "\033[1m"; DIM = "\033[2m"; RESET = "\033[0m"

STATUS_COLORS = {1: C, 2: G, 3: Y, 4: R, 5: R}


def color_status(code):
    return STATUS_COLORS.get(code // 100, W) + BOLD + str(code) + RESET


def pretty_json(text):
    try:
        obj = json.loads(text)
        lines = json.dumps(obj, indent=2).splitlines()
        out = []
        for line in lines:
            stripped = line.lstrip()
            indent = line[: len(line) - len(stripped)]
            if stripped.startswith('"') and ":" in stripped:
                key, _, rest = stripped.partition(":")
                out.append(indent + C + key + RESET + ":" + colorize_value(rest))
            elif stripped.startswith("{") or stripped.startswith("["):
                out.append(indent + DIM + stripped + RESET)
            elif stripped in ("}", "]", "},", "],"):
                out.append(indent + DIM + stripped + RESET)
            else:
                out.append(indent + colorize_value(stripped))
        return "\n".join(out)
    except Exception:
        return text


def colorize_value(val):
    val = val.strip().rstrip(",")
    if val in ("true", "false"):
        return Y + val + RESET
    if val == "null":
        return M + val + RESET
    if val.startswith('"'):
        return G + val + RESET
    try:
        float(val)
        return B + val + RESET
    except ValueError:
        pass
    return val


def load_profile(path):
    if not path or not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


def save_profile(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"{G}Profile saved → {path}{RESET}")


def build_request(method, url, headers, body, params):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    data = body.encode() if body else None
    req = urllib.request.Request(url, data=data, method=method.upper())
    for k, v in headers.items():
        req.add_header(k, v)
    if data and "Content-Type" not in headers:
        req.add_header("Content-Type", "application/json")
    return req, url


def do_request(req, timeout, follow_redirects, debug):
    jar = CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        *([urllib.request.HTTPRedirectHandler()] if follow_redirects else []),
    )
    if debug:
        print(f"\n{DIM}  → {req.get_method()} {req.full_url}{RESET}")
        for k, v in req.header_items():
            print(f"{DIM}  {k}: {v}{RESET}")
        if req.data:
            print(f"{DIM}  body: {req.data.decode()}{RESET}")
        print()

    start = time.time()
    try:
        resp = opener.open(req, timeout=timeout)
        elapsed = time.time() - start
        body = resp.read()
        return resp.status, dict(resp.headers), body, elapsed, None
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        body = e.read()
        return e.code, dict(e.headers), body, elapsed, None
    except Exception as exc:
        return None, {}, b"", time.time() - start, str(exc)


def print_response(status, headers, body, elapsed, err, show_headers, raw):
    if err:
        print(f"\n{R}{BOLD}Error:{RESET} {err}\n")
        return

    print(f"\n{BOLD}Status:{RESET} {color_status(status)}  {DIM}({elapsed*1000:.0f}ms){RESET}")

    if show_headers:
        print(f"\n{BOLD}Headers:{RESET}")
        for k, v in sorted(headers.items()):
            print(f"  {C}{k}{RESET}: {v}")

    ct = headers.get("Content-Type", "")
    text = body.decode(errors="replace")

    print(f"\n{BOLD}Body:{RESET}")
    if not raw and "json" in ct:
        print(pretty_json(text))
    elif not raw and len(text) > 4000:
        print(text[:4000] + f"\n{DIM}… ({len(text)-4000} chars truncated, use --raw to see all){RESET}")
    else:
        print(text)
    print()


# ── Interactive REPL ──────────────────────────────────────────────────────────

REPL_HELP = f"""
{BOLD}Commands:{RESET}
  {Y}METHOD URL{RESET}        e.g.  GET https://httpbin.org/get
  {Y}set header KEY VAL{RESET}  add a persistent header
  {Y}set param KEY VAL{RESET}   add a persistent query param
  {Y}set body <JSON>{RESET}     set request body
  {Y}set bearer TOKEN{RESET}    shortcut for Authorization header
  {Y}set base URL{RESET}        base URL prefix for relative paths
  {Y}unset header KEY{RESET}
  {Y}unset param KEY{RESET}
  {Y}unset body{RESET}
  {Y}show{RESET}              print current session state
  {Y}save FILE{RESET}         save session profile to JSON
  {Y}load FILE{RESET}         load session profile from JSON
  {Y}clear{RESET}             reset session
  {Y}help{RESET} / {Y}?{RESET}
  {Y}quit{RESET} / {Y}exit{RESET} / Ctrl-C
"""

METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}


def repl(args):
    session = {
        "headers": dict(args.header or []),
        "params": dict(args.param or []),
        "body": args.data or "",
        "base": "",
        "timeout": args.timeout,
        "follow": not args.no_redirect,
        "show_headers": args.headers,
        "raw": args.raw,
        "debug": args.debug,
    }
    if args.bearer:
        session["headers"]["Authorization"] = f"Bearer {args.bearer}"
    if args.profile:
        prof = load_profile(args.profile)
        session.update({k: v for k, v in prof.items() if k in session})

    print(f"{BOLD}{B}apicli interactive{RESET}  (type {Y}help{RESET} for commands)\n")

    while True:
        try:
            line = input(f"{M}>{RESET} ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if not line:
            continue
        tokens = line.split(None, 3)
        cmd = tokens[0].upper()

        if cmd in ("QUIT", "EXIT"):
            break
        elif cmd in ("HELP", "?"):
            print(REPL_HELP)
        elif cmd == "SHOW":
            print(json.dumps(session, indent=2))
        elif cmd == "CLEAR":
            session.update({"headers": {}, "params": {}, "body": "", "base": ""})
            print(f"{G}Session cleared.{RESET}")
        elif cmd == "SAVE" and len(tokens) >= 2:
            save_profile(tokens[1], session)
        elif cmd == "LOAD" and len(tokens) >= 2:
            prof = load_profile(tokens[1])
            session.update({k: v for k, v in prof.items() if k in session})
            print(f"{G}Loaded {tokens[1]}{RESET}")
        elif cmd == "SET" and len(tokens) >= 4:
            sub = tokens[1].lower()
            if sub == "header":
                session["headers"][tokens[2]] = tokens[3]
            elif sub == "param":
                session["params"][tokens[2]] = tokens[3]
            elif sub == "body":
                session["body"] = tokens[3]
            elif sub == "bearer":
                session["headers"]["Authorization"] = f"Bearer {tokens[2]}"
            elif sub == "base":
                session["base"] = tokens[2]
            else:
                print(f"{R}Unknown set target: {sub}{RESET}")
        elif cmd == "SET" and len(tokens) == 3 and tokens[1].lower() in ("body", "base"):
            sub = tokens[1].lower()
            session[sub] = tokens[2]
        elif cmd == "UNSET" and len(tokens) >= 3:
            sub = tokens[1].lower()
            if sub == "header":
                session["headers"].pop(tokens[2], None)
            elif sub == "param":
                session["params"].pop(tokens[2], None)
        elif cmd == "UNSET" and len(tokens) == 2 and tokens[1].lower() == "body":
            session["body"] = ""
        elif cmd in METHODS and len(tokens) >= 2:
            url = tokens[1]
            if session["base"] and not url.startswith("http"):
                url = session["base"].rstrip("/") + "/" + url.lstrip("/")
            body = tokens[2] if len(tokens) > 2 else session["body"]
            req, full_url = build_request(
                cmd, url, session["headers"], body, session["params"]
            )
            status, headers, resp_body, elapsed, err = do_request(
                req, session["timeout"], session["follow"], session["debug"]
            )
            print_response(
                status, headers, resp_body, elapsed, err,
                session["show_headers"], session["raw"]
            )
        else:
            print(f"{R}Unknown command. Type 'help' for usage.{RESET}")


# ── One-shot CLI ──────────────────────────────────────────────────────────────

def one_shot(args):
    headers = dict(args.header or [])
    params = dict(args.param or [])
    if args.bearer:
        headers["Authorization"] = f"Bearer {args.bearer}"
    if args.profile:
        prof = load_profile(args.profile)
        headers.update(prof.get("headers", {}))
        params.update(prof.get("params", {}))

    body = args.data or ""
    if args.json_file:
        with open(args.json_file) as f:
            body = f.read()

    req, url = build_request(args.method, args.url, headers, body, params)
    status, resp_headers, resp_body, elapsed, err = do_request(
        req, args.timeout, not args.no_redirect, args.debug
    )
    print_response(status, resp_headers, resp_body, elapsed, err, args.headers, args.raw)

    if args.output:
        with open(args.output, "wb") as f:
            f.write(resp_body)
        print(f"{G}Response saved → {args.output}{RESET}")

    if status and status >= 400:
        sys.exit(1)


# ── Argument parser ───────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        prog="apicli",
        description="Easy CLI for manual API calls and debug testing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python3 apicli.py GET https://httpbin.org/get
  python3 apicli.py POST https://httpbin.org/post -d '{"key":"val"}' -H Content-Type:application/json
  python3 apicli.py --bearer mytoken GET https://api.example.com/users
  python3 apicli.py                          # interactive REPL
""",
    )
    p.add_argument("method", nargs="?", metavar="METHOD",
                   help="HTTP method (GET POST PUT PATCH DELETE HEAD OPTIONS)")
    p.add_argument("url", nargs="?", metavar="URL", help="Request URL")
    p.add_argument("-H", "--header", metavar="KEY:VALUE", action="append",
                   type=lambda s: s.split(":", 1), help="Add request header (repeatable)")
    p.add_argument("-p", "--param", metavar="KEY=VALUE", action="append",
                   type=lambda s: s.split("=", 1), help="Add query param (repeatable)")
    p.add_argument("-d", "--data", metavar="BODY", help="Request body string")
    p.add_argument("-f", "--json-file", metavar="FILE", help="Read body from JSON file")
    p.add_argument("-b", "--bearer", metavar="TOKEN", help="Bearer token shortcut")
    p.add_argument("--headers", action="store_true", help="Print response headers")
    p.add_argument("--raw", action="store_true", help="Print raw response body (no color)")
    p.add_argument("--debug", action="store_true", help="Print request details before sending")
    p.add_argument("--no-redirect", action="store_true", help="Don't follow redirects")
    p.add_argument("-t", "--timeout", type=float, default=30, metavar="SECS",
                   help="Request timeout in seconds (default 30)")
    p.add_argument("--profile", metavar="FILE", help="Load/save session profile JSON")
    p.add_argument("-o", "--output", metavar="FILE", help="Save response body to file")

    args = p.parse_args()

    if not args.method:
        repl(args)
    else:
        if not args.url:
            p.error("URL is required when METHOD is given")
        if args.method.upper() not in METHODS:
            p.error(f"Unknown method '{args.method}'. Use: {', '.join(METHODS)}")
        args.method = args.method.upper()
        one_shot(args)


if __name__ == "__main__":
    main()
