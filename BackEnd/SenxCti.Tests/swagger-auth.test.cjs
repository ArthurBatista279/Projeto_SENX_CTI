const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../SenxCti.Api/Program.cs'), 'utf8');
const script = source.match(/UseResponseInterceptor\("""([\s\S]*?)"""\)/)[1];
const calls = [];
const interceptor = vm.runInNewContext('(' + script + ')', {
    URL,
    window: {
        location: { origin: 'http://localhost:5080' },
        ui: {
            preauthorizeApiKey: (scheme, token) => calls.push([scheme, token]),
            authActions: { logout: schemes => calls.push(['logout', ...schemes]) }
        }
    }
});

const login = { url: 'http://localhost:5080/api/Login', status: 200, data: '{"token":"test-token"}' };
assert.equal(interceptor(login), login);
assert.deepEqual(calls.pop(), ['Bearer', 'test-token']);
interceptor({ url: '/api/Login', status: 200, obj: { token: 'parsed-token' } });
assert.deepEqual(calls.pop(), ['Bearer', 'parsed-token']);
interceptor({ url: '/api/Login', status: 401 });
assert.deepEqual(calls.pop(), ['logout', 'Bearer']);
interceptor({ url: '/api/Equipe', status: 200, data: '{"token":"unrelated"}' });
assert.equal(calls.length, 0);
console.log('PASS: Swagger aplica JWT do login, limpa login recusado e ignora outras rotas.');
