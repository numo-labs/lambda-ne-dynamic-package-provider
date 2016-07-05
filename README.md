## Lambda Northern Europe (NE) Dynamic Package (Holiday) Provider

[![Codeship](https://img.shields.io/codeship/74c5e930-19f1-0134-ab85-4ecfcf5b1540/master.svg)](https://codeship.com/projects/159183)
[![Dependency Status](https://david-dm.org/numo-labs/lambda-ne-dynamic-package-provider.svg)](https://david-dm.org/numo-labs/lambda-ne-dynamic-package-provider)
[![devDependency Status](https://david-dm.org/numo-labs/lambda-ne-dynamic-package-provider/dev-status.svg)](https://david-dm.org/numo-labs/lambda-ne-dynamic-package-provider#info=devDependencies)

A lambda function that listens to an SNS topic,
makes a call to the Nordics' Price and Availability ("*Price & Avail*")
cache API and sends the results to a S3 and to the client app via WebSockets.

## API Gateway *Reverse Proxy*

In order to use the caching features of the AWS API Gateway
to cache requests made to the Nordics API, we need to create
an API Gateway endpoint.

Instead of directly calling the NE API endpoint, we use the following setup:

![lambda-api-gateway-reverse-proxy](https://cloud.githubusercontent.com/assets/194400/13613013/2a9d58ec-e562-11e5-81ca-27483c8b8c6c.png)

This meant that we had to create an API Gateway endpoint to serve as the
reverse-proxy.

at present this is pointing to the *Denmark* (`sd`) endpoint for our MVP,
but when we roll-out to more markets it will be 5 minutes of API Gateway setup
(*per NE region*) and roughly 20 mins to *map* the URL query parameters for
other regions.


## *Required* Environment Variables

To run/develop/test this Lambda *locally* you will need a few Environment Variables.
We recommend you export these using an `.env` file containing the following keys:
```
export API_GATEWAY_ENDPOINT=get_this_from_codeship
export NE_API_KEY=get_this_from_codeship
export NE_API_ENDPOINT=get_this_from_codeship
export AWS_REGION=eu-west-1
export AWS_IAM_ROLE=get_this_from_codeship
export AWS_ACCESS_KEY_ID=get_this_from_codeship
export AWS_SECRET_ACCESS_KEY=get_this_from_codeship
export AWS_S3_SEARCH_RESULT_BUCKET=numo-search-results
export WEBSOCKET_SERVER_URL=get_this_from_codeship
export LOG_LEVEL=fatal
```
> set the correct values ... the easiest place to get these is CodeShip: https://codeship.com/projects/138820/configure_environment
> login using an **incognito browser** window the `numo-labs-ci` (GitHub user)
> also, only set the `LOG_LEVEL` on your localhost leave it out for Prod so we log all errors.

## *Sample* NE Dynamic API Request & Response:

### List of Trips for a 2 adults & 3 children

When we request a list of ***dptrips*** with the following parameters:
```js
{
  adults: 2,
  children: 3
}
```

This translates to the following API Path:
```sh
/dptrips?adults=2&children=3
```

Sample response (*just one trip*):
```sh
{
  "result": [
    {
      "tripKey": "5153814995943278140",
      "tripDefinitionRuleId": 0,
      "siteId": 11,
      "marketUnitCode": "SD",
      "worldviewId": 486,
      "adults": 2,
      "children": 0,
      "duration": 3,
      "departureDate": "2016-07-10T00:00:00",
      "departureAirportWorldviewId": 1469,
      "departureAirportCode": "BLL",
      "price": 9074,
      "discount": 0,
      "currencyCode": "DKK",
      "isAllInclusive": false,
      "hotels": [
        {
          "sequence": 2,
          "productCode": "HROMVIFR",
          "boardCode": "B",
          "roomtypeDescription": "Dobbeltværelse inkl. morgenmad",
          "boardCodeDescription": "Morgenmad",
          "hotelPartWorldviewId": 119525
        }
      ],
      "flights": [
        {
          "sequence": 1,
          "routes": [
            {
              "legs": [
                {
                  "destinationCode": "FRA",
                  "carrierCode": "LH",
                  "departureCode": "BLL",
                  "departureDateTime": "2016-07-10T18:40:00",
                  "arrivalDateTime": "2016-07-10T20:05:00",
                  "flightNumber": "841"
                },
                {
                  "destinationCode": "FCO",
                  "carrierCode": "LH",
                  "departureCode": "FRA",
                  "departureDateTime": "2016-07-10T21:30:00",
                  "arrivalDateTime": "2016-07-10T23:15:00",
                  "flightNumber": "242"
                }
              ],
              "flightTime": "0435",
              "routeSequence": 1
            },
            {
              "legs": [
                {
                  "destinationCode": "BRU",
                  "carrierCode": "SN",
                  "departureCode": "FCO",
                  "departureDateTime": "2016-07-13T06:35:00",
                  "arrivalDateTime": "2016-07-13T08:45:00",
                  "flightNumber": "3188"
                },
                {
                  "destinationCode": "BLL",
                  "carrierCode": "SN",
                  "departureCode": "BRU",
                  "departureDateTime": "2016-07-13T09:45:00",
                  "arrivalDateTime": "2016-07-13T11:20:00",
                  "flightNumber": "2249"
                }
              ],
              "flightTime": "0445",
              "routeSequence": 2
            }
          ],
          "marketingCarrierCode": "LH"
        }
      ],
      "cruises": [],
      "tours": [],
      "transfers": [],
      "tripItinerary": "1:F_2:A",
      "expiryDate": "2016-07-05T19:34:19.5699716+02:00",
      "indexedDate": "2016-07-04T19:34:19.9700205+02:00",
      "tripUrl": "http://www.spies.dk/priceofferindependentaccomodationlist?QueryDepID=12676&QueryCtryID=6799&QueryAreaID=0&QueryResID=6800&QueryDepDate=20160710&QueryRetDate=20160713&QueryRoomAges=|42,42,&SelectedHotelCode=HROMVIFR&Price=9074&CategoryId=3&BestPrice=true",
      "searchKey": "11|0|1469|486|2016-07-10|3|2_|1:F_2:A"
    }
  ]
}
```

### List of Hotels

Given a list of dptrips (*from the dptrips API endpoint*) we still need to lookup
the Hotel details in order to get the photos, ratings, location, etc.

So, imagine that you searched the `/dptrips` API endpoint for 2 adults and 3 children
(*see above for result sample*) you would then need to *extract* the HotelID
from the packages results and *then* make a request to the `/hotels` endpoint
to get the additional data. in the NE API the hotel has the key: `wvHotelPartId`
e.g: `"wvHotelPartId": 10861`

```sh
/hotels?hotelIds=10861
```

```json
{
  "wvId": 10861,
  "caId": 8857,
  "name": "Altamar",
  "description": "Altamar er verdens mest klassiske Spies-hotel. Her kan vi tilbyde særlige Simon Spies-suiter, som blandt andet er indrettet med festlige indslag fra Simon. Vi kan også tilbyde Spies Easy Travel, som gør din rejse nemmere.\n\nPå Altamar får du de perfekte rammer for familiens ferie sammen - intet mindre. Det er et efterspurgt og meget værdsat Family Garden, som ligger højt og roligt på en sydvendt bjergskråning lige uden for Puerto Rico med en storslået udsigt over havet. Her findes alt, hvad der skal til, for at hele familien får en dejlig og afslappet ferie: opvarmede pools i vinterhalvåret, en hyggelig restaurant samt lejligheder til op til 5 personer.",
  "rating": {
    "guestRating": 4.4,
    "doubledRating": 7
  },
  "geographical": {
    "countryId": 179,
    "countryName": "Spanien",
    "areaId": 108069,
    "areaName": "Gran Canaria",
    "resortId": 605,
    "resortName": "Puerto Rico"
  },
  "location": {
    "latitude": 27.7886658,
    "longitude": -15.7194166
  },
  "url": "http://www.travel.net/de-kanariske-oer/puerto-rico/altamar",
  "concept": {
    "id": "familyGarden",
    "title": "Family Garden"
  },
  "images": [
    {
      "url": "http://images1.travel.net/images/Hotel/LPAALTA1093_1_13.jpg?v=17",
      "description": "",
      "width": 696,
      "height": 307
    },
    {
      "url": "http://images1.travel.net/images/Hotel/LPAALTA1093_2_30.jpg?v=47",
      "description": "Fra Altamar har du en fantastisk udsigt over Atlanterhavet",
      "width": 1280,
      "height": 853
    },
    {
      "url": "http://images1.travel.net/images/Hotel/LPAALTA1093_3_15.jpg?v=17",
      "description": "",
      "width": 232,
      "height": 131
    },
    {
      "url": "http://images1.travel.net/images/Hotel/LPAALTA1093_4_14.jpg?v=17",
      "description": "",
      "width": 380,
      "height": 215
    }
  ],
  "facts": [
    {
      "id": "OutdoorPool",
      "name": "Pool",
      "value": "2 stk."
    },
    {
      "id": "DistanceToBeach",
      "name": "Nærmeste strand",
      "value": "1,5 km"
    },
    {
      "id": "DistanceToCenter",
      "name": "Nærmeste centrum",
      "value": "500 m"
    },
    {
      "id": "Bar",
      "name": "Bar",
      "value": "Ja"
    },
    {
      "id": "ChildrenPool",
      "name": "Børnepool",
      "value": "Ja"
    },
    {
      "id": "Elevator",
      "name": "Elevator",
      "value": "(kabelelevatorer som til tider kan være forstyrrende)"
    },
    {
      "id": "PoolBar",
      "name": "Poolbar",
      "value": "Ja"
    },
    {
      "id": 130,
      "name": "Restaurant",
      "value": "1"
    },
    {
      "id": "MiniMarket",
      "name": "Minimarked",
      "value": "Ja"
    },
    {
      "id": "CleaningDaysPerWeek",
      "name": "Rengøring (antal dage pr. uge)",
      "value": "5"
    },
    {
      "id": "Internet",
      "name": "Internet",
      "value": "Mod betaling"
    },
    {
      "id": "WaterSlide",
      "name": "Vandrutsjebane",
      "value": "Nej"
    },
    {
      "id": "LolloAndBernie",
      "name": "Lollo och Bernie",
      "value": false
    },
    {
      "id": "IsAdultHotel",
      "name": "Adult hotel",
      "value": false
    },
    {
      "id": "AllInclusive",
      "name": "All Inclusive",
      "value": false
    }
  ],
  "hotelProduct": {
    "id": 43,
    "key": "FamilyGarden"
  },
  "interestProducts": [
    {
      "id": 61,
      "key": "AllTypesOfInclusive"
    },
    {
      "id": 85,
      "key": "AllChildrensClub"
    },
    {
      "id": 77,
      "key": "FreeWiFi"
    },
    {
      "id": 79,
      "key": "WiFiAllOverHotel"
    }
  ],
  "importUpdateId": "2016-03-15T10:25:06.315Z"
}
```

## Sample Package Result

> See: [/test/sample_results/sample_package.json](https://github.com/numo-labs/lambda-ne-dynamic-package-provider/blob/master/test/sample_results/sample_package.json)

Read:
+ http://docs.aws.amazon.com/apigateway/latest/developerguide/getting-started-aws-proxy.html
+ http://docs.aws.amazon.com/apigateway/latest/developerguide/request-response-data-mappings.html
