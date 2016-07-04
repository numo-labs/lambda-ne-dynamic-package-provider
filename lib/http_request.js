var AwsHelper = require('aws-lambda-helper');

/**
 * simple_http_request is a bare-bones http request using node.js core http
 * see: https://nodejs.org/api/http.html#http_http_request_options_callback
 * the NPM request module is 3.6 Megabytes and offers v. little benefit ...
 * This code achieves the same in less than 1kb. less code = faster response.
 * @param {Object} options - the standard http options (host, path, query, etc)
 * @param {Function} callback - a standard callback with error & response args
 * response is a JSON Object unless there is an error.
 */
module.exports = function simple_http_request (options, callback) {
  require('https').request(options, function (res) {
    res.setEncoding('utf8');
    var resStr = '';
    res.on('data', function (chunk) {
      // console.log('>', chunk);
      resStr += chunk;
    }).on('end', function () {
      var json = null;
      var err = null;
      try { // avoid fatal error if ONE of the http requests has invalid JSON
        console.log(res.headers);
        console.log(resStr);
        json = JSON.parse(resStr);
      } catch (e) {
        err = e;
      }

      return callback(err, json);
    });
  }).on('error', function (e) {
    var req = 'https://' + options.host + options.path;
    AwsHelper.log.error({err: e, url: req}, 'API/HTTP Request Error');
    return callback(e);
  }).end(); // end the request
};
