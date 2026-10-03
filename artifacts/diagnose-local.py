from pathlib import Path
import base64
import hashlib
import hmac
import json
import os
import subprocess
import struct
import time
import urllib.parse
import urllib.request
import urllib.error
import zlib
import sys

ROOT = Path(__file__).resolve().parents[1]
values = {}
for line in (ROOT / 'backend/.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
url = urllib.parse.urlsplit(values['DATABASE_URL'])
env = os.environ.copy()
env.update(PGHOST=url.hostname, PGPORT=str(url.port or 5432),
           PGUSER=urllib.parse.unquote(url.username or ''),
           PGPASSWORD=urllib.parse.unquote(url.password or ''),
           PGDATABASE=url.path.lstrip('/'), PGCONNECT_TIMEOUT='8',
           PGSSLMODE=urllib.parse.parse_qs(url.query).get('sslmode', ['require'])[0],
           PGOPTIONS='-c default_transaction_read_only=on')

def query(sql):
    result = subprocess.run(['C:/Program Files/PostgreSQL/18/bin/psql.exe',
                             '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                            env=env, capture_output=True, text=True, timeout=20)
    if result.returncode:
        message = result.stderr
        for secret in [values['DATABASE_URL'], url.hostname, url.username,
                       url.password, env['PGUSER'], env['PGPASSWORD'], env['PGDATABASE']]:
            if secret:
                message = message.replace(secret, '[redacted]')
        raise RuntimeError(message[:1000])
    return result.stdout.strip()

tables = ['conversations', 'messages', 'appointments', 'call_sessions',
          'realtime_tickets', 'realtime_events', 'notifications']
print('migration_tables', json.dumps({name: query(
    "SELECT to_regclass('public." + name + "') IS NOT NULL") == 't'
    for name in tables}))
paths = query("SELECT image_url FROM foot_images WHERE image_url LIKE '/api/uploads/%' "
              "UNION ALL SELECT mask_url FROM ai_results WHERE mask_url LIKE '/api/uploads/%'").splitlines()
upload_dir = Path(values.get('UPLOAD_DIR') or 'uploads')
if not upload_dir.is_absolute():
    upload_dir = ROOT / 'backend' / upload_dir
present = sum((upload_dir / path.removeprefix('/api/uploads/')).is_file() for path in paths)
print('stored_images', json.dumps({'references': len(paths), 'present_locally': present,
                                 'missing_locally': len(paths) - present}))
owner = query("SELECT json_build_object('user_id', u.id, 'role', u.role) "
              "FROM examinations e JOIN patients p ON p.id=e.patient_id "
              "JOIN users u ON u.id=p.user_id WHERE e.id=20")
if owner:
    claims = json.loads(owner)
    claims.update(iss='footguard', iat=int(time.time()), exp=int(time.time()) + 60)
    def encode(data):
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode()
    unsigned = encode(b'{"alg":"HS256","typ":"JWT"}') + '.' + encode(json.dumps(claims).encode())
    token = unsigned + '.' + encode(hmac.new(values['JWT_SECRET'].encode(), unsigned.encode(), hashlib.sha256).digest())
    for path in ['/api/profile', '/api/conversations', '/api/notifications']:
        request = urllib.request.Request('http://127.0.0.1:8080' + path,
                                         headers={'Authorization': 'Bearer ' + token})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                print('local_route', json.dumps({'path': path, 'status': response.status}))
        except urllib.error.HTTPError as error:
            print('local_route', json.dumps({'path': path, 'status': error.code}))
    if '--analyze-preview' in sys.argv:
        # Synthetic protocol fixture; legacy preview creates no patient record.
        def chunk(kind, data):
            return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
        image = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', 32, 32, 8, 2, 0, 0, 0))
                 + chunk(b'IDAT', zlib.compress((b'\x00' + bytes([128]) * 96) * 32)) + chunk(b'IEND', b''))
        boundary = 'footguard-local-preview-check'
        body = (('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="diagnostic.png"\r\nContent-Type: image/png\r\n\r\n').encode()
                + image + ('\r\n--' + boundary + '--\r\n').encode())
        request = urllib.request.Request('http://127.0.0.1:8080/api/examinations/analyze', data=body,
                                         headers={'Authorization': 'Bearer ' + token,
                                                  'Content-Type': 'multipart/form-data; boundary=' + boundary})
        started = time.monotonic()
        with urllib.request.urlopen(request, timeout=25) as response:
            result = json.load(response)
            print('backend_ai_preview', json.dumps({'http_status': response.status,
                  'response_status': result.get('status'), 'elapsed_seconds': round(time.monotonic() - started, 2),
                  'overlay_present': bool(result.get('result', {}).get('overlay_image'))}))
