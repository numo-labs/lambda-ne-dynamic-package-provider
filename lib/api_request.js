var AwsHelper = require('aws-lambda-helper');
var http = require('./http_request');
var mapper = require('./result_mapper');
var clone = require('lodash.clonedeep');

/**
 * make_path_from_params constructs the string that is used to request
 * data from the nordics API.
 * @param {Object} params - the parameters for the search
 * e.g: {adults:2, children:1, allInclusive: 'true'}
 */
function make_path_from_params (params) {
  params = clone(params);
  var path = (params.path || 'dptrips') + '?'; // default to trips if unset
  params.hotelIds = params.hotelId;
  delete params.stage;
  delete params.hotelId;
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

// sort by cheapest price
function sort_by_price_asc (a, b) { // as a user I want to see cheapest holidays
  return a.price - b.price;
}

/**
 * get_hotel_info does exactly what it's name suggests; gets hotel info
 * from the NE API. the twist is that it first checks the Lambda's
 * HOTEL_INFO_CACHE and only does the http_request if it's not cached.
 * @param {Number} hid - the hotel id
 * @param {Function} callback - called once we have a result
 */
function get_hotel_info (params, callback) {
  params.path = 'hotels';
  var options = make_options(params);
  AwsHelper.log.trace({ req: options, hotelId: params.hotelId }, 'Fetching hotel info');
  http.request(options, function (err, data) {
    /* istanbul ignore if */
    if (err) {
      AwsHelper.log.info({ err: err }, 'Error retrieving hotel info from API');
      return callback(err);
    }
    return callback(err, data.result[0]);
  });
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
  const options = make_options(params);
  AwsHelper.log.trace({ req: options, hotelId: params.hotelId }, 'Fetching package info');
  http.request(options, function (err, data) {
    if (!err && data.result && Array.isArray(data.result) && data.result.length > 0) {
      const pkg = data.result.sort(sort_by_price_asc)[0]; // get cheapest package
      get_hotel_info(params, function (err, hotel) {
        /* istanbul ignore if */
        if (err) {
          AwsHelper.log.warn({ err: err, hotelId: params.hotelId, request: options }, 'Unable to get hotel info');
          return callback(err);
        }
        // format one package result at a time:
        const record = mapper.parse(pkg, hotel);
        callback(null, record);
      });
    } else {
      /* istanbul ignore if */
      if (err) {
        AwsHelper.log.warn({'api_request_error': err, 'hotelId': params.hotelId, request: options, date: new Date()}, 'Api request error');
      }
      return callback(err);
    }
  });
};

module.exports.get_hotel_info = get_hotel_info;
module.exports.make_path_from_params = make_path_from_params;
