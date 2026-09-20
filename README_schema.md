# Open Charge Map API Response Schema

This document describes the JSON response structure from the OCM `/poi` endpoint.

The response is an array of **Station (POI)** objects. With `verbose=true` (the default), reference objects are expanded inline (e.g. `OperatorInfo`, `StatusType`, `DataProvider`, `SubmissionStatus`); with `compact=true` only the corresponding `*ID` fields are returned for each reference type. The `AddressInfo` object is always fully expanded.

> Note: The full machine-readable definition is the official OpenAPI spec at `https://raw.githubusercontent.com/openchargemap/ocm-docs/master/Model/schema/ocm-openapi-spec.yaml`.

## API Endpoint

```
https://api.openchargemap.io/v3/poi/
```

### Request Parameters

Unless noted, OCM reference-data filters (`operatorid`, `connectiontypeid`, etc.) accept comma-separated lists.

| Parameter | Type | Description |
|-----------|------|-------------|
| `output` | string | Response format: `json` (default, recommended), `geojson`, `xml`, `csv` |
| `key` / `X-API-Key` header | string | Your OCM API key (required) |
| `client` | string | String to identify your client application (optional but recommended) |
| `latitude` | number | Search latitude (required for distance search) |
| `longitude` | number | Search longitude (required for distance search) |
| `distance` | number | Filter results by max distance from the given latitude/longitude (km) |
| `distanceunit` | string | `km` or `miles` (default: `miles`) |
| `maxresults` | integer | Maximum results to return (default: 100) |
| `countrycode` | string | 2-character ISO country code filter (e.g. `GB`) |
| `countryid` | integer list | Exact match on numeric country id (comma-separated) |
| `operatorid` | integer list | Exact match on operator id |
| `connectiontypeid` | integer list | Exact match on connection type id |
| `levelid` | integer list | Charging level filter (deprecated) |
| `usagetypeid` | integer list | Exact match on usage type id |
| `statustypeid` | integer list | Exact match on status type id |
| `dataproviderid` | integer list | Exact match on data provider id |
| `chargepointid` | integer list | Exact match on OCM POI IDs (comma-separated) |
| `opendata` | boolean | `true` to return only OCM "Open" licensed data |
| `includecomments` | boolean | If `true`, user comments and media items are included (default false) |
| `verbose` | boolean | Default `true`; expanded reference objects. Set false for a smaller result set with null items removed |
| `compact` | boolean | If `true`, remove reference data objects (return only `*ID` fields) |
| `camelcase` | boolean | Return property names in camelCase format |
| `boundingbox` | string | Filter to a bounding box: `(lat,lng),(lat2,lng2)` top-left to bottom-right |
| `polygon` | string | Filter within a polygon (encoded polyline) |
| `polyline` | string | Filter along an encoded polyline (use with `distance`) |
| `sortby` | string | `modified_asc` or `id_asc` to override default spatial sort |
| `modifiedsince` | string | Results modified after given date |
| `greaterthanid` | integer | Items with ID greater than given value |

## Station Object

