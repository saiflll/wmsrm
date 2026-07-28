import subprocess, os
os.environ['SSH_ASKPASS'] = r'C:\Users\Lenovo\Downloads\wms-master\pw.cmd'
os.environ['DISPLAY'] = 'dummy:0'

p = subprocess.Popen(
    ['ssh', '-o', 'BatchMode=no', '-o', 'StrictHostKeyChecking=no', 'app@172.20.100.11', 'echo SSH_OK && whoami'],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    creationflags=subprocess.CREATE_NO_WINDOW
)
out, err = p.communicate(timeout=15)
print('RC:', p.returncode)
print('OUT:', out)
print('ERR:', err[:300] if err else '')
