'use strict';

const _ = { result: require('lodash.result') }; // see: https://git.io/vaRhs
const format_hotel_facts = require('./format_hotel_facts');
const path = require('path');
const img_map = require(path.resolve('./lib/ne-hotel-images-map.json'));

function map_hotel_images (images) {
  return images.map(function (image) {
    return {
      'type': 'image/jpeg',
      'displaySequence': null,
      'primary': null,
      'uri': image.url
    };
  });
}
// see: https://github.com/numo-labs/lambda-ne-hotel-images
function map_large_hotel_images (hotel) {
  const id = hotel.wvId;
  let images;
  if (img_map[id]) {
    images = img_map[id]['1280'] || img_map[id]['696'];
  }
  if (images && images.length > 0) {
    return images.map(function (url) {
      return {
        'type': 'image/jpeg',
        'displaySequence': null,
        'primary': null,
        'uri': url
      };
    });
  } else {
    if (hotel.images && hotel.images.length > 0) {
      return hotel.images.map(function (image) {
        return {
          'type': 'image/jpeg',
          'displaySequence': null,
          'primary': null,
          'uri': image.url
        };
      });
    } else { // return default image for hotels without images!!!
      const url = 'http://images1.spies.dk/images/SiteID11/SitePage/hotelbillede_mangler_975_350.jpg';
      return [{
        'type': 'image/jpeg',
        'displaySequence': null,
        'primary': null,
        'uri': url
      }]; // see: https://git.io/voLIE
    }
  }
}

function list_package_flights (direction, flights) {
  const sequence = direction === 'inbound' ? 2 : 1;

  return flights.map(function (flight) {
    const out_flights = flight.routes
      .filter((routes) => routes.routeSequence === sequence);

    return out_flights.map(function (routes) {
      const legs = routes.legs;
      const first_leg = legs[0];
      const last_leg = legs[legs.length - 1];

      return {
        'number': 'na', // the NE API does not return a flight number!! :-(
        'departure': {
          'localDateTime': first_leg.departureDateTime,
          'airport': {
            'code': first_leg.departureCode,
            'name': ''
          }
        },
        'arrival': {
          'localDateTime': last_leg.arrivalTime,
          'airport': {
            'code': last_leg.destinationCode
          }
        },
        'carrier': {
          'code': legs.map(leg => leg.carrierCode).join(',')
        }
      };
    });
  }).reduce(function (a, b) { return a.concat(b); }, []);
}

/**
 * map_ne_result_to_graphql does what its name suggests: maps NE API Search
 * results to the GraphQL SearchResults Schema so the results have the same
 * 'shape' (fields/structure) as what the client expects.
 * @param {Object} trip_results - the trip results from NE API.
 * @param {Object} hotels_results - the hotel info result (images, rating, etc.)
 * please see readme for examples of both these params.
 */
function parse (result, hotel) {
  if (!hotel) return; // return early if no hotel details for package
  const destinationCode = list_package_flights('outbound', result.flights)[0].arrival.airport.code;
  const departureCode = list_package_flights('outbound', result.flights)[0].departure.airport.code;
  return {
    'type': 'package',
    'id': hotel.wvId,
    'packageOffer': {
      // priority code is not in the graphql schema...
      'priorityCode': 'unavailable', // used for sorting display priority
      'hotel': {
        'id': _.result(hotel, 'wvid'), // issues/48
        'name': _.result(hotel, 'name'),
        'images': {
          'small': map_hotel_images(_.result(hotel, 'images')),
          'large': map_large_hotel_images(hotel)
        },
        'starRating': _.result(hotel, 'rating.guestRating') || (_.result(hotel, 'rating.doubledRating') / 2),
        'place': {
          'name': _.result(hotel, 'geographical.resortName'),
          'country': _.result(hotel, 'geographical.countryName'),
          'region': _.result(hotel, 'geographical.areaName')
        },
        'description': hotel.description, // ISEARCH-270,
        'concept': _.result(hotel, 'concept') || { id: '', title: '' }
      },
      'flights': {
        'outbound': list_package_flights('outbound', result.flights),
        'inbound': list_package_flights('inbound', result.flights)
      },
      'price': {
        'total': result.price,
        'perPerson': Math.ceil(result.price / (result.adults + result.children)).toFixed(2),
        'currency': result.currencyCode,
        'discountPrice': result.discount // issues/32
      },
      'provider': {
        'id': 'lambda-searcher',
        'reference': hotel.productCode, // ISEARCH-248
        'deepLink': result.tripUrl // link to book the trip!
      },
      'nights': result.duration,
      'amenities': format_hotel_facts(hotel),
      'destinationCode': destinationCode,
      'destinationName': 'unavailable', // TODO: update this
      'departureCode': departureCode
    }
  };
}

module.exports = {
  parse: parse
};