Fields marked *(verbose)* are only fully populated when `verbose=true`; otherwise the corresponding `*ID` field is still returned.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Unique charge point identifier (OCM-ID) |
| `UUID` | string | UUID for the charge point |
| `UserComments` | array? | User comments / check-ins (only when `includecomments=true`) |
| `MediaItems` | array? | Photos/media items (only when `includecomments=true`) |
| `IsRecentlyVerified` | boolean? | Dynamically computed: recent confirmation activity |
| `DateLastVerified` | string? | ISO date last verified (dynamically computed) |
| `ParentChargePointID` | integer? | If present, this POI supersedes another (rarely relevant) |
| `DataProviderID` | integer? | Reference ID of the data provider |
| `DataProvidersReference` | string? | Data provider's own key for this POI |
| `DataProvider` | object? *(verbose)* | Data provider details (attribution/license) |
| `OperatorID` | integer? | Operator reference ID |
| `OperatorsReference` | string? | Operator's own reference for this site |
| `OperatorInfo` | object? *(verbose)* | Operator details |
| `UsageTypeID` | integer? | Usage type reference (0 = unknown) |
| `UsageType` | object? *(verbose)* | Usage type details |
| `UsageCost` | string? | Cost information (e.g., "free", "0€", "Plugsurfing") |
| `AddressInfo` | object | Location and address details |
| `Connections` | array? | Array of connector objects |
| `NumberOfPoints` | integer? | Number of bays/stations at the site |
| `GeneralComments` | string? | General comments |
| `DatePlanned` | string? | ISO date planned for commissioning |
| `DateLastConfirmed` | string? | ISO date last confirmed by provider/user |
| `StatusTypeID` | integer? | Overall operational status reference (0 = unknown) |
| `StatusType` | object? *(verbose)* | Status details with `IsOperational` boolean |
| `DateLastStatusUpdate` | string? | ISO date of last status update |
| `DateCreated` | string? | ISO date the POI was added to OCM |
| `MetadataValues` | array? | Optional metadata values (attribution, links, foreign keys) |
| `DataQualityLevel` | integer? | Import quality metric (5 == best) |
| `SubmissionStatusTypeID` | integer? | Submission status reference |
| `SubmissionStatus` | object? *(verbose)* | Submission status details |

## AddressInfo Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Address ID |
| `Title` | string? | Station name |
| `AddressLine1` | string? | Street address |
| `AddressLine2` | string? | Additional address info |
| `Town` | string? | City/town |
| `StateOrProvince` | string? | State/province |
| `Postcode` | string? | Postal code |
| `CountryID` | integer? | Country reference ID |
| `Country` | object? | Country info (see below) |
| `Latitude` | number | Decimal latitude |
| `Longitude` | number | Decimal longitude |
| `ContactTelephone1` | string? | Phone number |
| `ContactTelephone2` | string? | Secondary phone |
| `ContactEmail` | string? | Contact email |
| `AccessComments` | string? | Access instructions |
| `RelatedURL` | string? | Related website |
| `Distance` | number? | Distance from search origin (units per `DistanceUnit`) |
| `DistanceUnit` | integer? | 1 = Miles, 2 = KM (default 1) |

## Connection Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Connection ID |
| `ConnectionTypeID` | integer? | Connection type reference |
| `ConnectionType` | object? *(verbose)* | Type details with `Title`, `FormalName` |
| `Reference` | string? | Operator's reference for this connection/port |
| `StatusTypeID` | integer? | Status reference (0 = unknown) |
| `StatusType` | object? *(verbose)* | Connection status |
| `LevelID` | integer? | Charging level reference |
| `Level` | object? *(verbose)* | Charging level with `Title` |
| `Amps` | number? | Current in amps |
| `Voltage` | number? | Voltage |
| `PowerKW` | number? | Power in kW |
| `CurrentTypeID` | integer? | Current type reference |
| `CurrentType` | object? *(verbose)* | Current type with `Description` |
| `Quantity` | integer? | Number of connectors of this type |
| `Comments` | string? | Operator comments for this connection |

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
| `Comments` | string? | General comments |
| `PhonePrimaryContact` | string? | Primary phone number |
| `PhoneSecondaryContact` | string? | Secondary phone number |
| `IsPrivateIndividual` | boolean? | True if operator is a private individual (deprecated) |
| `AddressInfo` | object? | Operator's registered address |
| `BookingURL` | string? | Booking/reservation URL |
| `ContactEmail` | string? | Contact email |
| `FaultReportEmail` | string? | Email used for automated fault reports |
| `IsRestrictedEdit` | boolean? | True if network restricts community edits |

