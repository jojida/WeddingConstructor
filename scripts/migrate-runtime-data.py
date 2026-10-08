#!/usr/bin/env python3
"""Copy runtime data outside Git, then atomically update backend/.env.

Dry-run is the default. Stop the API (including workers, watchers and PM2 restart
policies) before --apply --api-stopped, and keep it stopped until this finishes.
The tool cannot detect writers on another host. Existing files are never deleted
from the source. On failure, keep the API stopped, inspect the target and retry
with another empty target; do not delete the original data.

Example (run as the account which runs the API):
  python scripts/migrate-runtime-data.py --backend /var/www/wedding/backend \
    --target /var/lib/wedding/runtime --apply --api-stopped

Only DATABASE_URL and UPLOADS_DIR in the specified backend/.env are changed.
Process-manager/environment overrides must be removed or updated separately.
The target's parent must already exist. On Unix, directories are private (0700)
and data/configuration files are private (0600). Windows inherits the parent's
ACL: choose a private directory accessible to the API account only.
"""

import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import sys
import tempfile
from datetime import datetime, timezone


class MigrationError(Exception):
    """Messages are deliberately free of environment values and file contents."""


def require_plain_path(path):
    # Check every existing component, including junctions on Windows.
    for candidate in (path, *path.parents):
        if candidate.is_symlink() or getattr(candidate, "is_junction", lambda: False)():
            raise MigrationError("Symlinks and junctions are not allowed in migration paths.")
    return path.resolve()


def within(path, parent):
    return path == parent or parent in path.parents


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def env_setting(text, key, required=False):
    matches = re.findall(r"(?m)^\s*(?:export\s+)?" + re.escape(key) + r"\s*=([^\r\n]*)", text)
    if len(matches) > 1:
        raise MigrationError("Duplicate runtime settings in .env must be resolved first.")
    if not matches:
        if required:
            raise MigrationError("DATABASE_URL must be explicitly set in backend/.env.")
        return None
    value = matches[0].strip()
    if value.startswith(("'", '"', "`")):
        quote = value[0]
        end = value.find(quote, 1)
        if end < 0 or (value[end + 1:].strip() and not value[end + 1:].strip().startswith("#")):
            raise MigrationError("Unsupported quoting in a runtime path setting.")
        value = value[1:end]
        if quote == '"' and ("\\n" in value or "\\r" in value):
            raise MigrationError("Newlines are not supported in runtime path settings.")
    else:
        value = value.split("#", 1)[0].strip()
    if not value or any(char in value for char in "\r\n\0"):
        raise MigrationError("A runtime path setting is empty or invalid.")
    return value


def inventory(directory):
    if not directory.is_dir():
        raise MigrationError("The source uploads directory must exist.")
    files = {}
    directories = []
    for current, subdirs, names in os.walk(directory, followlinks=False):
        base = Path(current)
        for name in sorted(subdirs):
            folder = base / name
            require_plain_path(folder)
            directories.append(folder.relative_to(directory).as_posix())
        for name in sorted(names):
            item = base / name
            require_plain_path(item)
            if not stat.S_ISREG(item.stat().st_mode):
                raise MigrationError("Only regular files are supported in uploads.")
            files[item.relative_to(directory).as_posix()] = {
                "bytes": item.stat().st_size, "sha256": digest(item)
            }
    return {"directories": sorted(directories), "files": files}


def database_inventory(database):
    files = {}
    for suffix in ("", "-wal", "-shm", "-journal"):
        item = Path(str(database) + suffix)
        require_plain_path(item)
        if item.exists():
            if not item.is_file():
                raise MigrationError("SQLite files must be regular files.")
            files[suffix] = {"bytes": item.stat().st_size, "sha256": digest(item)}
    if "" not in files:
        raise MigrationError("The configured source SQLite database does not exist.")
    return files


def private_copy(source, destination, expected_hash):
    with source.open("rb") as src, destination.open("xb") as dst:
        os.chmod(destination, 0o600)
        shutil.copyfileobj(src, dst, length=1024 * 1024)
        dst.flush()
        os.fsync(dst.fileno())
    if digest(destination) != expected_hash:
        raise MigrationError("Source data changed or a copied file failed hash verification.")


def write_private(path, content):
    with path.open("xb") as stream:
        os.chmod(path, 0o600)
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())


def replace_settings(original, database, uploads):
    # Forward slashes avoid dotenv double-quote escape ambiguities on Windows.
    values = {"DATABASE_URL": "file:" + database.as_posix(), "UPLOADS_DIR": uploads.as_posix()}
    text = original.decode("utf-8-sig")
    newline = "\r\n" if "\r\n" in text else "\n"
    for key, value in values.items():
        if any(char in value for char in '"\r\n\0'):
            raise MigrationError("The target path cannot be represented safely in dotenv.")
        replacement = key + '="' + value + '"'
        pattern = r"(?m)^[ \t]*(?:export[ \t]+)?" + key + r"[ \t]*=[^\r\n]*"
        if re.search(pattern, text):
            text = re.sub(pattern, lambda _: replacement, text)
        else:
            if text and not text.endswith(("\r", "\n")):
                text += newline
            text += replacement + newline
    encoded = text.encode("utf-8")
    return (b"\xef\xbb\xbf" + encoded) if original.startswith(b"\xef\xbb\xbf") else encoded


