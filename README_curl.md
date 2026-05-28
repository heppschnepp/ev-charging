# Open Charge Map API Examples

``` curl
curl -G "https://api.openchargemap.io/v3/poi/" \
  --data-urlencode "output=json" \
  --data-urlencode "latitude=52.2085" \
  --data-urlencode "longitude=8.9510" \
  --data-urlencode "distance=10" \
  --data-urlencode "maxresults=20" \
  --data-urlencode "key=<API-key>"
```

``` curl
curl "https://api.openchargemap.io/v3/poi/?output=json&latitude=52.2085&longitude=8.9510&distance=10&maxresults=20&key=<API-key>"
```

## Pricing & Connectors Example

Query stations for a specific location and extract pricing/connector info:

```curl
# Get stations near Liederbach am Taunus
curl -s "https://api.openchargemap.io/v3/poi/?output=json&latitude=50.1230468&longitude=8.4878708&distance=10&distanceunit=KM&maxresults=20&key=YOUR_API_KEY" | jq '
  .[] | select(.OperatorInfo?.Title) | 
  {
    name: .AddressInfo.Title,
    operator: .OperatorInfo.Title,
    usageCost: .UsageCost,
    totalConnectors: ((.Connections // []) | map(.Quantity // 0) | add)
  }
'
```

For Lidl stations specifically:
```curl
curl -s "..." | jq '.[] | select(.OperatorInfo.Title | test("(?i)lidl")) | {name: .AddressInfo.Title, usageCost, connectors: (.Connections // []).length}'
```
