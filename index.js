require('env2')('.env');

const Promise = require('bluebird');
const pick = require('lodash.pick');

const AwsHelper = require('aws-lambda-helper');
const parseSns = require('./lib/parse_sns');
const request = require('./lib/api_request');
/**
 * handler receives an SNS message with search parameters and makes requests
 * to the ThomasCook Nordics "Classsic" Packages API. Once we get results
 * they are converted into the format required by GraphQL and inserted into
 * DynamoDB for retrieval by by the lambda-dynamo-search-result-retriever
 */

function normaliseParameters (event) {
  const params = parseSns(event);
  params.stage = (AwsHelper.version === '$LATEST' || !AwsHelper.version) ? 'ci' : AwsHelper.version;
  params.hotelIds = params.hotelIds || [];
  return params;
}

function searchForPackages (params) {
  AwsHelper.log.trace({ hotels: params.hotelIds, hotelCount: params.hotelIds.length }, 'Searching for packages');
  return Promise.map(params.hotelIds, search(params), { concurrency: 10 })
    .then((results) => {
      return results.filter(r => r);
    })
    .then((results) => {
      return sendCompleteMessage(params, results);
    });
}

function search (params) {
  return (id) => {
    const options = Object.assign({}, params, { hotelId: id });
    return Promise.promisify(request)(options)
      .then((result) => {
        if (!result) {
          AwsHelper.log.trace({ hotelId: id }, 'No packages found');
          return;
        }
        AwsHelper.log.trace({ hotelId: id }, 'Found packages');
        return sendResultsToClient(options, result);
      });
  };
}

function sendResultsToClient (params, result) {
  result.url = `${params.searchId}/${result.id}`;
  const output = cleanResult(Object.assign(params, { items: [result] }));
  AwsHelper.log.trace({ result: output }, 'Sending result to client');
  return Promise.promisify(AwsHelper.pushResultToClient)(output)
    // resolve with data rather than AWS response
    .then(() => output);
}

function sendCompleteMessage (params, results) {
  const output = cleanResult(Object.assign({}, params, { items: [], searchComplete: true }));
  AwsHelper.log.info({ results: results, count: results.length }, 'Package search complete');
  return Promise.promisify(AwsHelper.pushResultToClient)(output);
}

function cleanResult (result) {
  return pick(result, ['id', 'searchId', 'userId', 'items', 'searchComplete']);
}

function handler (event, context, callback) {
  AwsHelper.init(context, event); // to extract the version (ci/prod) from Arn
  AwsHelper.Logger('lambda-ne-dynamic-package-provider');

  return Promise.resolve()
    .then(() => {
      return normaliseParameters(event);
    })
    .then((params) => {
      return searchForPackages(params);
    })
    .then((results) => {
      callback(null, results);
    })
    .catch(e => callback(e));
}

module.exports = {
  handler: handler
};
