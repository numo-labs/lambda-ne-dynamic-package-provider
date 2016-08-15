const clone = require('lodash.clonedeep');
const event = require('../fixtures/event.json');

module.exports = function (input) {
  const base = clone(event);
  const message = JSON.parse(base.Records[0].Sns.Message);
  Object.assign(message, input);
  base.Records[0].Sns.Message = JSON.stringify(message);
  return base;
};
