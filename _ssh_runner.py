import paramiko, time

host = '172.20.100.11'
user = 'app'
password = '2Gether2GetThere$'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, look_for_keys=False, allow_agent=False, timeout=10)

# Switch to ren and run the runner
commands = [
    'sudo -u ren -i bash -c "cd ~/actions-runner && ./run.sh" 2>&1',
]

for cmd in commands:
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(f'CMD: {cmd}')
    print(f'RC: {exit_status}')
    if out: print(f'OUT: {out[-500:]}')
    if err: print(f'ERR: {err[-500:]}')

client.close()
