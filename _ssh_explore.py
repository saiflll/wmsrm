import paramiko, sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('172.20.100.11', username='app', password='2Gether2GetThere$', look_for_keys=False, allow_agent=False)

def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    return out, err

# Explore ren's home
out, err = run('sudo -u ren bash -c "ls -la ~/"')
print("=== ren home ===")
print(out)
if err: print("ERR:", err[:300])

# Find runner files
out, err = run('sudo -u ren bash -c "find /home/ren -maxdepth 3 -type f \\( -name \\\"run.sh\\\" -o -name \\\"*.service\\\" -o -name \\\"config.yml\\\" \\) 2>/dev/null"')
print("\n=== runner files ===")
print(out)

# Check processes running as ren
out, err = run('ps -u ren -o pid,comm --no-headers 2>/dev/null || echo "no processes"')
print("\n=== ren processes ===")
print(out[:300])

# Check common runner locations
out, err = run('ls -la /home/ren/actions-runner 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"')
print("\n=== /home/ren/actions-runner ===")
print(out)

out, err = run('ls -la /home/ren/runner 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"')
print("\n=== /home/ren/runner ===")
print(out)

client.close()
