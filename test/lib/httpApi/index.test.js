/* global describe, it, beforeEach, afterEach */

const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

proxyquire.noPreserveCache();

describe('HttpApi', () => {
    describe('Class', () => {
        const httpApi = require('../../../lib/httpApi/index.js'); // eslint-disable-line global-require

        it('should be an object', () => {
            assert.ok(typeof httpApi === 'object');
        });

        it('must store config parameters', () => {
            const config = { foo: 'bar' };
            httpApi.setConfig(config);
            assert.equal(httpApi.config, config);
        });
    });

    describe('_start()', () => {
        // define two similar testcases
        const dataProvider = [
            {
                label: 'must register the default route at express', config: {}, getFromObjectFirst: undefined, postArgCount: 2,
            },
            {
                label: 'must register an authorization middleware',
                config: { accessToken: 'access-token' },
                getFromObjectFirst: 'access-token',
                postArgCount: 3,
            },
        ];
        dataProvider.forEach((data) => {
            it(data.label, async () => {
                // create an AppStub to let the Promise return
                const appStub = {
                    post: sinon.stub(),
                    options: sinon.stub(),
                };

                const httpApi = require('../../../lib/httpApi/index.js'); // eslint-disable-line global-require
                httpApi.setConfig(data.config);
                httpApi.setRouter({});
                httpApi.setApp(appStub);
                await httpApi._start();

                assert.ok(appStub.post.calledWith('/api/message'));
                assert.equal(data.postArgCount, appStub.post.getCall(0).args.length);
                assert.ok(appStub.options.called);
                assert.ok(appStub.options.calledWith('/api/message'));
            });
        });
    });

    describe('speak()', () => {
        it('sends a reply', async () => {
            const resStub = { send: sinon.stub() };
            const httpApi = require('../../../lib/httpApi/index.js'); // eslint-disable-line global-require

            // set up the list of open requests
            httpApi.openRequests = { uuid: { res: resStub, timer: undefined } };
            const message = { output: 'reply', metadata: { uuid: 'uuid', requestMetadata: {} } };

            await httpApi.speak(message);

            // test that the reply is send
            const expectedMessage = { id: 'uuid', message: { message: 'reply', metadata: {} } };
            assert.equal(JSON.stringify(expectedMessage), resStub.send.getCall(0).args[0]);

            // test that the openRequest is cleaned up
            assert.equal(undefined, httpApi.openRequests.uuid);
        });

        it('fails if there is no open request', async () => {
            const httpApi = require('../../../lib/httpApi/index.js'); // eslint-disable-line global-require

            const message = { output: 'reply', metadata: { uuid: 'uuid', requestMetadata: {} } };
            try {
                await httpApi.speak(message);
                throw new Error('catch() was expected, not then()');
            } catch (err) {
                assert.deepEqual(new Error('Uuid not found in list of open requests.'), err);
            }
        });
    });

    describe('_isAuthenticated()', () => {
        it('allows a request with valid accessToken', () => {
            const reqStub = {
                headers: {
                    authorization: 'Bearer access-token',
                },
            };

            const nextStub = sinon.stub();
            nextStub.returns('ok - nextStub');
            const httpApi = require('../../../lib/httpApi/index.js'); // eslint-disable-line global-require
            httpApi.setConfig({ accessToken: 'access-token' });

            const result = httpApi._isAuthenticated(reqStub, {}, nextStub);
            assert.equal('ok - nextStub', result);
            assert.ok(nextStub.calledOnce);
        });

        const dataProvider = [
            { label: 'returns a 401 on no Authorization header', headers: [] },
            { label: 'returns a 401 on invalid Authorization header', headers: { authorization: 'invalid' } },
        ];

        dataProvider.forEach((data) => {
            it(data.label, () => {
                const reqStub = {
                    headers: data.headers,
                };
                const resStub = {
                    status: sinon.stub(),
                    send: sinon.stub(),
                };
                resStub.status.returns(resStub);

                const nextStub = sinon.stub();
                const httpApi = require('../../../lib/httpApi/index.js'); // eslint-disable-line global-require
                httpApi.setConfig({ accessToken: 'access-token' });

                httpApi._isAuthenticated(reqStub, resStub, nextStub);
                assert.ok(nextStub.notCalled);
                assert.ok(resStub.status.calledOnce);
                assert.ok(resStub.status.calledWithExactly(401));
                assert.ok(resStub.send.calledOnce);
                assert.equal(JSON.stringify({ error: 'Invalid accessToken' }), resStub.send.getCall(0).args[0]);
            });
        });
    });

    describe('_handleMessage', () => {
        const uuidv4Stub = sinon.stub();
        const setHeaderStub = sinon.stub();
        let clock = null;

        afterEach(() => {
            uuidv4Stub.reset();
            setHeaderStub.reset();
            if (clock !== null) {
                clock.restore();
                clock = null;
            }
        });
        beforeEach(() => {
            uuidv4Stub.returns('uuidv4');
        });

        it('forwards the message to the router', async () => {
            const httpApi = proxyquire('../../../lib/httpApi/index.js', { 'uuid/v4': uuidv4Stub });
            const heardStub = sinon.stub();

            httpApi.setRouter({ heard: heardStub });
            httpApi.setConfig({});
            const sendStub = sinon.stub();
            const res = { setHeader: setHeaderStub, send: sendStub };
            sinon.stub(httpApi, '_sendCorsHeaders');

            await httpApi._handleMessage({ body: { input: 'hello' } }, res);

            assert.ok(uuidv4Stub.calledOnce);
            assert.ok(httpApi._sendCorsHeaders.calledOnce);
            assert.ok(setHeaderStub.calledOnce);
            assert.ok(setHeaderStub.calledWithExactly('Content-Type', 'application/json'));
            assert.ok(heardStub.calledOnce);
            assert.deepEqual({ input: 'hello', metadata: { uuid: 'uuidv4', requestMetadata: {} } }, heardStub.getCall(0).args[0]);
            assert.equal(1, Object.keys(httpApi.openRequests).length);
            assert.notEqual(undefined, httpApi.openRequests.uuidv4);
            assert.deepEqual(res, httpApi.openRequests.uuidv4.res);
        });
        it('fails if there is no input attribute in request', async () => {
            const httpApi = proxyquire('../../../lib/httpApi/index.js', { 'uuid/v4': uuidv4Stub });
            const sendStub = sinon.stub();
            sinon.stub(httpApi, '_sendCorsHeaders');

            try {
                await httpApi._handleMessage({ body: {} }, { setHeader: setHeaderStub, send: sendStub });
                throw new Error('Error is expected.');
            } catch (err) {
                assert.ok(uuidv4Stub.calledOnce);
                assert.equal(1, setHeaderStub.callCount);
                assert.ok(setHeaderStub.calledWithExactly('Content-Type', 'application/json'));
                assert.ok(sendStub.calledOnce);
                assert.equal(
                    JSON.stringify({ id: 'uuidv4', error: 'No input attribute found in request.' }),
                    sendStub.getCall(0).args[0],
                );
                httpApi._sendCorsHeaders.restore();
            }
        });
        it('sets a timeout', async () => {
            clock = sinon.useFakeTimers();

            const httpApi = proxyquire('../../../lib/httpApi/index.js', { 'uuid/v4': uuidv4Stub });
            const heardStub = sinon.stub();

            httpApi.setConfig({});
            httpApi.setRouter({ heard: heardStub });
            const sendStub = sinon.stub();
            const res = { setHeader: setHeaderStub, send: sendStub };
            sinon.stub(httpApi, '_sendCorsHeaders');

            await httpApi._handleMessage({ body: { input: 'hello' } }, res);

            clock.tick(5001);
            assert.equal(0, Object.keys(httpApi.openRequests).length);
            assert.ok(res.send.calledOnce);
            assert.equal(JSON.stringify({ id: 'uuidv4', error: 'Timeout contacting brain.' }), res.send.getCall(0).args[0]);
        });
    });

    describe('_sendCorsHeaders()', () => {
        it('sends CORS headers', () => {
            const httpApi = require('../../../lib/httpApi/index.js'); // eslint-disable-line global-require
            const headerStub = sinon.stub();

            httpApi._sendCorsHeaders({ header: headerStub });
            assert.ok(headerStub.calledThrice);
            assert.ok(headerStub.getCall(0).calledWithExactly('Access-Control-Allow-Origin', '*'));
            assert.ok(headerStub.getCall(1).calledWithExactly('Access-Control-Allow-Methods', 'POST,OPTIONS'));
            assert.ok(headerStub.getCall(2).calledWithExactly('Access-Control-Allow-Headers', 'Content-Type,Authorization'));
        });
    });
});
