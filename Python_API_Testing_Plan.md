# Python API Testing Plan

This document outlines comprehensive testing strategies for `src/extension/common/python.ts` functions to ensure API migration reliability and correctness.

## Overview

### Testing Priorities
1. **🔴 High Risk Functions** - Extensive testing required
2. **🟡 Medium Risk Functions** - Standard testing with edge cases
3. **🟢 Low Risk Functions** - Basic functionality testing

### Testing Approaches
- **Unit Tests** - Mock all external dependencies
- **Integration Tests** - Test with real Python extension APIs
- **Edge Case Tests** - Test boundary conditions and error scenarios
- **Migration Tests** - Verify backward compatibility and API changes

---

## Test Infrastructure Requirements

### Mocking Strategy
```typescript
// Mock dependencies that need to be stubbed
- extensions.getExtension()
- PythonExtension.api()
- commands.executeCommand()
- Event emitters and disposables
```

### Test Data Setup
```typescript
// Sample test environments
const mockEnvironments = {
  condaEnvironment: { /* conda env structure */ },
  venvEnvironment: { /* venv structure */ },
  globalPython: { /* global interpreter */ },
  invalidEnvironment: { /* broken/missing executable */ },
  environmentWithoutExecutable: { /* env missing python executable */ }
}
```

---

## Function-Specific Test Plans

### 🔴 HIGH PRIORITY: `getPythonExtensionEnviromentAPI()`

**Risk Level:** Critical - Used by almost all other functions

**Test Categories:**
1. **Happy Path Tests**
   - ✅ Successfully activates extension and returns API
   - ✅ Handles already activated extension
   - ✅ Returns valid PythonExtension interface

2. **Error Scenarios**
   - ❌ Extension not found/installed
   - ❌ Extension activation fails
   - ❌ API method throws exception
   - ❌ Extension activation times out

3. **Edge Cases**
   - 🔄 Multiple concurrent calls (race conditions)
   - 🔄 Extension state changes during activation
   - 🔄 Memory pressure scenarios

**Critical Test Cases:**
```typescript
describe('getPythonExtensionEnviromentAPI', () => {
  it('should return API when extension is available')
  it('should throw when extension is not installed')
  it('should handle activation failures gracefully')
  it('should not create multiple activation promises')
  it('should wait for extension ready state')
})
```

---

### 🔴 HIGH PRIORITY: `getInterpreterDetails()`

**Risk Level:** Critical - Extensively used across codebase

**Test Categories:**
1. **Happy Path Tests**
   - ✅ Returns interpreter details for workspace resource
   - ✅ Returns interpreter details without resource (global)
   - ✅ Handles quoted paths with spaces correctly
   - ✅ Returns valid IInterpreterDetails structure

2. **Environment Type Tests**
   - 🐍 Conda environments
   - 🐍 Virtual environments (venv/virtualenv)
   - 🐍 Global Python installations
   - 🐍 Pyenv-managed environments
   - 🐍 Poetry environments

3. **Edge Cases & Error Scenarios**
   - ❌ Environment without executable (`executable.uri` is undefined)
   - ❌ Invalid/corrupted environment
   - ❌ Environment resolution fails
   - ❌ getActiveEnvironmentPath returns invalid path
   - 🔄 Path contains special characters
   - 🔄 Very long paths
   - 🔄 Network paths (UNC)

4. **API Migration Tests**
   - ✅ Verify EnvironmentPath object handling (id + path)
   - ✅ Confirm resolveEnvironment accepts EnvironmentPath correctly
   - ✅ Test backward compatibility with existing callers
   - ✅ Test normalized path ID generation (normCasePath)
   - ✅ Test DEFAULT_PYTHON special case handling

**Critical Test Cases:**
```typescript
describe('getInterpreterDetails', () => {
  it('should return interpreter details for valid environment')
  it('should handle environment without executable gracefully')
  it('should quote paths containing spaces')
  it('should work with different resource types')
  
  // Critical: Test EnvironmentPath object structure
  it('should correctly pass EnvironmentPath to resolveEnvironment', async () => {
    const mockEnvPath = {
      id: normCasePath('/path/to/env'),
      path: '/path/to/env'
    };
    
    mockApi.environments.getActiveEnvironmentPath.returns(mockEnvPath);
    mockApi.environments.resolveEnvironment.withArgs(mockEnvPath).resolves(mockResolvedEnv);
    
    await getInterpreterDetails();
    
    expect(mockApi.environments.resolveEnvironment).to.have.been.calledWith(mockEnvPath);
  })
  
  it('should handle DEFAULT_PYTHON special case', async () => {
    const defaultPythonEnvPath = {
      id: 'DEFAULT_PYTHON',
      path: 'python'
    };
    mockApi.environments.getActiveEnvironmentPath.returns(defaultPythonEnvPath);
    // Test behavior with default python
  })
  
  it('should return undefined path when no executable found')
  it('should preserve resource parameter in result')
})
```

