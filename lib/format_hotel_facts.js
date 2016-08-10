/**
 * format_hotel_facts extracts 'facts' from the ne_hotel.facts Array of Objects
 * see: https://github.com/numo-labs/lambda-ne-dynamic-package-provider#list-of-hotels
 * @param {Object} ne_hotel - a Nordics Hotel record
 * @returns {Object} a simple Object with key:value pairs e.g: {bar:true, internet: true}
 */

const yes = /^Ja|1|true/; // Ja or 1 are considered true
const no = /^Nej|false/; // "Nej" >> false

function format_hotel_facts (hotel) {
  const obj = {};
  if (!hotel.facts || !Array.isArray(hotel.facts)) {
    return obj;
  }
  hotel.facts.forEach((fact) => {
    if (typeof fact.value === 'string') {
      fact.value = fact.value.match(yes) ? true : (fact.value.match(no) ? false : fact.value);
    }
    if (typeof fact.id === 'number') {
      fact.id = fact.name; // e.g: when fact.id is 130 ... :-\
    }
    // if (fact.id.match(/carte/)) { // Someone decided 'a la carte restaurant' was a good id ...
    //   fact.id = 'alacarterestaurant';
    // }
    if (fact.id.match(/internet/i)) { // wifi is what people want
      fact.id = 'wifi';
    }
    const key = fact.id.toString().toLowerCase(); // AllInclusive >> allinclusive
    obj[key] = fact.value;
  });
  return obj;
}

module.exports = format_hotel_facts;
