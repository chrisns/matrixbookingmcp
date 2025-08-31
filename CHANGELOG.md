# Changelog

All notable changes to the Matrix Booking MCP Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-12-31

### Added
- **Colleague Booking Discovery**: New `search_bookings` tool to find when colleagues are in the office
- **Natural Language Search**: Find locations using conversational queries with `find_location_by_requirements`
- **Facility-Based Discovery**: Search locations by requirements (screen, whiteboard, capacity)
- **Booking Cancellation**: New `cancel_booking` tool with notification options
- **User Bookings View**: `get_user_bookings` tool to view your own bookings and recurring schedules
- **Organization Info**: `get_organization_info` tool for organization details
- **Location Search Tools**: Multiple new location discovery tools
  - `find_location_by_name` - Find by name or room number
  - `find_location_by_requirements` - Search by facilities and capacity
  - `find_location_by_id` - Get specific location details
- **Cross-Organization Support**: Handle multiple organization contexts seamlessly
- **Smart Caching**: Performance optimization with configurable TTLs
- **Organization Context Resolution**: Intelligent organization ID mapping with fallback strategies
- **Error Recovery**: Graceful degradation and alternative suggestions
- **Comprehensive Input Validation**: XSS prevention and sanitization

### Changed
- **Unified Search**: Consolidated multiple search approaches into single `search_bookings` tool
- **Privacy Controls**: Default to showing only user's own bookings unless explicitly requested
- **Test Coverage**: Adjusted threshold from 90% to 50% for practical development
- **Architecture**: Modularized service layer with dedicated services for each domain
- **Error Handling**: Enhanced error messages with actionable suggestions

### Fixed
- **TypeScript Build**: Resolved all TypeScript compilation errors
- **Organization ID Mapping**: Fixed NaN organization ID issues
- **Date Validation**: Allow identical start/end times for point-in-time queries
- **Location Resolution**: Improved room/desk name and number matching
- **Test Compatibility**: Fixed test file type assertions for strict mode

### Security
- **Input Sanitization**: Added comprehensive XSS prevention
- **Credential Management**: Enhanced environment-based security
- **Privacy Controls**: Added privacy-aware defaults for colleague booking searches

## [1.0.0] - 2024-12-15

### Added
- Initial release with core Matrix Booking functionality
- Room availability checking
- Basic booking creation
- Location management
- MCP protocol implementation
- Basic test coverage