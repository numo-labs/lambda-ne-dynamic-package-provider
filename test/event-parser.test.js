'use strict';

const makeEvent = require('./utils/make-event');
const parse = require('../lib/parse_sns');

const assert = require('assert');
const sinon = require('sinon');

describe('input parsing', () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers((new Date('2016-07-15')).getTime());
  });

  afterEach(() => {
    clock.restore();
  });

  it('removes prefixes from hotel ids', () => {
    const event = makeEvent({
      content: { hotels: ['hotel:ne.wvid.118060', 'hotel:ne.wvid.118061', 'hotel:ne.wvid.118062'] }
    });
    const output = parse(event);
    assert.deepEqual(output.hotelIds, ['118060', '118061', '118062']);
  });

  it('parses passenger birthdates into adults and children properties', () => {
    const event = makeEvent({
      query: {
        passengers: [
          { birthday: '1998-07-14' }, // adult
          { birthday: '1997-07-15' }, // adult
          { birthday: '1998-07-16' } // child
        ]
      },
      content: { hotels: ['hotel:ne.wvid.118060'] }
    });
    const output = parse(event);
    assert.equal(output.adults, 2);
    assert.equal(output.children, 1);
  });

  it('extracts departure date from event if it is present', () => {
    const event = makeEvent({
      query: {
        travelPeriod: {
          departureBetween: [
            '2016-08-20',
            '2016-08-27'
          ]
        }
      },
      content: { hotels: ['hotel:ne.wvid.118060'] }
    });
    const output = parse(event);
    assert.equal(output.departureDate, '2016-08-20');
  });

  it('extracts duration from event if it is present', () => {
    const event = makeEvent({
      query: {
        travelPeriod: {
          nights: [7]
        }
      },
      content: { hotels: ['hotel:ne.wvid.118060'] }
    });
    const output = parse(event);
    assert.equal(output.duration, 7);
  });
});
