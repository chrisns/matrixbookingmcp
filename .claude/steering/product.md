# Product Overview

## Purpose
Build a TypeScript MCP (Model Context Protocol) server that integrates with the Matrix Booking API to enable room booking automation and availability checking.

## Core Features
- Check room availability for specified dates/times
- Book appointments automatically when availability exists
- Query room status and scheduling information
- Support for preferred location defaults

## User Value Proposition
Streamline meeting room booking through conversational AI interface, eliminating manual booking processes and reducing scheduling conflicts.

## Key Business Logic Rules
- Always check availability before attempting to book
- Use today's date when no date is specified
- Default to MATRIX_PREFERED_LOCATION from environment when location not specified
- Maintain stateless operation - no caching or persistent state
- All operations require valid Matrix Booking credentials

## API Integration Requirements
- Use Matrix Booking REST API v1 (https://app.matrixbooking.com/api/v1)
- Implement HTTP Basic Authentication with user credentials
- Support booking notifications to all attendees (notifyScope=ALL_ATTENDEES)
- Handle timezone considerations (Europe/London default)