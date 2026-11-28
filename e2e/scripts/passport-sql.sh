#!/bin/bash
# READ-ONLY SQL against the kx-test Passport database through SSM (SELECT only). usage: passport-sql.sh "select ..."
set -euo pipefail
Q="$1"; case "$(echo "$Q" | tr 'A-Z' 'a-z')" in select*|"with "*) ;; *) echo "only SELECT allowed" >&2; exit 2;; esac
"$(dirname "$0")/ssm-run.sh" "docker exec kx-test-postgres-1 psql -U postgres -d passport -At -c \"$Q\" 2>&1 | head -80"
