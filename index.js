require('env2')('.env');

const Promise = require('bluebird');

const AwsHelper = require('aws-lambda-helper');
const parse_sns = require('./lib/parse_sns');
const api_request = require('./lib/api_request');
/**
 * handler receives an SNS message with search parameters and makes requests
 * to the ThomasCook Nordics "Classsic" Packages API. Once we get results
 * they are converted into the format required by GraphQL and inserted into
 * DynamoDB for retrieval by by the lambda-dynamo-search-result-retriever
 */

function normaliseParameters (event) {
  const params = parse_sns(event.Records[0].Sns.Message);
  params.stage = (AwsHelper.version === '$LATEST' || !AwsHelper.version) ? 'ci' : AwsHelper.version;
  params.hotelIds = params.hotelIds || [];
  return params;
}

function searchForPackages (params) {
  AwsHelper.log.trace({ hotels: params.hotelIds, hotelCount: params.hotelIds.length }, 'Searching for packages');
  return Promise.map(params.hotelIds, (id) => {
    const options = Object.assign({}, params, { hotelIds: id });
    return Promise.promisify(api_request)(options)
      .then((results) => {
        if (!results || results.length === 0) {
          AwsHelper.log.trace({ hotelId: id }, 'No packages found');
          return;
        }
        AwsHelper.log.trace({ hotelId: id, packageCount: results.length }, 'Found packages');
        return sendResultsToClient(options, results);
      });
  }, { concurrency: 10 });
}

function sendResultsToClient (params, results) {
  return Promise.map(results, (result) => {
    result.url = `${params.searchId}/${result.id}`;
    const output = Object.assign(params, { items: [result] });
    AwsHelper.log.trace({ result: output }, 'Sending result to client');
    return Promise.promisify(AwsHelper.pushResultToClient)(output)
      // resolve with data rather than AWS response
      .then(() => output);
  });
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
      return results.filter(r => r);
    })
    .then((results) => {
      AwsHelper.log.info({ results: results, count: results.length }, 'Package search complete');
      callback();
    })
    .catch(e => callback(e));
}

module.exports = {
  handler: handler
};
