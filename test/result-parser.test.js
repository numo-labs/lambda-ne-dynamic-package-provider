'use strict';

const parser = require('../lib/result_mapper');
const imageFixture = require('../lib/ne-hotel-images-map.json');
const assert = require('assert');
const clone = require('lodash.clonedeep');

describe('result parser', () => {
  let pkg, hotel;

  beforeEach(() => {
    pkg = clone(require('./fixtures/packages-118060.json').result[0]);
    hotel = clone(require('./fixtures/hotels-118060.json').result[0]);
  });

  it('returns a merged object from input package and hotel', () => {
    const result = parser.parse(pkg, hotel);
    assert.equal(typeof result, 'object');
  });

  it('returns nothing if no hotel is provided', () => {
    const result = parser.parse(pkg);
    assert.equal(result, undefined);
  });

  it('sets the id property to the wvid of the hotel', () => {
    const result = parser.parse(pkg, hotel);
    assert.equal(result.id, 118060);
  });

  it('loads resized images from fixture to save bandwidth', () => {
    hotel.images = [];
    const result = parser.parse(pkg, hotel);
    const images = result.packageOffer.hotel.images.large;
    assert.equal(images.length, imageFixture['118060']['696'].length);
    images.forEach((image, index) => {
      assert.equal(image.uri, imageFixture['118060']['696'][index]);
      assert.equal(image.type, 'image/jpeg');
    });
  });

  it('uses images from hotel response if there is no result in the fixture corresponding to its id', () => {
    hotel.images = [{ url: 'http://example.com/image.jpeg' }];
    hotel.wvId = 'not-in-map';
    const result = parser.parse(pkg, hotel);
    const images = result.packageOffer.hotel.images.large;
    assert.equal(images.length, 1);
    assert.equal(images[0].uri, 'http://example.com/image.jpeg');
    assert.equal(images[0].type, 'image/jpeg');
  });

  it('adds a default image if no images are available', () => {
    hotel.images = [];
    hotel.wvId = 'not-in-map';
    const result = parser.parse(pkg, hotel);
    const images = result.packageOffer.hotel.images.large;
    assert.equal(images.length, 1);
    assert.equal(images[0].uri, 'http://images1.spies.dk/images/SiteID11/SitePage/hotelbillede_mangler_975_350.jpg');
    assert.equal(images[0].type, 'image/jpeg');
  });

  describe('amenities', () => {
    it('is empty if the hotel does not contain a `facts` object', () => {
      hotel.facts = null;
      const result = parser.parse(pkg, hotel);
      assert.deepEqual(result.packageOffer.amenities, {});
    });

    it('maps facts array to an object - keyed by fact id', () => {
      hotel.facts = [
        { id: 'DistanceToCenter', name: 'Center', value: '500 m' },
        { id: 'DistanceToBeach', name: 'Beach', value: '300 m' }
      ];
      const result = parser.parse(pkg, hotel);
      assert.deepEqual(result.packageOffer.amenities, {
        distancetocenter: '500 m',
        distancetobeach: '300 m'
      });
    });

    it('maps truthy strings to boolean `true` values', () => {
      hotel.facts = [
        { id: 'OutdoorPool', name: 'Pool', value: 'Ja' },
        { id: 'DistanceToBeach', name: 'Beach', value: '300 m' }
      ];
      const result = parser.parse(pkg, hotel);
      assert.deepEqual(result.packageOffer.amenities, {
        outdoorpool: true,
        distancetobeach: '300 m'
      });
    });
  });
});
