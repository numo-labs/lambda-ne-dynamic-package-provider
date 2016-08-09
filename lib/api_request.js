var AwsHelper = require('aws-lambda-helper');
var http_request = require('./http_request');
var mapper = require('./result_mapper');
var clone = require('lodash.clonedeep');
var HOTEL_INFO_CACHE = {}; // use lambda memory to serve requests even faster

/**
 * make_path_from_params constructs the string that is used to request
 * data from the nordics API.
 * @param {Object} params - the parameters for the search
 * e.g: {adults:2, children:1, allInclusive: 'true'}
 */
function make_path_from_params (params) {
  params = clone(params);
  var path = (params.path || 'dptrips') + '?'; // default to trips if unset
  delete params.path;  // ensure we don't send un-recognised params to NE API.
  delete params.searchId; // delete the params that the API does not recognise
  delete params.connectionId; // don't worry, this is a clone of the sns message
  delete params.userId; // so the params will still be sent back to client
  Object.keys(params).forEach(function (k, i) {
    path += k + '=' + params[k] + '&';
  });
  return path;
}

function make_options (params) {
  params = clone(params);
  return {
    host: process.env.API_GATEWAY_ENDPOINT,
    port: 443,
    path: '/' + params.stage + '/' + make_path_from_params(params)
  };
}

// sort by cheapest paxPrice
function sort_by_price_asc (a, b) { // as a user I want to see cheapest holidays
  return (a.paxPrice < b.paxPrice)
  ? 1 : ((b.paxPrice < a.paxPrice) ? -1 : 0);
}

/**
 * get_hotel_info does exactly what it's name suggests; gets hotel info
 * from the NE API. the twist is that it first checks the Lambda's
 * HOTEL_INFO_CACHE and only does the http_request if it's not cached.
 * @param {Number} hid - the hotel id
 * @param {Function} callback - called once we have a result
 */
function get_hotel_info (params, callback) {
  if (params.hotelIds && HOTEL_INFO_CACHE[params.hotelIds]) {
    return callback(null, HOTEL_INFO_CACHE[params.hotelIds]);
  } else {
    params.path = 'hotels';
    var options = make_options(params);
    AwsHelper.log.trace({ req: options, hotelId: params.hotelIds }, 'Fetching hotel info');
    http_request(options, function (err, data) {
      if (err) {
        AwsHelper.log.info({ err: err }, 'Error retrieving hotel info from API');
        return callback(err, data);
      } else {
        HOTEL_INFO_CACHE[params.hotelIds] = data.result; // cache for next time
        return callback(err, data.result);
      }
    });
  }
}

/**
 * api_request makes an https request to the API Gateway "Outbound" endpoint
 * which in turn makes the request to the NE "Classic" API (V2)
 * the reason for using the API Gateway is response Caching.
 * @param {Object} params - the parameters for the search
 * e.g: {adults:2, children:1, allInclusive: 'true'}
 * @param {Function} callback - the function to call when results returned
 * standard node params. e.g: function callback (err, response) { ... }
 */
module.exports = function api_request (params, callback) {
  params = clone(params);
  var options = make_options(params);
  AwsHelper.log.trace({ req: options, hotelId: params.hotelIds }, 'Fetching package info');
  http_request(options, function (err, data) {
    if (!err && data.result && Array.isArray(data.result) && data.result.length > 0) {
      var pkg = [data.result.sort(sort_by_price_asc)[0]]; // get cheapest package
      get_hotel_info(params, function (err, hotel_info) {
        /* istanbul ignore if */
        if (err) {
          AwsHelper.log.warn({ err: err, hotelId: params.hotelId, request: options }, 'Unable to get hotel info');
        }
        // format one package result at a time:
        var records = mapper.map_ne_result_to_graphql(pkg, hotel_info);
        callback(null, records);
      });
    } else {
      if (err) {
        AwsHelper.log.warn({'api_request_error': err, 'hotelId': params.hotelId, request: options, date: new Date()}, 'Api request error');
      }
      return callback(null, []);
    }
  });
};

module.exports.get_hotel_info = get_hotel_info;
module.exports.make_path_from_params = make_path_from_params;
