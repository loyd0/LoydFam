// Read-only HTTP checks. Point at an isolated test database when using fixture accounts.
import { readFileSync } from 'node:fs';
const base = process.env.VERIFY_URL || 'http://localhost:3001';
const email = process.env.VERIFY_EMAIL;
const password = process.env.VERIFY_PASSWORD;
if (!email || !password) throw new Error('Set VERIFY_EMAIL and VERIFY_PASSWORD securely');
const jar = new Map();
async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), { ...options, redirect: 'manual', headers: {
    ...options.headers, Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; '),
  } });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]; const at = pair.indexOf('=');
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return response;
}
const csrf = await (await request('/api/auth/csrf')).json();
await request('/api/auth/callback/credentials', { method: 'POST', headers: {
  'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1',
}, body: new URLSearchParams({csrfToken:csrf.csrfToken,email,password,callbackUrl:base}) });
const session = await (await request('/api/auth/session')).json();
if (!session.user) throw new Error('Login failed');
const isAdmin = session.user.role === 'ADMIN';
const results = [];
for (const path of ['/api/dashboard','/api/people','/api/tree','/api/places','/api/stats','/api/timeline','/api/export?format=csv','/api/export?format=json','/api/export?format=gedcom','/api/search?q=Loyd','/api/generations','/api/today']) {
  const response = await request(path); results.push({path,expected:200,actual:response.status});
  await response.arrayBuffer();
}
for (const path of ['/api/imports','/api/admin/settings']) {
  const response = await request(path); results.push({path,expected:isAdmin?200:403,actual:response.status});
}
const importResponse = await request('/api/import', {method:'POST',body:new FormData()});
results.push({path:'POST /api/import (empty)',expected:isAdmin?400:403,actual:importResponse.status});
if (process.env.VERIFY_WORKBOOK) {
  const form = new FormData(); form.set('file',new Blob([readFileSync(process.env.VERIFY_WORKBOOK)]),'family.xlsx');
  const response = await request('/api/import/preview',{method:'POST',body:form});
  results.push({path:'POST /api/import/preview',expected:isAdmin?200:403,actual:response.status});
}
const people = await (await request('/api/people')).json();
const id = people.people?.[0]?.id;
if (id && !isAdmin) {
  const profile = await (await request(`/api/people/${id}`)).json();
  results.push({path:'viewer contact privacy',expected:null,actual:profile.contact});
}
const failures = results.filter(r=>r.actual!==r.expected);
console.log(JSON.stringify({role:session.user.role,checks:results.length,passed:results.length-failures.length,failures},null,2));
process.exitCode=failures.length?1:0;
