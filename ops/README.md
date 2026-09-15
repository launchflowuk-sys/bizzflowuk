# Server operations

Scripts that live on the Hetzner box, kept here so they are in version control
rather than only in `/usr/local/bin` where nobody can see them.

## disk-guard.sh

Hourly, via `/etc/cron.d/docker-prune`. Reclaims Docker space when the root
disk goes over 70%, stopping at 55%.

**Why it exists.** On 15 Sep 2026 every site went down with the disk 100% full
and zero bytes free: Postgres could not write WAL and crashed into recovery
mode. There was no leak. Every Coolify deploy leaves an image tagged with its
commit SHA — about 1.75GB across api and web — and a working day is 10-15
pushes. That is 20-25GB on a 38GB disk, in one day.

**Two things it got wrong, both found the same night:**

1. The original was weekly with 168h retention. On a busy Tuesday, "anything
   from the last seven days" is every image built that week, so it could never
   help. Now hourly and driven by disk pressure, which is the thing that
   actually varies.

2. It pruned build cache older than 24h — which protects exactly the cache
   causing the problem. Shoji noticed the disk climbing again and it was
   holding 9.6GB of cache all created that same day. The age filter is gone:
   build cache is a speed optimisation, and losing it costs one slower build
   and never correctness.

Deploying this file does not install it. To update the server:

    scp -i ~/.ssh/lima_hetzner ops/disk-guard.sh root@167.233.218.87:/usr/local/bin/disk-guard.sh
    ssh -i ~/.ssh/lima_hetzner root@167.233.218.87 "chmod +x /usr/local/bin/disk-guard.sh"

Check what it has been doing: `tail /var/log/disk-guard.log`