---

### 🔴 HIGH PRIORITY: `resolveEnvironment()`

**Risk Level:** Critical - Used extensively in debug scenarios

**Test Categories:**
1. **Input Type Tests**
   - ✅ Resolve from Environment object
   - ✅ Resolve from EnvironmentPath object
   - ✅ Resolve from string path
   - ✅ Handle all supported input formats

2. **Resolution Success Tests**
   - ✅ Returns ResolvedEnvironment with complete data
   - ✅ Resolves different environment types
   - ✅ Handles workspace-scoped environments

3. **Resolution Failure Tests**
   - ❌ Invalid environment path
   - ❌ Environment not found
   - ❌ Corrupted environment data
   - ❌ API resolution fails

4. **Return Value Validation**
   - ✅ Verify ResolvedEnvironment structure
   - ✅ Check executable.bitness is defined
   - ✅ Check executable.sysPrefix is defined
   - ✅ Validate version information completeness

**Critical Test Cases:**
```typescript
describe('resolveEnvironment', () => {
  it('should resolve Environment object')
  it('should resolve EnvironmentPath object')
  it('should resolve string path')
  it('should return undefined for invalid environment')
  it('should return ResolvedEnvironment with complete data')
  it('should handle API errors gracefully')
})
```

---

### 🔴 HIGH PRIORITY: `getSettingsPythonPath()` ⚠️ DEPRECATED API

**Risk Level:** Critical - Uses deprecated API, needs migration testing

**Test Categories:**
1. **Deprecated API Tests**
   - ✅ Verify current functionality still works
   - 📝 Document deprecation warnings
   - 🔄 Test with different resource types
   - ✅ Validate execCommand format

2. **Migration Preparation Tests**
   - 🆕 Test equivalent functionality with new API
   - 🆕 Compare outputs between old and new approaches
   - 🆕 Performance comparison tests

3. **Error Scenarios**
   - ❌ Extension API not available
   - ❌ getExecutionDetails returns undefined
   - ❌ Invalid resource parameter

**Critical Test Cases:**
```typescript
describe('getSettingsPythonPath', () => {
  it('should return execution details for resource')
  it('should handle undefined resource')
  it('should return undefined when no interpreter set')
  it('should match format expected by callers')
  // Migration tests
  it('should match resolveEnvironment equivalent output')
  it('should log deprecation warning')
})
```

---

### 🟡 MEDIUM PRIORITY: `getEnvironmentVariables()`

**Risk Level:** Medium - Process attachment feature

**Test Categories:**
1. **Synchronous API Wrapper Tests**
   - ✅ Verify Promise.resolve wrapper works correctly
   - ✅ Test with different resource types
   - ✅ Validate EnvironmentVariables structure

2. **Environment Variable Tests**
   - 🔧 Custom .env file variables
   - 🔧 System environment variables
   - 🔧 Workspace-specific variables
   - 🔧 Multi-root workspace scenarios

3. **Edge Cases**
   - ❌ Missing .env files
   - ❌ Invalid .env syntax
   - 🔄 Empty environment variables
   - 🔄 Special characters in values

**Critical Test Cases:**
```typescript
describe('getEnvironmentVariables', () => {
  it('should return environment variables as Promise')
  it('should handle different resource types')
  it('should include custom .env variables')
  it('should work without resource parameter')
  it('should return EnvironmentVariables type')
})
```

---

### 🟡 MEDIUM PRIORITY: `initializePython()`

**Risk Level:** Medium - Event setup function

**Test Categories:**
1. **Event Registration Tests**
   - ✅ Verify event listener registration
   - ✅ Test disposable cleanup
   - ✅ Validate event handler logic

2. **Event Handling Tests**
   - 🔄 ActiveEnvironmentPathChangeEvent structure
   - 🔄 Resource type detection (Uri vs WorkspaceFolder)
   - 🔄 Event firing with correct data

