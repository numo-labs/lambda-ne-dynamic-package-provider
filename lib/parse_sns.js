'use strict';

/**
 * isAdult = returns true id date of birth provided is before todays date 18 years ago
 */
function isAdult (dob) {
  const now = new Date();
  const then = now.setYear(now.getFullYear() - 18);
  const birth = new Date(dob);
  return birth < then;
}

/**
 * parse extracts the parameters from SNS Message
 * this will be extended as new parameters are added. see tests for format!
 */
function parse (event) {
  const msg = JSON.parse(event.Records[0].Sns.Message);
  const obj = {
    adults: 0,
    children: 0,
    searchId: msg.context.searchId, // github.com/numo-labs/lambda-search-request-handler/pull/57/
    id: msg.context.connectionId,
    userId: msg.context.userId
  };
  if (msg.query && msg.query.passengers && Array.isArray(msg.query.passengers)) {
    msg.query.passengers.forEach(function (p) {
      if (isAdult(p.birthday)) {
        obj.adults++;
      } else {
        obj.children++;
      }
    }); // use msg.data.content instead of msg.data.query as requested by Jimmy :-)
  }
  if (msg.content && msg.content.hotels && msg.content.hotels.length > 0) {
    obj.hotelIds = msg.content.hotels.map(function (h) {
      return h.split('.')[2]; // e.g: hotel:NE.wvHotelPartId.197915
    });
    // AwsHelper.log.info({ hotels: obj.hotelIds }, 'Hotel ids');
  }
  // travelPeriod.departureBetween
  if (msg.query.travelPeriod && msg.query.travelPeriod.departureBetween && msg.query.travelPeriod.departureBetween.length > 0) {
    obj.departureDate = msg.query.travelPeriod.departureBetween[0];
  }
  // departureAirports
  if (msg.query.departureAirports && msg.query.departureAirports[0] && msg.query.departureAirports[0].indexOf('.') > -1) {
    obj.departureCode = msg.query.departureAirports[0].split('.')[1];
  }
  // number of nights
  if (msg.query.travelPeriod && msg.query.travelPeriod.nights) {
    obj.duration = msg.query.travelPeriod.nights[0];
  }
  return obj;
}

module.exports = parse;
