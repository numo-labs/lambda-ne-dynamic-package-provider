'use strict';
/**
 * simple_http_request is a bare-bones http request using node.js core http
 * see: https://nodejs.org/api/http.html#http_http_request_options_callback
 * the NPM request module is 3.6 Megabytes and offers v. little benefit ...
 * This code achieves the same in less than 1kb. less code = faster response.
 * @param {Object} options - the standard http options (host, path, query, etc)
 * @param {Function} callback - a standard callback with error & response args
 * response is a JSON Object unless there is an error.
 */

const bl = require('bl');

function request (options, callback) {
  require('https').request(options, function (res) {
    // use bl to flatten the response stream into a buffer
    res.pipe(bl((err, body) => {
      let json;
      try {
        json = JSON.parse(body.toString());
      } catch (e) {
        /* istanbul ignore next */
        return callback(e);
      }
      return callback(err, json);
    }));
  }).end();
}

module.exports = {
  request: request
};

