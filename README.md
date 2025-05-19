# Universal API Test Runner

A flexible and powerful HTTP API test runner that allows you to validate API contracts using simple specification files.

## Overview

This tool provides a generic way to test HTTP APIs by defining test specifications in JavaScript. It supports:

- Testing various HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Authentication headers
- Request bodies
- Response validation
- State sharing between tests
- Automatic parameter substitution

## Installation

```bash
# Install dependencies
bun install
```

## Usage

### Running Tests

```bash
bun start yourspec.js
```

### Creating Specification Files

Specification files define the API tests to run. Each spec file must export:
- `baseUrl`: The base URL of the API to test
- `spec`: An object containing test groups and their test cases

Example specification file:

```javascript
module.exports = {
  baseUrl: 'https://api.example.com',
  spec: {
    Users: [
      ['creates a user', 'POST /users', null, 
        { email: 'user@example.com', password: 'password123', name: 'Test User' }, 
        201, 
        (res, S) => { 
          assert.ok(res.body.id); 
          S.userId = res.body.id; 
        }
      ],
      ['retrieves a user', 'GET /users/:userId', 
        S => ({ Authorization: `Bearer ${S.token}` }), 
        null, 
        200, 
        (res, S) => assert.strictEqual(res.body.email, 'user@example.com')
      ],
    ],
  },
};
```

#### Generating Specification Files from OpenAPI

You can use the following prompt with an LLM (like ChatGPT or Claude) to automatically generate a specification file from an OpenAPI specification:

```
I need to create a test specification file for the Universal API Test Runner based on the given OpenAPI specification. 
The test runner validates API contracts using JavaScript specification files.

Here is the general structure of the required file:
module.exports = {
  baseUrl: 'https://api.example.com',
  spec: {
    Items: [
      ['should create an item', 'POST /items', auth, () => ({ name: 'Item '+rnd() }), 201,
        (res,S)=>{ assert.ok(res.body.id); S.itemId=res.body.id; }
      ],

      ['should retrieve an item', 'GET /items/:itemId', auth, null,
        (res,S)=>{ assert.strictEqual(res.status,200); assert.strictEqual(res.body.id,S.itemId); }
      ],

      ['should delete an item', 'DELETE /items/:itemId', auth, null, 204],

      ['should respond with 404 when item is not found', 'GET /items/:itemId', auth, null, 404],
    ],
  },
};

Each test is defined as an array with the following elements:
[
  title,                      // Test description
  'METHOD /path/:param',      // HTTP method and path (params replaced with S.param)
  headers | headersFn | null, // Request headers or function(S) → headers
  body | bodyFn | null,       // Request body or function(S) → body
  expect,                     // Expected status code or function(res) for custom validation
  fn(res, S)?                 // Optional function to assert and update shared state
]

The test specification file should:
1. Export a `baseUrl` property with the API's base URL (use servers[0].url from the OpenAPI spec)
2. Export a `spec` object containing test groups organized by resource/endpoint or other logical way
3. Include tests for all defined endpoints in the OpenAPI spec
4. Pay special attention to validating that response JSON structures match the documentation examples 100%
5. Simulate realistic workflows with ID reuse across create, update, and delete operations
6. Implement proper state management using the shared state object `S` to store and reuse values between tests (like IDs and tokens)
7. Handle authentication if defined in securitySchemes/security:
   - Test 401 Unauthorized errors on missing tokens
   - Test login with missing and invalid credentials (expecting 400 or 401)
   - Store and reuse tokens in authenticated requests
   - After successful logout, test that protected operations fail with the old token
8. If user creation endpoints exist (e.g., POST /users or POST /registrations):
   - Test successful signup with randomly generated username
   - Test duplicate signup returns 409 Conflict
9. Implement logical resource lifecycles per the OpenAPI spec:
   - Only perform operations (POST, GET, PATCH/PUT, DELETE) where defined in the spec
   - Chain actions into realistic workflows (e.g., create → update → delete)

The test runner provides these helper functions:
- assert: Node.js assert module
- rnd(): Generates a random number (useful for creating unique values)
- auth(S): Returns { Authorization: `Bearer ${S.token}` } (shorthand for auth headers)

Additional requirements:
1. Follow provided request body examples exactly when testing 2xx responses
2. Use only required fields from requestBody schemas
3. If operationId exists in the OpenAPI spec, use it for naming test cases


Coverage checklist  
1. **Every** operation gets a test (title = operationId if present).  
2. Happy path is completely covered.  
3. At least one error path per endpoint (400/401/403/404 as documented).  
4. Use only required requestBody fields & example values.  
5. Chain realistic flows: create → get → update → delete, reusing S.* IDs.  
6. Auth (if security* exists):  
   • 401 no token • bad creds 400/401 • login saves S.token • logout then 401.  
7. Signup endpoints (POST /users or /registrations): rnd email 201, duplicate 409.  
8. After DELETE, optional GET should return 404 (if spec shows it).  
9. Never call methods not present in spec.


Please generate a complete specification file that follows this format and thoroughly tests the API described in the OpenAPI spec.

Here's the OpenAPI specification I want to test:

Output only the specification file as a single block of code and nothing else.
```

This prompt will instruct the LLM to analyze your OpenAPI specification and generate a comprehensive test specification file that can be used with the Universal API Test Runner.


### Shared State

Tests can share state through the `S` object, which is passed to header functions, body functions, and assertion functions. This allows tests to use values from previous tests, such as authentication tokens or created resource IDs.
