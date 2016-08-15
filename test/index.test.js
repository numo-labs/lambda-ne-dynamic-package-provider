'use strict';

const assert = require('assert');
const sinon = require('sinon');
const AwsHelper = require('aws-lambda-helper');
const nock = require('nock');

const handler = require('../index').handler;
const sandbox = require('./utils/sandbox');
const makeEvent = require('./utils/make-event');
const mockApi = require('./utils/mock-api');

const context = {
  functionName: 'LambdaTest',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:eu-west-1:655240711487:function:LambdaTest:$LATEST'
};

describe('integration', () => {
  beforeEach(() => {
    sinon.stub(AwsHelper, 'pushResultToClient').yieldsAsync(null, {});
  });

  afterEach(() => {
    AwsHelper.pushResultToClient.restore();
  });

  describe('handler', () => {
    assert.equal(typeof handler, 'function');
  });

  describe('invocation', () => {
    it('does nothing if no hotel ids are sent', (done) => {
      const event = makeEvent({ content: { hotels: [] } });
      handler(event, context, sandbox(done, (err, result) => {
        assert.equal(err, null);
        assert.equal(AwsHelper.pushResultToClient.calledOnce, true);
        assert.equal(AwsHelper.pushResultToClient.lastCall.args[0].searchComplete, true);
        assert.deepEqual(AwsHelper.pushResultToClient.lastCall.args[0].items, []);
      }));
    });

    it('makes a query to the packages api for each hotel id provided', (done) => {
      const event = makeEvent({ content: { hotels: ['hotel:ne.wvid.119870', 'hotel:ne.wvid.118060'] } });
      const api = mockApi('/ci/dptrips', {
        '119870': 'packages-no-results.json',
        '118060': 'packages-no-results.json'
      });
      handler(event, context, sandbox(done, () => {
        api.done();
      }));
    });

    it('makes a query to get hotel details if packages are found', (done) => {
      const event = makeEvent({ content: { hotels: ['hotel:ne.wvid.119870', 'hotel:ne.wvid.118060'] } });
      const packagesApi = mockApi('/ci/dptrips', {
        '119870': 'packages-no-results.json',
        '118060': 'packages-118060.json'
      });
      const hotelsApi = mockApi('/ci/hotels', {
        '118060': 'hotels-118060.json'
      }); // only pass one id, because 119870 does not have packages
      handler(event, context, sandbox(done, () => {
        packagesApi.done();
        hotelsApi.done();
      }));
    });

    it('sends package results to AwsHelper#pushResultToClient', (done) => {
      const event = makeEvent({ content: { hotels: ['hotel:ne.wvid.118060'] } });
      mockApi('/ci/dptrips', {
        '118060': 'packages-118060.json'
      });
      mockApi('/ci/hotels', {
        '118060': 'hotels-118060.json'
      });
      handler(event, context, sandbox(done, (err) => {
        if (err) throw err;
        assert(AwsHelper.pushResultToClient.calledTwice);
        assert.equal(AwsHelper.pushResultToClient.getCall(0).args[0].items.length, 1);
        assert.equal(AwsHelper.pushResultToClient.getCall(1).args[0].items.length, 0);
      }));
    });

    it('calls api endpoint based on environment from function ARN', (done) => {
      const event = makeEvent({ content: { hotels: ['hotel:ne.wvid.118060'] } });
      const prod = Object.assign({}, context, { invokedFunctionArn: 'arn:aws:lambda:eu-west-1:655240711487:function:LambdaTest:prod' });
      const packagesApi = mockApi('/prod/dptrips', {
        '118060': 'packages-118060.json'
      });
      const hotelsApi = mockApi('/prod/hotels', {
        '118060': 'hotels-118060.json'
      });
      handler(event, prod, sandbox(done, () => {
        packagesApi.done();
        hotelsApi.done();
      }));
    });

    it('calls back with error if sending to client fails', (done) => {
      const error = new Error('test error');
      AwsHelper.pushResultToClient.yieldsAsync(error);
      const event = makeEvent({ content: { hotels: ['hotel:ne.wvid.118060'] } });
      mockApi('/ci/dptrips', {
        '118060': 'packages-118060.json'
      });
      mockApi('/ci/hotels', {
        '118060': 'hotels-118060.json'
      });
      handler(event, context, sandbox(done, (err) => {
        assert(err instanceof Error);
        assert.equal(err.message, 'test error');
      }));
    });

    it('ignores errors in package api calls', (done) => {
      const event = makeEvent({ content: { hotels: ['hotel:ne.wvid.118060'] } });
      nock(`https://${process.env.API_GATEWAY_ENDPOINT}`)
        .get('/ci/dptrips')
        .query(true)
        .reply(404, {});
      handler(event, context, sandbox(done, (err, result) => {
        assert(!err);
        assert.deepEqual(result, []);
      }));
    });
  });

  describe('results format', function () {
    let event;

    beforeEach((done) => {
      event = makeEvent({
        content: { hotels: ['hotel:ne.wvid.118060', 'hotel:ne.wvid.109600'] },
        context: { connectionId: 'connection', userId: 'user', searchId: 'search' }
      });
      mockApi('/ci/dptrips', {
        '118060': 'packages-118060.json',
        '109600': 'packages-109600.json'
      });
      mockApi('/ci/hotels', {
        '118060': 'hotels-118060.json',
        '109600': 'hotels-109600.json'
      });
      handler(event, context, sandbox(done, (err) => {
        if (err) throw err;
        assert.equal(AwsHelper.pushResultToClient.callCount, 3);
      }));
    });

    it('sends one result per package found', () => {
      assert.equal(AwsHelper.pushResultToClient.getCall(0).args[0].items.length, 1);
      assert.equal(AwsHelper.pushResultToClient.getCall(1).args[0].items.length, 1);
      assert.equal(AwsHelper.pushResultToClient.getCall(2).args[0].items.length, 0);
      assert.equal(AwsHelper.pushResultToClient.getCall(2).args[0].searchComplete, true);
    });

    it('sets a `type` of package on results', () => {
      assert.equal(AwsHelper.pushResultToClient.getCall(0).args[0].items[0].type, 'package');
      assert.equal(AwsHelper.pushResultToClient.getCall(1).args[0].items[0].type, 'package');
    });

    it('includes the package details of the cheapest package for each hotel', () => {
      const calls = [ AwsHelper.pushResultToClient.getCall(0), AwsHelper.pushResultToClient.getCall(1) ];
      const keyedResults = calls.reduce((map, call) => {
        map[call.args[0].items[0].id] = call.args[0];
        return map;
      }, {});
      assert.equal(keyedResults['109600'].items[0].packageOffer.price.total, 16300);
      assert.equal(keyedResults['118060'].items[0].packageOffer.price.total, 14542);
    });

    it('includes id, searchId and userId properties from event', () => {
      const result = AwsHelper.pushResultToClient.lastCall.args[0];
      assert.equal(result.id, 'connection');
      assert.equal(result.userId, 'user');
      assert.equal(result.searchId, 'search');
    });
  });
});