### UsageType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Usage type ID |
| `Title` | string | Usage type name (e.g., "Public", "Private - For Staff, Visitors or Customers") |
| `IsPayAtLocation` | boolean? | Pay at location allowed |
| `IsMembershipRequired` | boolean? | Membership required |
| `IsAccessKeyRequired` | boolean? | Access key required (deprecated) |

### StatusType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Status ID |
| `Title` | string | Status name (e.g., "Operational", "Planned") |
| `IsOperational` | boolean? | Whether operational |
| `IsUserSelectable` | boolean? | Whether users can select this status |

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
| `Comments` | string? | Description of the level |
| `IsFastChargeCapable` | boolean? | Supports fast charging |

### CurrentType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Current type ID |
| `Title` | string | Name (e.g., "AC (Single-Phase)", "DC") |
| `Description` | string? | Description (e.g., "Alternating Current - Single Phase") |

### Country Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Country ID |
| `ISOCode` | string | 2-letter ISO code (e.g., "GB") |
| `ContinentCode` | string | Continent code (e.g., "EU") |
| `Title` | string | Country name |

### DataProvider Object

The controller of the source data set; provides attribution and licensing info.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Data provider ID |
| `Title` | string | Provider name (e.g., "Open Charge Map Contributors") |
| `WebsiteURL` | string? | Provider website |
| `Comments` | string? | General comments |
| `DataProviderStatusType` | object? | `IsProviderEnabled`, `ID`, `Title` (e.g., "Manual Data Entry") |
| `IsRestrictedEdit` | boolean? | Potential editing restriction (not implemented) |
| `IsOpenDataLicensed` | boolean? | Uses an Open Data license |
| `IsApprovedImport` | boolean? | Data may be imported for this provider |
| `License` | string? | Summary of applicable license |
| `DateLastImported` | string? | ISO date of last import (if any) |

### SubmissionStatusType Object

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Submission status ID (e.g., 200 = Published) |
| `Title` | string | Status name (e.g., "Submission Published") |
| `IsLive` | boolean? | True if the listing is live (not draft/delisted) |

### UserComment Object

Only returned when `includecomments=true`.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Comment ID |
| `ChargePointID` | integer | POI this comment relates to |
| `CommentTypeID` | integer | Comment type reference |
| `CommentType` | object? | `ID`, `Title` (e.g., "General Comment") |
| `UserName` | string? | Nickname |
| `Comment` | string? | Comment text |
| `RelatedURL` | string? | Related URL |
| `DateCreated` | string? | ISO date created |
| `User` | object? | `ID`, `Username`, `ReputationPoints`, `ProfileImageURL` |
| `CheckinStatusTypeID` | integer? | Check-in status reference |
| `CheckinStatusType` | object? | `ID`, `Title`, `IsAutomatedCheckin`, `IsPositive` |

### MediaItem Object

Only returned when `includecomments=true`. Items are images.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | integer | Media ID |
| `ChargePointID` | integer | POI this item relates to |
| `ItemURL` | string | Full-size image URL |
| `ItemThumbnailURL` | string | Thumbnail URL |
| `Comment` | string? | Image caption |
| `IsEnabled` | boolean? | Whether visible |
| `IsVideo` | boolean? | Whether it is a video |
| `IsFeaturedItem` | boolean? | Featured item |
| `IsExternalResource` | boolean? | Hosted externally |
| `User` | object? | Submitting user (`ID`, `Username`, `ReputationPoints`, `ProfileImageURL`) |
| `DateCreated` | string? | ISO date created |

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
  --data-urlencode "client=my-app" \
  --data-urlencode "latitude=50.1230468" \
  --data-urlencode "longitude=8.4878708" \
  --data-urlencode "distance=10" \
  --data-urlencode "distanceunit=km" \
  --data-urlencode "maxresults=20" \
  --data-urlencode "includecomments=true" \
  --data-urlencode "verbose=true" \
  --data-urlencode "key=YOUR_API_KEY"
```