3. **Initialization Flow Tests**
   - ✅ Initial getInterpreterDetails call
   - ✅ Error handling in initialization
   - 🔄 Multiple initialization calls

4. **API Migration Tests**
   - ✅ Verify e.path access still works
   - ✅ Test with different resource types in events
   - ✅ Validate onDidChangePythonInterpreter firing

**Critical Test Cases:**
```typescript
describe('initializePython', () => {
  it('should register event listeners')
  it('should fire initial interpreter change event')
  it('should handle API errors gracefully')
  it('should add disposables to provided array')
  
  // Key insight: Test exact event structure from Python extension
  it('should handle ActiveEnvironmentPathChangeEvent with normalized IDs', async () => {
    const events: IInterpreterDetails[] = [];
    onDidChangePythonInterpreter((e) => events.push(e));
    
    // Fire mock event with EnvironmentPath structure
    mockEventEmitter.fire({
      id: normCasePath('/path/to/python'),
      path: '/path/to/python',
      resource: mockUri
    });
    
    await sleep(1); // Pattern from Python extension tests
    expect(events[0]).to.deep.equal({
      path: ['/path/to/python'], // Note: wrapped in array
      resource: mockUri
    });
  })
  
  it('should detect Uri vs WorkspaceFolder resources')
  it('should handle DEFAULT_PYTHON special case')
})
```

---

### 🟡 MEDIUM PRIORITY: Extension Activation Functions

**Risk Level:** Medium - Core activation with race condition potential

#### `activateExtension()`
**Test Categories:**
1. **Activation Flow Tests**
   - ✅ Extension not installed
   - ✅ Extension already active
   - ✅ Extension activation required
   - ✅ Successful activation flow

2. **Race Condition Tests**
   - 🔄 Multiple concurrent activation calls
   - 🔄 Activation during other operations

#### `activateEnvsExtension()`
**Test Categories:**
1. **Environment Extension Tests**
   - ✅ Environment extension available
   - ✅ Environment extension missing
   - ⚠️ Race condition with main extension activation

**Critical Test Cases:**
```typescript
describe('Extension Activation', () => {
  describe('activateExtension', () => {
    it('should activate inactive extension')
    it('should return already active extension')
    it('should handle missing extension')
    it('should not create multiple activation promises')
  })
  
  describe('activateEnvsExtension', () => {
    it('should activate environments extension')
    it('should handle missing environments extension')
    it('should be called from activateExtension but not awaited')
  })
})
```

---

### 🟢 LOW PRIORITY: Utility Functions

#### `hasInterpreters()` & `getInterpreters()`
**Test Categories:**
1. **Basic Functionality**
   - ✅ Return correct data types
   - ✅ Handle empty environments list
   - 🔄 Test Promise.race logic in hasInterpreters

2. **Environment Discovery**
   - ✅ Initial environments available
   - ✅ Environment refresh triggering
   - ✅ Event-based environment updates

---

## Integration Test Flows

### End-to-End Scenarios

#### 1. **Fresh Extension Startup**
```typescript
Flow: Extension loads → initializePython → getInterpreterDetails → Event firing
Tests: 
- Verify complete initialization chain
- Test with different initial environment states
- Validate event propagation
```

#### 2. **Environment Change Scenarios**
```typescript
Flow: User changes Python interpreter → Event fires → Consumers updated
Tests:
- Test environment switching
- Validate event data accuracy
- Test multiple workspace scenarios
```

#### 3. **Debug Configuration Resolution**
```typescript
Flow: Debug launch → getInterpreterDetails → resolveEnvironment → Debug adapter
Tests:
- Test complete debug flow
- Validate fallback to getSettingsPythonPath
- Test with various environment types
```

#### 4. **Error Recovery Flows**
```typescript
Flow: API failure → Error handling → Fallback mechanisms
Tests:
- Extension activation failures
- Environment resolution failures
- Event handling errors
```

---

## Performance & Load Testing

### Performance Test Categories
1. **API Call Performance**
   - Measure function execution times
   - Test with large environment lists
   - Memory usage monitoring

2. **Concurrent Operations**
   - Multiple simultaneous API calls
   - Event handling under load
   - Extension activation race conditions

3. **Resource Usage**
   - Memory leak detection
   - Disposable cleanup verification
   - Event listener cleanup

