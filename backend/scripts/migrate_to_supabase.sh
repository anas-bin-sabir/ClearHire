#!/usr/bin/env bash
# Move ClearHire's database to a hosted Postgres (Supabase). See docs/SUPABASE.md.
#
# Usage (any directory):
#   TARGET_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
#     backend/scripts/migrate_to_supabase.sh            # schema via Alembic + copy data from SOURCE_URL
#   TARGET_URL=... backend/scripts/migrate_to_supabase.sh --reseed   # schema + demo seed, no copy
#
# Environment:
#   TARGET_URL       required. libpq form (postgresql://...). A postgresql+asyncpg:// URL is
#                    accepted too and converted. Use the session pooler (port 5432), not 6543.
#   SOURCE_URL       default: the docker-compose database (localhost:5435/clearhire_db).
#   TRUNCATE_TARGET  set to 1 to empty non-empty target tables before copying.
#   SEED_COUNT       freelancers for --reseed (default 50).
#   PYTHON           interpreter with backend requirements (default backend/.venv/bin/python,
#                    else python3).
#
# How the data copy works and why:
#   * The schema is never dumped. `alembic upgrade head` builds it on the target so the
#     target is exactly what the app expects (extension, HNSW/GIN indexes, RLS migration),
#     and alembic_version is excluded from the dump.
#   * `pg_restore --disable-triggers` is not used: it issues ALTER TABLE ... DISABLE TRIGGER
#     ALL, which needs superuser for the FK constraint triggers, and Supabase's `postgres`
#     role is not a superuser. Instead the custom-format dump is rendered to SQL and loaded
#     with psql in a single transaction after `SET session_replication_role = replica`,
#     the approach Supabase's own migration guide uses (it skips FK triggers for the session).
#     If that SET is refused, the load continues without it: pg_dump emits table data in
#     foreign-key dependency order, which covers every FK except self-references
#     (freelancers.referred_by_id -> freelancers.id, which pg_dump warns about). A referral
#     pointing at a later-inserted row would then fail the load; --single-transaction makes
#     that an all-or-nothing rollback, never a half-copied database.
#   * A data-only dump already carries setval() for owned sequences; sequences are reset to
#     max(id)+1 again afterwards anyway so the target is correct even if rows were edited.
set -euo pipefail

MODE=copy
case "${1:-}" in
  "") ;;
  --reseed) MODE=reseed ;;
  -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
  *) echo "unknown argument: $1 (use --reseed or no argument)" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# docker-compose.yml: user clearhire / clearhire123, db clearhire_db, host port 5435
SOURCE_URL="${SOURCE_URL:-postgresql://clearhire:clearhire123@localhost:5435/clearhire_db}"
: "${TARGET_URL:?set TARGET_URL to the Supabase session pooler URL (postgresql://...:5432/postgres)}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
redact() { sed -E 's#(://[^:/@]+):[^@]*@#\1:***@#' <<<"$1"; }

# libpq URL (psql/pg_dump) and SQLAlchemy URL (Alembic/app) from whatever form was given
to_libpq() { sed -E 's#^postgres(ql)?(\+asyncpg)?://#postgresql://#' <<<"$1"; }
# asyncpg rejects libpq query options such as sslmode; TLS is chosen by DB_SSL_MODE (auto
# for Supabase hosts), so the query string is dropped.
to_asyncpg() { sed -E 's#^postgres(ql)?(\+asyncpg)?://#postgresql+asyncpg://#; s#\?.*$##' <<<"$1"; }

SOURCE_URL="$(to_libpq "$SOURCE_URL")"
TARGET_URL="$(to_libpq "$TARGET_URL")"
TARGET_ASYNC_URL="$(to_asyncpg "$TARGET_URL")"

if [[ "$TARGET_URL" =~ :6543/ ]]; then
  echo "warning: port 6543 is the transaction pooler; use the session pooler (5432) for migrations and pg_dump/psql." >&2
fi

