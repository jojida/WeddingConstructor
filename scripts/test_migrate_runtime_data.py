"""Local, isolated checks for migrate-runtime-data.py; no application requests."""

from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "runtime_migration", Path(__file__).with_name("migrate-runtime-data.py")
)
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


class RuntimeMigrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.checkout = self.root / "checkout"
        self.backend = self.checkout / "backend"
        (self.checkout / ".git").mkdir(parents=True)
        (self.backend / "prisma").mkdir(parents=True)
        (self.backend / "prisma" / "schema.prisma").write_text("// fixture\n")
        self.database = self.backend / "prisma" / "dev.db"
        with closing(sqlite3.connect(self.database)) as database:
            database.execute("CREATE TABLE guests (name TEXT)")
            database.execute("INSERT INTO guests VALUES (?)", ("Анна",))
            database.commit()
        self.uploads = self.backend / "uploads"
        (self.uploads / "nested" / "empty").mkdir(parents=True)
        (self.uploads / "nested" / "photo.bin").write_bytes(b"\x00\xffphoto\x01")
        self.env = self.backend / ".env"
        self.original_env = (
            b'\xef\xbb\xbf# keep formatting\r\nDATABASE_URL="file:./dev.db"\r\n'
            b'TEST_SECRET="fixture-only-value" # preserve\r\nPORT=4000\r\n'
        )
        self.env.write_bytes(self.original_env)
        self.target = self.root / "runtime"

    def migrate(self, **options):
        return migration.migrate(str(self.backend), str(self.target), **options)

    def source_files(self):
        return {
            file.relative_to(self.checkout).as_posix(): file.read_bytes()
            for file in self.checkout.rglob("*") if file.is_file()
        }

    def test_dry_run_does_not_change_source_or_create_target(self):
        before = self.source_files()
        result = self.migrate()
        self.assertEqual(result["mode"], "dry-run")
        self.assertEqual(result["upload_files"], 1)
        self.assertEqual(self.source_files(), before)
        self.assertFalse(self.target.exists())

    def test_apply_copies_data_and_preserves_other_env_bytes(self):
        before = self.source_files()
        self.migrate(apply=True, api_stopped=True)
        self.assertEqual((self.target / ".env.before-migration").read_bytes(), self.original_env)
        expected = self.original_env.replace(
            b'DATABASE_URL="file:./dev.db"',
            ('DATABASE_URL="file:' + (self.target / "database.sqlite").as_posix() + '"').encode(),
        ) + ('UPLOADS_DIR="' + (self.target / "uploads").as_posix() + '"\r\n').encode()
        self.assertEqual(self.env.read_bytes(), expected)
        after = self.source_files()
        del before["backend/.env"]
        del after["backend/.env"]
        self.assertEqual(after, before)
        self.assertEqual(migration.inventory(self.target / "uploads"), migration.inventory(self.uploads))
        with closing(sqlite3.connect(self.target / "database.sqlite")) as database:
            self.assertEqual(database.execute("SELECT name FROM guests").fetchall(), [("Анна",)])
        self.assertFalse((self.target / ".sqlite-source").exists())
        self.assertTrue((self.target / "migration-manifest.json").is_file())

    def test_snapshot_preserves_committed_wal_rows(self):
        # Keep a quiescent connection open so SQLite does not checkpoint away WAL.
        with closing(sqlite3.connect(self.database)) as database:
            self.assertEqual(database.execute("PRAGMA journal_mode=WAL").fetchone()[0], "wal")
            database.execute("PRAGMA wal_autocheckpoint=0")
            database.execute("INSERT INTO guests VALUES (?)", ("Борис",))
            database.commit()
            self.assertTrue(Path(str(self.database) + "-wal").is_file())
            before = migration.database_inventory(self.database)
            self.migrate(apply=True, api_stopped=True)
            self.assertEqual(migration.database_inventory(self.database), before)
            with closing(sqlite3.connect(self.target / "database.sqlite")) as copied:
                self.assertEqual(copied.execute("SELECT name FROM guests ORDER BY rowid").fetchall(), [("Анна",), ("Борис",)])

    def test_apply_requires_stopped_writers(self):
        with self.assertRaisesRegex(migration.MigrationError, "Stop the API"):
            self.migrate(apply=True)
        self.assertFalse(self.target.exists())
        self.assertEqual(self.env.read_bytes(), self.original_env)

    def test_rejects_target_inside_checkout(self):
        self.target = self.checkout / "runtime"
        with self.assertRaisesRegex(migration.MigrationError, "outside the checkout"):
            self.migrate(apply=True, api_stopped=True)
        self.assertFalse(self.target.exists())

    def test_rejects_nonempty_target(self):
        self.target.mkdir()
        marker = self.target / "keep"
        marker.write_bytes(b"preserve")
        with self.assertRaisesRegex(migration.MigrationError, "empty or absent"):
            self.migrate(apply=True, api_stopped=True)
        self.assertEqual(marker.read_bytes(), b"preserve")
        self.assertEqual(self.env.read_bytes(), self.original_env)

    def test_rejects_symlink_path_before_writing(self):
        linked = self.uploads / "linked.bin"
        try:
            linked.symlink_to(self.uploads / "nested" / "photo.bin")
        except OSError:
            # Windows may disallow symlink creation for ordinary users. Exercise
            # the same guard with a reported symlink rather than skip protection.
            original_is_symlink = Path.is_symlink
            with patch.object(Path, "is_symlink", lambda path: path == self.uploads or original_is_symlink(path)):
                with self.assertRaisesRegex(migration.MigrationError, "Symlinks and junctions"):
                    self.migrate(apply=True, api_stopped=True)
        else:
            with self.assertRaisesRegex(migration.MigrationError, "Symlinks and junctions"):
                self.migrate(apply=True, api_stopped=True)
        self.assertFalse(self.target.exists())
        self.assertEqual(self.env.read_bytes(), self.original_env)

    def test_changed_env_is_not_overwritten(self):
        changed = self.original_env + b"NEW_SETTING=preserve\r\n"
        self.env.write_bytes(changed)
        with self.assertRaisesRegex(migration.MigrationError, "changed during migration"):
            migration.atomic_env(self.env, self.original_env, b"replacement")
        self.assertEqual(self.env.read_bytes(), changed)


if __name__ == "__main__":
    unittest.main()
