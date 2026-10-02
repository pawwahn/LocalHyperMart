import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.API_BASE || 'http://localhost:8080';
const TOWN_ID = __ENV.TOWN_ID;
const PHONE = __ENV.BUYER_PHONE;
const PASSWORD = __ENV.BUYER_PASSWORD;

export const options = {
  vus: Number(__ENV.K6_VUS || 20),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

export function setup() {
  if (!TOWN_ID) throw new Error('Set TOWN_ID');
  if (!PHONE || !PASSWORD) throw new Error('Set BUYER_PHONE and BUYER_PASSWORD');
}

export default function () {
  const loginRes = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ phone: PHONE, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } },
  );
  const loginOk = check(loginRes, {
    'login 200': (r) => r.status === 200,
  });
  if (!loginOk) {
    sleep(1);
    return;
  }
  let token = '';
  try {
    token = loginRes.json('data.accessToken');
  } catch {
    sleep(1);
    return;
  }
  const catalogRes = http.get(`${BASE}/api/v1/catalog/items?townId=${TOWN_ID}&page=0&size=12`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'catalog_browse_auth' },
  });
  check(catalogRes, { 'catalog 200': (r) => r.status === 200 });
  sleep(Number(__ENV.K6_SLEEP || 1));
}
