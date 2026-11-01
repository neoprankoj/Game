#!/bin/sh
# Runs once, when the data volume is first created (official postgres image entrypoint).
# Creates the separate database used by integration tests (TESTING_STRATEGY §2; Part 2.3 builds on it).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE "$POSTGRES_TEST_DB" OWNER "$POSTGRES_USER";
SQL
