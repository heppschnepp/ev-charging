# Finding Coordinates for EV Charging Search

To search for charging stations in the EV Charging Finder, you need latitude/longitude coordinates.

## Method 1: Nominatim Geocoding API (Used by this app)

The app uses OpenStreetMap's Nominatim service to convert city names to coordinates.

```bash
curl -s "https://nominatim.openstreetmap.org/search?q=Liederbach%20am%20Taunus&format=json&limit=1" | jq '{lat, lon, display_name}'
```

Response:
```json
{
  "lat": "50.1230468",
  "lon": "8.4878708",
  "display_name": "Liederbach am Taunus, Main-Taunus-Kreis, Hessen, 65835, Deutschland"
}
```

## Method 2: Google Maps

1. Go to [Google Maps](https://maps.google.com)
2. Right-click on the location
3. Copy the coordinates from the URL or popup

Example URL: `https://maps.google.com/?q=Liederbach+am+Taunus`
Coordinates in URL: `@50.1230468,8.4878708,15z` → lat=50.1230468, lon=8.4878708

## Method 3: Command Line Tools

### Using `curl` with Nominatim

```bash
# Search for a city
curl -s "https://nominatim.openstreetmap.org/search?q=Frankfurt&format=json&limit=1" | jq -r '.[0] | "\(.lat) \(.lon)"'

# Search for specific address
curl -s "https://nominatim.openstreetmap.org/search?q=Porta+Westfalica&format=json&limit=1" | jq '{lat, lon, display_name}'
```

### Using `geo` (if installed)

```bash
geo "Liederbach am Taunus"
```

## Coordinate Format

- Latitude: decimal degrees (-90 to 90)
- Longitude: decimal degrees (-180 to 180)
- Both are required for the OCM API search endpoint

## Nominatim Usage Policy

- Add a `User-Agent` header in production use
- Limit requests to 1/second
- See: https://operations.osmfoundation.org/policies/nominatim/