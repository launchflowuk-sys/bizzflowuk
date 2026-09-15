#!/bin/sh
# Keep the disk from filling up between weekly prunes.
#
# WHY THIS EXISTS, in the words of the outage it is preventing.
#
# 15 Sep 2026, second outage of the day: every site 503. Postgres had crashed
# into "the database system is in recovery mode" because the disk was 100% full
# with 0 bytes free, so it could not write WAL.
#
# The cause was not a leak. Every Coolify deploy leaves behind an image tagged
# with the commit SHA -- about 1.75GB for this project once the API and web
# images are counted. A day of ordinary work is ten to fifteen pushes. That is
# 20-25GB on a 38GB disk, in one day.
#
# The weekly cron already in place could not help: it ran on Sundays and kept
# anything from the last 168 hours, which on a busy Tuesday is every single
# image ever built that week.
#
# So this runs HOURLY and is driven by PRESSURE rather than age. Age-based
# retention cannot be tuned safely when the rate varies by an order of
# magnitude between a quiet day and a release day; disk usage can.
#
# Safety:
#   - It only ever removes images. Volumes, containers and build cache that is
#     in use are untouched.
#   - `docker rmi` refuses to remove an image a container is using, so the
#     running deployment cannot be pulled out from under itself. That refusal
#     is the safety net, not an error.
#   - It works newest-first and stops the moment usage is back under the
#     target, so the most recent rollback images survive whenever possible.

set -eu

THRESHOLD=70      # start reclaiming above this percentage
TARGET=55         # stop once back under this
LOG=/var/log/disk-guard.log

usage() { df --output=pcent / | tail -1 | tr -dc '0-9'; }

now="$(usage)"
[ "$now" -lt "$THRESHOLD" ] && exit 0

echo "$(date -Is) disk at ${now}%, reclaiming" >>"$LOG"

# 1. Build cache first: always safe, the biggest single win, and never needed
#    again once a build has finished.
#
#    NO AGE FILTER, and that is the point. The first version of this kept
#    anything under 24h, which on a heavy day protects exactly the cache that
#    is causing the problem -- 15 Sep 2026 it was holding 9.6GB of cache all
#    created that same day, and the guard could not touch a byte of it while
#    the disk climbed. Build cache is a speed optimisation and nothing else:
#    losing it costs one slower build, never correctness. Under pressure that
#    is always the right trade.
docker builder prune -af >>"$LOG" 2>&1 || true

# 2. Then per-commit application images, oldest first. Anything in use is
#    skipped by docker itself.
docker images --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' \
  | grep -E '_(bizzflowuk-api|web):[0-9a-f]{40}' \
  | sort \
  | cut -f2 \
  | while read -r image; do
      [ "$(usage)" -lt "$TARGET" ] && break
      docker rmi "$image" >>"$LOG" 2>&1 || true
    done

# 3. Anything still dangling.
docker image prune -f >>"$LOG" 2>&1 || true

echo "$(date -Is) finished at $(usage)%" >>"$LOG"
