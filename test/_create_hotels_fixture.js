require('env2')('.env');
var http_request = require('../lib/http_request');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var sample_results = path.resolve(__dirname + '/sample_results/') + '/';

var AwsHelper = require('aws-lambda-helper');
AwsHelper.init({
  invokedFunctionArn: 'arn:aws:lambda:eu-west-1:123456789:function:mylambda:ci'
});

function api_request (path, callback) {
  var options = {
    headers: {
      'Authorization': process.env.NE_API_KEY
    },
    port: 443,
    host: process.env.NE_API_ENDPOINT,
    path: path
  };
  http_request(options, callback);
}

var base = '/sd/hotels/';
// the first digit in the path is "Skip" and the second is "Take"
// so 31/30 means skip the first 31 results and take the next 30
// var range = ['0/100', '101/100', '201/100', '301/100']; // use this one to test
var range = ['0/1000', '1001/1000', '2001/1000', '3001/1000']; // all the hotels!
var count = range.length;
var all_hotels = []; // ALL the hotels are temporarily stored in this array

range.forEach(function (batch) { // parallel requests
  api_request(base + batch, function (err, res) {
    assert(!err);
    res.Result.forEach(function (item) {
      all_hotels.push(item);
    });

    if (--count === 0) { // once all requests are done
      var all_hotels_file = sample_results + 'all_hotels.json'; // ALL The Hotels!
      fs.writeFileSync(all_hotels_file, JSON.stringify(all_hotels, null, 2));
    }
  });
});
