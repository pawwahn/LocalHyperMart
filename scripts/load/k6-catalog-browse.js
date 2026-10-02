import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.API_BASE || 'http://localhost:8080';
const TOWN_ID = __ENV.TOWN_ID;

export const options = {
  vus: Number(__ENV.K6_VUS || 30),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  if (!TOWN_ID) {
    throw new Error('Set TOWN_ID to a pilot town UUID');
  }
}

export default function () {
  const url = `${BASE}/api/v1/catalog/items?townId=${TOWN_ID}&page=0&size=24`;
  const res = http.get(url, { tags: { name: 'catalog_browse' } });
  check(res, {
    'catalog status 200': (r) => r.status === 200,
    'catalog envelope success': (r) => {
      try {
        const body = r.json();
        return body.success === true;
      } catch {
        return false;
      }
    },
  });
  sleep(Number(__ENV.K6_SLEEP || 1));
}
