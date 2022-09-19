const cors = require('cors');
const express = require('express');
const http = require('http');
const https = require('https');
const k8s = require('@kubernetes/client-node');
const {createProxyMiddleware} = require('http-proxy-middleware');
const fs = require('fs');

const APP_MODE = process.env.APP_MODE;
const NAMESPACE_FILTERS = process.env.NAMESPACE_FILTERS;
const NODE_ENV = process.env.NODE_ENV;
const DEBUG_VERBOSE = !!process.env.DEBUG_VERBOSE;

process.on('uncaughtException', err => console.error('Uncaught exception', err));

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const opts = {};
kc.applyToRequest(opts);

let k8sToken;
try {
    k8sToken = fs.readFileSync('/var/tmp/token').toString().replace();
} catch { console.log('No service account token mounted') }

try {
    k8sToken = fs.readFileSync('/run/secrets/kubernetes.io/serviceaccount/token').toString();
} catch { console.log('No service account token mounted') }

const target = kc.getCurrentCluster().server;
console.log('API URL: ', target);
const agent = new https.Agent({ca: opts.ca});
const proxySettings = {
    target,
    agent,
    ws: true,
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    onError,
};

if (DEBUG_VERBOSE) {
    proxySettings.onProxyRes = onProxyRes;
}

const k8sProxy = createProxyMiddleware(proxySettings);
const app = express();
app.disable('x-powered-by'); // for security reasons, best not to tell attackers too much about our backend
app.use(logging);
if (NODE_ENV !== 'production') app.use(cors());
app.use('/', preAuth, express.static('public'));
app.get('/config', getConfig);
app.use('/*', [setServiceAccountAuth, k8sProxy]);
app.use(handleErrors);

const port = process.env.SERVER_PORT || 4654;
const server = http.createServer(app).listen(port);
console.log(`Server started. Listening on port ${port}`);

server.on('upgrade', (req, socket, head) => {
    if (k8sToken && APP_MODE == 'ReadOnly') {
        req.headers.authorization = 'Bearer ' + k8sToken;
    }
    k8sProxy.upgrade(req, socket, head);
});

function setServiceAccountAuth(req, res, next) {
    if (k8sToken && APP_MODE == 'ReadOnly') {
        req.headers.authorization = 'Bearer ' + k8sToken;
    }
    next();
}

function preAuth(req, res, next) {
    const auth = req.header('Authorization');

    // If the request already contains an authorization header, pass it through to the client (as a cookie)
    if (auth && req.method === 'GET' && req.path === '/') {
        const value = auth.replace('Bearer ', '');
        res.cookie('Authorization', value, {maxAge: 60, httpOnly: false});
        console.log('Authorization header found. Passing through to client.');
    }

    next();
}

function logging(req, res, next) {
    res.once('finish', () => console.log(new Date(), req.method, req.url, res.statusCode));
    next();
}

async function getConfig(req, res, next) {
    try {
        res.json({mode: APP_MODE, namespaces: NAMESPACE_FILTERS});
    } catch (err) {
        next(err);
    }
}

function onError(err, req, res) {
    console.log('Error in proxied request', err, req.method, req.url);
}

const SENSITIVE_HEADER_KEYS = ['authorization'];

function scrubHeaders(headers) {
    const res = Object.assign({}, headers);
    SENSITIVE_HEADER_KEYS.forEach(function(key) {
        if (res.hasOwnProperty(key)) {
            delete res[key];
        }
    });
    return res;
}

function onProxyRes(proxyRes, req, res) {
    const reqHeaders = scrubHeaders(req.headers);
    console.log('VERBOSE REQUEST', req.method, req.protocol, req.hostname, req.url, reqHeaders);
    const proxyResHeaders = scrubHeaders(proxyRes.headers);
    console.log('VERBOSE RESPONSE', proxyRes.statusCode, proxyResHeaders);
}

function handleErrors(err, req, res, next) {
    console.error('An error occurred during the request', err, req.method, req.url);

    res.status(err.httpStatusCode || 500);
    res.send('Server error');
    next();
}

logClusterInfo();
async function logClusterInfo() {
    try {
        const versionClient = kc.makeApiClient(k8s.VersionApi);
        const versionResponse = await versionClient.getCode();
        const versionJson = JSON.stringify(versionResponse.body, null, 4);
        console.log('Version Info: ', versionJson);

        const apisClient = kc.makeApiClient(k8s.ApisApi);
        const apisResponse = await apisClient.getAPIVersions();
        const apis = apisResponse.body.groups.map(x => x.preferredVersion.groupVersion).sort();
        const apisJson = JSON.stringify(apis, null, 4);
        console.log('Available APIs: ', apisJson);
    } catch (err) {
        console.error('Error getting cluster info', err);
    }
}
