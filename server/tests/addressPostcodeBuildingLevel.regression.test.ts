/**
 * Israeli מיקוד is per-BUILDING — regression pin (2026-09-11).
 *
 * A 7-digit Israeli postcode identifies a single building, not a street and not
 * a city. OSM/Photon does not respect that: it returns the postcode of whatever
 * object matched, including a whole street segment, a POI, a district or a city.
 * A long street is split into several OSM segments that each carry a DIFFERENT
 * postcode.
 *
 * The payload below is the REAL live Photon answer (captured 2026-09-11) for
 * our own station address, "ויצמן 185 כפר סבא". It contains six features:
 * five have NO house number yet advertise 4445810 / 4426119 / 4425416, and
 * exactly one is building-level (house number 207).
 *
 * Before the fix the route copied `p.postcode` verbatim onto every prediction,
 * so whichever row the customer tapped they were shown — and saved — a postcode
 * belonging to a different stretch of Weizmann. It also emitted five rows whose
 * `description` was byte-identical, which is why address search looked like it
 * "did not bring the address": an un-pickable dropdown.
 *
 * Contract:
 *   1. a prediction with no house number carries NO postcode;
 *   2. a building-level prediction keeps its postcode;
 *   3. identical descriptions collapse to one row.
 */
import { describe, expect, it } from 'vitest';
import { photonFeatureToPrediction, dedupePredictions } from '../routes/geocode';

/** Verbatim live Photon response for q="ויצמן 185 כפר סבא" (bbox IL, limit 6). */
const LIVE_PHOTON_WEIZMANN = {
  "features": [
    {
      "geometry": {
        "type": "Point",
        "coordinates": [
          34.9172481,
          32.1732053
        ]
      },
      "properties": {
        "osm_type": "W",
        "osm_id": 1394811312,
        "name": "ויצמן",
        "city": "כפר סבא",
        "state": "מחוז המרכז",
        "postcode": "4445810",
        "countrycode": "IL",
        "type": "street"
      }
    },
    {
      "geometry": {
        "type": "Point",
        "coordinates": [
          34.8949744,
          32.1785944
        ]
      },
      "properties": {
        "osm_type": "W",
        "osm_id": 1036893593,
        "name": "ויצמן",
        "city": "כפר סבא",
        "state": "מחוז המרכז",
        "postcode": "4426119",
        "countrycode": "IL",
        "type": "street"
      }
    },
    {
      "geometry": {
        "type": "Point",
        "coordinates": [
          34.9272511,
          32.1710877
        ]
      },
      "properties": {
        "osm_type": "N",
        "osm_id": 1854109442,
        "name": "זוזוברה כפר סבא",
        "street": "ויצמן",
        "housenumber": "207",
        "city": "כפר סבא",
        "state": "מחוז המרכז",
        "postcode": "4445810",
        "countrycode": "IL",
        "type": "house"
      }
    },
    {
      "geometry": {
        "type": "Point",
        "coordinates": [
          34.9052622,
          32.1766984
        ]
      },
      "properties": {
        "osm_type": "N",
        "osm_id": 8829133018,
        "name": "יד לבנים, היכל התרבות, כפ\"ס",
        "street": "ויצמן",
        "city": "כפר סבא",
        "state": "מחוז המרכז",
        "postcode": "4425416",
        "countrycode": "IL",
        "type": "house"
      }
    },
    {
      "geometry": {
        "type": "Point",
        "coordinates": [
          34.9123048,
          32.1741848
        ]
      },
      "properties": {
        "osm_type": "N",
        "osm_id": 8364028859,
        "name": "משרד הפנים כפר סבא",
        "street": "ויצמן",
        "city": "כפר סבא",
        "state": "מחוז המרכז",
        "postcode": "4445810",
        "countrycode": "IL",
        "type": "house"
      }
    },
    {
      "geometry": {
        "type": "Point",
        "coordinates": [
          34.9123102,
          32.1746487
        ]
      },
      "properties": {
        "osm_type": "N",
        "osm_id": 1385646704,
        "name": "עיריית כפר סבא",
        "street": "ויצמן",
        "city": "כפר סבא",
        "state": "מחוז המרכז",
        "postcode": "4445810",
        "countrycode": "IL",
        "type": "house"
      }
    }
  ]
} as { features: any[] };

describe('Israeli postcode is building-level, never street-level', () => {
  const predictions = LIVE_PHOTON_WEIZMANN.features.map(photonFeatureToPrediction);

  it('the recorded payload really does carry the conflicting street postcodes', () => {
    // Guards the fixture itself: if this ever stops being true the pin below
    // would pass vacuously.
    const noNumber = LIVE_PHOTON_WEIZMANN.features.filter((f) => !f.properties.housenumber);
    expect(noNumber.length).toBeGreaterThan(1);
    const codes = new Set(noNumber.map((f) => f.properties.postcode).filter(Boolean));
    expect(codes.size).toBeGreaterThan(1); // 4445810 / 4426119 / 4425416
  });

  it('never attaches a postcode to a prediction that has no house number', () => {
    const leaked = predictions
      .filter((p) => !p.streetNumber && p.postalCode)
      .map((p) => ({ description: p.description, postalCode: p.postalCode }));
    expect(
      leaked,
      'a street/POI-level postcode was copied onto an address with no house number — ' +
        'that is a wrong מיקוד on a real delivery, not an approximation.',
    ).toEqual([]);
  });

  it('keeps the postcode when the hit really is a building', () => {
    const building = predictions.find((p) => p.streetNumber === '207');
    expect(building, 'expected the house-number-207 feature in the fixture').toBeTruthy();
    expect(building!.postalCode).toBe('4445810');
  });

  it('collapses the identical rows the customer could not choose between', () => {
    const before = predictions.map((p) => p.description);
    const identical = before.filter((d) => d === 'ויצמן, כפר סבא, מחוז המרכז');
    expect(identical.length, 'fixture should contain the repeated street rows').toBeGreaterThan(1);

    const after = dedupePredictions(predictions);
    const descriptions = after.map((p) => p.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(descriptions).toContain('ויצמן 207, כפר סבא, מחוז המרכז');
  });

  it('prefers the building-level row when two rows read the same', () => {
    const bare = { description: 'X, Y', mainText: 'X', secondaryText: 'Y', countryCode: 'IL', placeId: 'a' } as any;
    const withNumber = { ...bare, placeId: 'b', streetNumber: '12', postalCode: '1234567' };
    expect(dedupePredictions([bare, withNumber])).toEqual([withNumber]);
    expect(dedupePredictions([withNumber, bare])).toEqual([withNumber]);
  });
});