def atomic_env(path, original, replacement):
    if path.read_bytes() != original:
        raise MigrationError("backend/.env changed during migration; it was not overwritten.")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix=".env.migration-", dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            os.chmod(temporary, 0o600)
            stream.write(replacement)
            stream.flush()
            os.fsync(stream.fileno())
        if path.read_bytes() != original:
            raise MigrationError("backend/.env changed during migration; it was not overwritten.")
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def migrate(backend_arg, target_arg, apply=False, api_stopped=False):
    backend_input, target_input = Path(backend_arg), Path(target_arg)
    if not backend_input.is_absolute() or not target_input.is_absolute():
        raise MigrationError("--backend and --target must be absolute paths.")
    backend, target = require_plain_path(backend_input), require_plain_path(target_input)
    if not (backend / "prisma" / "schema.prisma").is_file():
        raise MigrationError("--backend must contain prisma/schema.prisma.")
    repository = next((p for p in (backend, *backend.parents) if (p / ".git").exists()), backend.parent)
    if within(target, repository) or within(repository, target):
        raise MigrationError("The target must be outside the checkout and cannot contain it.")
    if not target.parent.is_dir() or (target.exists() and (not target.is_dir() or any(target.iterdir()))):
        raise MigrationError("The target needs an existing parent and must be empty or absent.")
    env_path = require_plain_path(backend / ".env")
    original = env_path.read_bytes()
    text = original.decode("utf-8-sig")
    database_url = env_setting(text, "DATABASE_URL", required=True)
    if not database_url.startswith("file:") or any(char in database_url for char in "?#%"):
        raise MigrationError("Only plain SQLite file: DATABASE_URL values without URL options are supported.")
    database_value = database_url[5:]
    # Prisma's normal file:/absolute and file:./relative forms are supported.
    # Reject URI authorities rather than risk interpreting a network location.
    if not database_value or database_value.startswith("//"):
        raise MigrationError("Use a plain local SQLite path, without a URI authority.")
    database_path = Path(database_value)
    database = require_plain_path(database_path if database_path.is_absolute() else backend / "prisma" / database_path)
    uploads_value = env_setting(text, "UPLOADS_DIR")
    uploads_path = Path(uploads_value) if uploads_value else backend / "uploads"
    uploads = require_plain_path(uploads_path if uploads_path.is_absolute() else backend / uploads_path)
    if within(database, uploads) or within(target, uploads) or within(uploads, target):
        raise MigrationError("Database, uploads and target paths must not overlap.")
    before_database = database_inventory(database)
    before_uploads = inventory(uploads)
    replacement = replace_settings(original, target / "database.sqlite", target / "uploads")
    summary = {
        "mode": "apply" if apply else "dry-run", "database": str(database),
        "uploads": str(uploads), "target": str(target),
        "upload_files": len(before_uploads["files"]),
        "source_bytes": sum(v["bytes"] for v in before_database.values())
            + sum(v["bytes"] for v in before_uploads["files"].values()),
    }
    if not apply:
        return summary
    if not api_stopped:
        raise MigrationError("Stop the API and all writers, then pass --api-stopped with --apply.")
    needed = summary["source_bytes"] + sum(v["bytes"] for v in before_database.values()) + 1024 * 1024
    if shutil.disk_usage(target.parent).free < needed:
        raise MigrationError("Insufficient free space for a verified copy and SQLite snapshot.")
    target.mkdir(mode=0o700, exist_ok=True)
    os.chmod(target, 0o700)
    write_private(target / ".env.before-migration", original)
    staging = target / ".sqlite-source"
    staging.mkdir(mode=0o700)
    staged_db = staging / "snapshot.sqlite"
    for suffix, info in before_database.items():
        private_copy(Path(str(database) + suffix), Path(str(staged_db) + suffix), info["sha256"])
    destination_database = target / "database.sqlite"
    # Open only the verified private copy; SQLite recovery cannot alter source files.
    with closing(sqlite3.connect(staged_db)) as source, closing(sqlite3.connect(destination_database)) as destination:
        os.chmod(destination_database, 0o600)
        source.backup(destination)
        if destination.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
            raise MigrationError("SQLite snapshot integrity validation failed.")
    destination_uploads = target / "uploads"
    destination_uploads.mkdir(mode=0o700)
    for directory in before_uploads["directories"]:
        (destination_uploads / directory).mkdir(mode=0o700, parents=True, exist_ok=True)
    for relative, info in before_uploads["files"].items():
        private_copy(uploads / relative, destination_uploads / relative, info["sha256"])
    if database_inventory(database) != before_database or inventory(uploads) != before_uploads:
        raise MigrationError("Source data changed during migration; backend/.env was not updated.")
    if inventory(destination_uploads) != before_uploads:
        raise MigrationError("Upload copy verification failed; backend/.env was not updated.")
    manifest = {
        "version": 1, "created_at": datetime.now(timezone.utc).isoformat(),
        "source_backend": str(backend), "source_database": str(database), "source_uploads": str(uploads),
        "target": str(target), "source_database_files": before_database,
        "database_sha256": digest(destination_database), "uploads": before_uploads,
        "env_backup": ".env.before-migration", "env_sha256_before": hashlib.sha256(original).hexdigest(),
        "env_sha256_after": hashlib.sha256(replacement).hexdigest(),
    }
    write_private(target / "migration-manifest.json", (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    # Verify this exact scratch directory before recursive removal on Windows.
    if staging.resolve().parent != target or staging.name != ".sqlite-source":
        raise MigrationError("Unexpected SQLite scratch path; configuration was not changed.")
    shutil.rmtree(staging)
    atomic_env(env_path, original, replacement)
    summary["status"] = "verified copy complete; .env updated; original data preserved"
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--backend", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--api-stopped", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(migrate(args.backend, args.target, args.apply, args.api_stopped), indent=2, ensure_ascii=False))
        return 0
    except MigrationError as error:
        print("Migration stopped: " + str(error), file=sys.stderr)
    except (OSError, sqlite3.Error, UnicodeError):
        # Underlying exceptions may include database contents or config values.
        print("Migration stopped: filesystem, SQLite or text decoding error. Original data was preserved.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