if [[ -n "${PYTHON:-}" ]]; then PY="$PYTHON"
elif [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then PY="$BACKEND_DIR/.venv/bin/python"
else PY=python3
fi

psql_t() { psql "$TARGET_URL" -X -v ON_ERROR_STOP=1 -q "$@"; }
psql_s() { psql "$SOURCE_URL" -X -v ON_ERROR_STOP=1 -q "$@"; }

# ---------------------------------------------------------------- (a) preflight
log "Preflight"
need=(psql)
[[ "$MODE" == copy ]] && need+=(pg_dump pg_restore)
for bin in "${need[@]}"; do
  command -v "$bin" >/dev/null || die "$bin not found (install the PostgreSQL client tools)"
done
"$PY" -c 'import alembic, asyncpg' 2>/dev/null \
  || die "$PY lacks the backend requirements (pip install -r backend/requirements.txt or set PYTHON)"

echo "target: $(redact "$TARGET_URL")"
target_ver="$(psql_t -Atc 'show server_version')" || die "cannot connect to TARGET_URL"
echo "target server: PostgreSQL $target_ver"

if [[ "$MODE" == copy ]]; then
  echo "source: $(redact "$SOURCE_URL")"
  source_num="$(psql_s -Atc 'show server_version_num')" || die "cannot connect to SOURCE_URL (is docker compose up?)"
  source_major=$((source_num / 10000))
  dump_major="$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
  echo "source server major: $source_major, local pg_dump major: $dump_major"
  # pg_dump refuses to dump a server newer than itself; older servers are fine.
  (( dump_major >= source_major )) \
    || die "pg_dump $dump_major is older than the source server ($source_major); install a newer client"
fi

# ---------------------------------------------------------------- (b) schema
log "alembic upgrade head on target"
(
  cd "$BACKEND_DIR"
  DATABASE_URL="$TARGET_ASYNC_URL" "$PY" -m alembic upgrade head
)
vector_ver="$(psql_t -Atc "select extversion from pg_extension where extname = 'vector'")"
echo "pgvector on target: ${vector_ver:-missing}"
if [[ -z "$vector_ver" ]]; then
  die "vector extension missing after migrations"
elif ! "$PY" -c "import sys; v=tuple(int(x) for x in sys.argv[1].split('.')[:2]); sys.exit(v < (0, 8))" "$vector_ver"; then
  echo "warning: pgvector < 0.8 lacks hnsw.iterative_scan; filtered searches may return fewer rows." >&2
fi

COUNT_SQL="select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'alembic_version'
order by 1"

# ---------------------------------------------------------------- reseed mode
if [[ "$MODE" == reseed ]]; then
  log "Seeding target (python -m scripts.seed_database --count ${SEED_COUNT:-50} --reset)"
  (
    cd "$BACKEND_DIR"
    DATABASE_URL="$TARGET_ASYNC_URL" AUTO_MIGRATE=true \
      "$PY" -m scripts.seed_database --count "${SEED_COUNT:-50}" --reset
  )
  log "Row counts on target"
  psql_t -F $'\t' -Atc "$COUNT_SQL" | column -t -s $'\t'
  exit 0
fi

# ---------------------------------------------------------------- copy mode
existing="$(psql_t -Atc "select coalesce(sum(n), 0) from ($COUNT_SQL) t(name, n)")"
if (( existing > 0 )); then
  if [[ "${TRUNCATE_TARGET:-0}" == 1 ]]; then
    log "Truncating $existing existing target rows (TRUNCATE_TARGET=1)"
    psql_t <<'SQL'
select format('truncate table %s restart identity cascade',
              string_agg(format('public.%I', tablename), ', '))
from pg_tables where schemaname = 'public' and tablename <> 'alembic_version'
\gexec
SQL
  else
    die "target already has $existing rows (the API may have started against it). Re-run with TRUNCATE_TARGET=1 to replace them."
  fi
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT   # the dump contains user data (password hashes): never keep it

# (c) dump
log "pg_dump (data only) from source"
# (pg_dump warns about the self-referencing FK on freelancers; handled by the load below)
pg_dump "$SOURCE_URL" --data-only --no-owner --no-privileges -Fc \
  --schema=public --exclude-table=public.alembic_version -f "$WORK/data.dump"

# (d) restore: render to SQL, load in one transaction with FK triggers skipped if allowed
log "Loading data into target"
pg_restore --data-only --no-owner --no-privileges -f "$WORK/data.sql" "$WORK/data.dump"
if psql_t -c 'set session_replication_role = replica' >/dev/null 2>&1; then
  pre=(-c 'set session_replication_role = replica')
  echo "session_replication_role = replica allowed (FK triggers skipped during load)"
else
  pre=()
  echo "session_replication_role not permitted; relying on pg_dump's FK-ordered data"
fi
psql_t --single-transaction "${pre[@]}" -f "$WORK/data.sql" >/dev/null

# (e) sequences (serial and identity columns own their sequence)
log "Resetting sequences to max(id) + 1"
psql_t >/dev/null <<'SQL'
select format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)',
              seq.oid::regclass::text, att.attname, tbl.relname)
from pg_class seq
join pg_depend dep on dep.objid = seq.oid
  and dep.classid = 'pg_class'::regclass and dep.refclassid = 'pg_class'::regclass
  and dep.deptype in ('a', 'i')
join pg_class tbl on tbl.oid = dep.refobjid
join pg_namespace ns on ns.oid = tbl.relnamespace and ns.nspname = 'public'
join pg_attribute att on att.attrelid = tbl.oid and att.attnum = dep.refobjsubid
where seq.relkind = 'S'
\gexec
SQL

# (f) verify
log "Row counts (source vs target)"
psql_s -F $'\t' -Atc "$COUNT_SQL" | sort > "$WORK/source.tsv"
psql_t -F $'\t' -Atc "$COUNT_SQL" | sort > "$WORK/target.tsv"
mismatch=0
{
  printf 'table\tsource\ttarget\n'
  join -t $'\t' -a 1 -a 2 -e '-' -o '0,1.2,2.2' "$WORK/source.tsv" "$WORK/target.tsv" |
    while IFS=$'\t' read -r name src tgt; do
      flag=""; [[ "$src" != "$tgt" ]] && flag="  <-- mismatch"
      printf '%s\t%s\t%s%s\n' "$name" "$src" "$tgt" "$flag"
    done
} | column -t -s $'\t'
if ! diff -q "$WORK/source.tsv" "$WORK/target.tsv" >/dev/null; then mismatch=1; fi

if (( mismatch )); then
  die "row counts differ (tables only on one side show '-')"
fi
log "Done. Point DATABASE_URL at the +asyncpg form of TARGET_URL and hit /health."
