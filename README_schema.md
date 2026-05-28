# Open Charge Map API Response Schema

This document describes the JSON response structure from the OCM `/poi` endpoint.

## API Endpoint

```
https://api.openchargemap.io/v3/poi/
```

### Request Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `output` | string | Response format: `json` (default) |
| `latitude` | number | Search latitude (required) |
| `longitude` | number | Search longitude (required) |
| `distance` | number | Search radius in km |
| `distanceunit` | string | `KM` or `Miles` (default: `KM`) |
| `maxresults` | integer | Maximum results to return (default: 100) |
| `key` | string | Your OCM API key (required) |
| `verbose` | boolean | Include related data (default: false) |

## Station Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Unique charge point identifier |
| `UUID` | string | UUID for the charge point |
| `OperatorID` | integer? | Operator reference ID |
| `OperatorInfo` | object? | Operator details |
| `UsageTypeID` | integer? | Usage type reference |
| `UsageType` | object? | Usage type details |
| `UsageCost` | string? | Cost information (e.g., "free", "0€", "Plugsurfing") |
| `StatusTypeID` | integer? | Status reference |
| `StatusType` | object? | Status details with `IsOperational` boolean |
| `AddressInfo` | object | Location and address details |
| `Connections` | array? | Array of connector objects |
| `NumberOfPoints` | integer? | Number of charging points |
| `DateLastVerified` | string? | ISO date last verified |
| `DateLastStatusUpdate` | string? | ISO date of last status update |
| `GeneralComments` | string? | General comments |
| `MediaItems` | array? | Photos/media items |

## AddressInfo Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Address ID |
| `Title` | string | Station name |
| `AddressLine1` | string? | Street address |
| `AddressLine2` | string? | Additional address info |
| `Town` | string? | City/town |
| `StateOrProvince` | string? | State/province |
| `Postcode` | string? | Postal code |
| `Country` | object? | Country info with `ISOCode`, `Title` |
| `Latitude` | number | Decimal latitude |
| `Longitude` | number | Decimal longitude |
| `Distance` | number? | Distance from search origin (km) |
| `ContactTelephone1` | string? | Phone number |
| `ContactTelephone2` | string? | Secondary phone |
| `ContactEmail` | string? | Contact email |
| `RelatedURL` | string? | Related website |
| `AccessComments` | string? | Access instructions |

## Connection Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Connection ID |
| `ConnectionTypeID` | integer | Connection type reference |
| `ConnectionType` | object? | Type details with `Title`, `FormalName` |
| `PowerKW` | number? | Power in kW |
| `Quantity` | integer? | Number of connectors of this type |
| `CurrentType` | object? | Current type with `Description` |
| `Level` | object? | Charging level with `Title` |
| `StatusType` | object? | Connection status |

## Common UsageCost Values

- `"free"` - Free to use
- `"0€"` / `"kostenfrei"` - Free (localized)
- `"Plugsurfing"` - Requires Plugsurfing app/card
- `""` - Empty string when no cost info available

## Related Objects

### OperatorInfo Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Operator ID |
| `Title` | string | Operator name (e.g., "Lidl", "Tesla") |
| `WebsiteURL` | string? | Operator website |
| `PhonePrimaryContact` | string? | Phone number |
| `ContactEmail` | string? | Contact email |

### UsageType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Usage type ID |
| `Title` | string | Usage type name (e.g., "Public", "Private - For Staff, Visitors or Customers") |
| `IsPayAtLocation` | boolean? | Pay at location allowed |
| `IsMembershipRequired` | boolean? | Membership required |
| `IsAccessKeyRequired` | boolean? | Access key required |

### StatusType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Status ID |
| `Title` | string | Status name (e.g., "Operational", "Planned") |
| `IsOperational` | boolean? | Whether operational |

### ConnectionType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Connection type ID |
| `Title` | string | Type name (e.g., "Type 2 (Socket Only)", "CCS (Type 2)", "Tesla (Model S/X)") |
| `FormalName` | string? | Formal standard name (e.g., "IEC 62196-2 Type 2") |
| `IsDiscontinued` | boolean? | Deprecated type |
| `IsObsolete` | boolean? | Obsolete type |

### Level Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Level ID (1=Low <2kW, 2=Medium 2-40kW, 3=High >40kW) |
| `Title` | string | Level name (e.g., "Level 1 : Low (Under 2kW)") |
| `IsFastChargeCapable` | boolean? | Supports fast charging |

### CurrentType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Current type ID |
| `Title` | string | Name (e.g., "AC (Three-Phase)", "DC") |
| `Description` | string? | Description (e.g., "Alternating Current - Three Phase") |

## Common Connection Types

| ID | Title | Description |
|----|-------|-------------|
| 1 | Type 1 (SAE) | SAE J1772 (North American standard) |
| 17 | CEE 5 Pin | Industrial blue plug (3-phase) |
| 25 | Type 2 (Socket Only) | IEC 62196-2 (European standard) |
| 28 | Schuko (CEE 7/4) | Household socket (Type F) |
| 30 | Tesla (Model S/X) | Tesla proprietary connector |
| 33 | CCS (Type 2) | Combined Charging System (DC fast) |

## Example Query

```bash
curl -G "https://api.openchargemap.io/v3/poi/" \
  --data-urlencode "output=json" \
  --data-urlencode "latitude=50.1230468" \
  --data-urlencode "longitude=8.4878708" \
  --data-urlencode "distance=10" \
  --data-urlencode "maxresults=20" \
  --data-urlencode "key=YOUR_API_KEY"
```