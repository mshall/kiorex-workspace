Restore drill (do this once per quarter on a throw-away database, never on the live one):
  1. Fetch a dump:    aws s3 cp s3://<backup bucket>/dumps/<env>/<db>/<date>.sql.gz /tmp/ && gunzip /tmp/<date>.sql.gz
  2. Create scratch:  docker exec -i kx-<env>-postgres-1 psql -U postgres -c 'create database restore_check'
  3. Load:            docker exec -i kx-<env>-postgres-1 psql -U postgres restore_check < /tmp/<date>.sql
  4. Compare row counts of the main tables with the live database, then drop restore_check.
