# genie-router-plugin-api-http
A genie-router plugin that provides a generic HTTP API for external clients.

This is a plugin for the [https://github.com/matueranet/genie-router](genie-router)
project. It adds a HTTP endpoint to which external clients can send messages
and receive output.

# Configuration

Update the `plugins` block in the _genie-router_ configuration and add the key
`api-http`, which should be an object. This will enable the plugin. `http` should
be enabled in the genie-router configuration.

This plugin supports 3 optional configuration parameters:

- endpoint, the HTTP endpoint to listen to (defaults /api/message)
- accessToken, requires that the requests are using an _accessToken_ (Default is disabled).
- timeout, the maximum of milliseconds the process should waits for the invoked brain to respond (defaults to 5000 = 5 seconds).

## Example

```json
"api-http": {
  "endpoint": "/api/message",
  "timeout": 5000,
  "accessToken": "protection-enabled"
}
```
## Authorization

If the `accessToken` attribute is set, each request should include a `Authorization: Bearer [accessToken]` header.
Else a 401 HTTP response is returned.

# Requests / responses

The request should have be a JSON object, with at least an `input` attribute. You can optionally
include a `metadata` attribute which will be returned in the response.

```json
{
  "input": "Hello genie!",
  "metadata": {
    "internal-request-id": 5
  }
}
```

The responses will contain a unique identifier for each request, in the `id` attribute.

## Valid response

```json
{
  "id": "110ec58a-a0f2-4ac4-8393-c866d813b8d1",
  "message": "How may I help you, master?",
  "metadata": {
    "internal-request-id": 5
  }
}
```

## Errors

```json
{
  "id": "110ec58a-a0f2-4ac4-8393-c866d813b8d1",
  "error": "Timeout contacting brain."
}
```
