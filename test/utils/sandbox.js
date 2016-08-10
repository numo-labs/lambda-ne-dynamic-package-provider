/**
 * Helper function to allow mocha to nicely report errors in assertions
 * Normally an error thrown in an async callback will result in an
 * unhandledException. By wrapping in a try/catch block and passing any
 * assertion errors back to the mocha callback we can utilise mocha's
 * error reporting properly.
 */
module.exports = function (done, callback) {
  return function () {
    try {
      callback.apply(null, arguments);
      done();
    } catch (e) {
      done(e);
    }
  };
};