---

## Regression Testing Strategy

### Backward Compatibility Tests
1. **Existing API Contracts**
   - Return type compatibility
   - Function signature compatibility
   - Event data structure compatibility

2. **Consumer Integration Tests**
   - Test all identified usage locations
   - Validate debug configuration resolution
   - Test settings integration
   - Verify extension initialization flow

### Migration Testing
1. **Old vs New API Comparison**
   - Compare `getSettingsPythonPath()` with new equivalent
   - Validate `getEnvironmentVariables()` Promise wrapper
   - Test `EnvironmentPath` object handling

2. **Feature Parity Tests**
   - Ensure no functionality is lost
   - Validate performance characteristics
   - Test error handling improvements

---

## Test Data & Mock Requirements

### Mock Environment Configurations
```typescript
const testEnvironments = {
  conda: {
    id: normCasePath('/opt/conda/envs/test'), // Key insight: IDs are normalized paths
    path: '/opt/conda/envs/test',
    executable: { uri: Uri.file('/opt/conda/envs/test/bin/python') },
    environment: { type: 'Conda', name: 'test' }
  },
  venv: {
    id: normCasePath('/project/.venv'),
    path: '/project/.venv',
    executable: { uri: Uri.file('/project/.venv/bin/python') }
  },
  defaultPython: {
    id: 'DEFAULT_PYTHON', // Special case for default python
    path: 'python'
  },
  invalid: {
    id: normCasePath('/nonexistent'),
    path: '/nonexistent',
    executable: { uri: undefined }
  }
}
```

### Event Emitter Mock Setup
```typescript
// From Python extension test patterns
let onDidChangeActiveEnvironmentPath: EventEmitter<ActiveEnvironmentPathChangeEvent>;
let onDidChangeEnvironments: EventEmitter<EnvironmentsChangeEvent>;

setup(() => {
  onDidChangeActiveEnvironmentPath = new EventEmitter();
  onDidChangeEnvironments = new EventEmitter();
  
  mockApi.environments.onDidChangeActiveEnvironmentPath = onDidChangeActiveEnvironmentPath.event;
  mockApi.environments.onDidChangeEnvironments = onDidChangeEnvironments.event;
});
```

### Test Resource Scenarios
- Single workspace folder
- Multi-root workspace
- No workspace (single file)
- Different drive letters (Windows)
- Network paths (UNC)
- Symlinked directories

---

## Critical Insights from Python Extension Tests

### 🔍 Key Discoveries That Impact Our Testing:

1. **EnvironmentPath ID Normalization**
   - IDs are generated using `normCasePath()` for cross-platform compatibility
   - Special case: `"python"` path gets ID `"DEFAULT_PYTHON"`
   - Must test both `id` and `path` properties in EnvironmentPath objects

2. **Event Testing Patterns**
   - Use real EventEmitter instances, not mocks
   - Add `await sleep(1)` delays for async event processing
   - Test exact event payload structure matching API types

3. **Resource Type Matrix Testing**
   - Every function taking Resource parameter needs testing with:
     - `undefined` (global scope)
     - `Uri` (file resource)
     - `WorkspaceFolder` (workspace resource)

4. **Mock Setup Complexity**
   - Service container pattern with deep mock chaining
   - Event emitters need real instances, not mock objects
   - API method call sequences must be mocked in correct order

5. **Workspace Environment Filtering**
   - Environments outside workspace scope are filtered out
   - Need to test multi-workspace scenarios explicitly

### 🚨 High-Risk Areas Identified:
- **EnvironmentPath object structure changes** - Both our code and callers expect this
- **Event payload format** - ActiveEnvironmentPathChangeEvent structure must match exactly
- **Default Python handling** - Special case logic for "python" vs full paths
- **Path normalization** - Cross-platform compatibility critical

---

## Success Criteria

### Test Coverage Goals
- **Function Coverage:** 100% of exported functions
- **Branch Coverage:** >90% for high-risk functions
- **Integration Coverage:** All identified usage scenarios

### Quality Gates
- ✅ All high-risk function tests pass
- ✅ No regressions in existing functionality  
- ✅ Performance within acceptable bounds
- ✅ Memory leaks eliminated
- ✅ Error handling robust and informative

### Documentation Requirements
- Test results documentation
- Performance benchmarks
- Migration guide for deprecated APIs
- Known issues and limitations