const nock = require('nock');
const path = require('path');

function mockApi (url, map) {
  const api = nock(`https://${process.env.API_GATEWAY_ENDPOINT}`);
  Object.keys(map).forEach((id) => {
    api.get(url)
      .query((qs) => qs.hotelIds === id)
      .replyWithFile(200, path.resolve(__dirname, `../fixtures/${map[id]}`));
  });
  return api;
}

module.exports = mockApi;
