# 🏗️ Test Architecture - Spark Graph Viewer

## Overview

The test structure was designed to ensure quality, reliability and maintainability of the Spark Graph Viewer project with FastAPI and PySpark.

## 🎯 Test Objectives

1. **Validate Functionality**: Ensure each component works as expected
2. **Prevent Regressions**: Detect bugs introduced by changes
3. **Document Behavior**: Tests serve as live documentation
4. **Facilitate Refactoring**: Well-tested code can be refactored with confidence
5. **Improve Quality**: Tested code tends to be more modular and clean

## 📊 Test Pyramid

```
        ⛔ E2E Tests (UI, Selenium)
       └─ End-to-End Tests
       └─ Expensive maintenance, can be slow
       └─ Few tests of this type

       🛠️ Integration Tests
       └─ Test components together (without real Spark)
       └─ Endpoint tests with fake data
       └─ Medium quantity

    96% Unit Tests
    └─ Isolated function tests
    └─ Fast, easy to maintain
    └─ Most tests here
```

### Ideal Distribution

- **Unit Tests**: 70-80% of tests (speed: < 100ms each)
- **Integration Tests**: 15-25% of tests (speed: 100ms - 1s)
- **E2E Tests**: 5-10% of tests (speed: > 1s)

## 🗂️ File Structure

```
tests/
├── __init__.py              # Marks as Python package
├── conftest.py              # Global configurations and fixtures
├── test_app.py              # Endpoint tests (integration)
└── test_functions.py        # Function tests (unit)
```

### Naming Conventions

```python
# Test class (groups related tests)
class Test[ComponenteName]:
    pass

# Test method
def test_[function]_[scenario]_[expected_result](self):
    pass

# Examples:
class TestAboutEndpoint:
    def test_get_api_about_success(self):
        pass
    
    def test_get_api_about_missing_field(self):
        pass
```

## 🧩 AAA Pattern (Arrange-Act-Assert)

All tests must follow this pattern:

```python
def test_example(client):
    # ARRANGE: Prepare data and state
    query = "SELECT * FROM table"
    expected_columns = ["id", "name"]
    
    # ACT: Execute code being tested
    result = execute_query(query)
    
    # ASSERT: Verify results
    assert result.count() > 0
    assert "id" in result.columns
```

## 🔧 Reusable Fixtures

Fixtures in `conftest.py` are functions that prepare data for tests:

```python
@pytest.fixture
def client():
    """Provides FastAPI client for HTTP requests."""
    return TestClient(app)

@pytest.fixture
def mock_spark_session():
    """Provides SparkSession mock."""
    return MagicMock()

@pytest.fixture
def sample_sql_query():
    """Provides valid SQL query."""
    return "SELECT * FROM table LIMIT 100"
```

## 📝 Types of Tests

### 1. Unit Tests (@pytest.mark.unit)

Test isolated functions without external dependencies.

```python
@pytest.mark.unit
def test_get_dataframe_from_sql_valid_query(mock_spark):
    """Test function with valid query."""
    from app import get_dataframe_from_sql
    result = get_dataframe_from_sql("SELECT * FROM table")
    assert result is not None
```

**Characteristics:**
- ✅ Fast (< 100ms)
- ✅ Easy to maintain
- ✅ Deterministic
- ✅ Localized (one test = one concept)

### 2. Integration Tests (@pytest.mark.integration)

Test multiple components working together.

```python
@pytest.mark.integration
def test_get_api_about_success(client):
    """Test GET endpoint."""
    response = client.get("/api/about")
    assert response.status_code == 200
    assert "name" in response.json()
```

**Characteristics:**
- ⚠️ Slower than unit tests
- ⚠️ May be non-deterministic
- ✅ Test system behavior

### 3. Spark Tests (@pytest.mark.spark)

Test Spark-dependent features. Require running Spark cluster.

```python
@pytest.mark.spark
def test_spark_dataframe_operation(mock_spark_dataframe):
    """Test DataFrame operations."""
    mock_spark_dataframe.count()
    mock_spark_dataframe.isEmpty()
```

**How to run:**
```bash
# Only Spark tests
pytest -m spark

# Skip Spark
pytest -m "not spark"
```

## 🎭 Mocking and Patching

### Using Mock for Spark

```python
from unittest.mock import patch, MagicMock

@patch('app.spark')
def test_com_mock(mock_spark):
    """Mock simulates Spark behavior."""
    mock_spark.sql.return_value = MagicMock()
    
    # spark.sql() returns MagicMock instead of failing
    from app import get_dataframe_from_sql
    result = get_dataframe_from_sql("SELECT *")
```

### Difference: Stub vs Mock vs Spy

```python
# STUB: Returns pre-configured response
stub = MagicMock(return_value="prefixed")

# MOCK: Verifies if called correctly
mock_obj = MagicMock()
mock_obj.method()
mock_obj.method.assert_called_once()

# SPY: Records calls but lets real execution happen
from unittest.mock import wraps
real_func = lambda x: x + 1
spy = MagicMock(side_effect=real_func)
```

## 📈 Code Coverage

```bash
# Generate report
pytest --cov=app --cov-report=html --cov-report=term-missing

# Result
Name            Stmts   Miss  Cover
─────────────────────────────────
app.py            150     30    80%
test_app.py        95      0   100%
─────────────────────────────────
TOTAL             245     30    87%
```

**Coverage Goals:**
- Minimum acceptable: 70%
- Good: 80-90%
- Excellent: 90%+

⚠️ **Note**: 100% coverage doesn't mean 100% quality. Focus on testing critical logic.

## 🏃 Test Performance

### Commands to Measure Performance

```bash
# Show 10 slowest tests
pytest --durations=10

# Run in parallel (4 workers)
pip install pytest-xdist
pytest -n 4

# Stop on first error
pytest -x
```

### Optimizations

1. **Use fixtures with appropriate scope**:
   ```python
   @pytest.fixture(scope="session")  # Once per session
   def expensive_resource():
       return setup()
   ```

2. **Mock slow external dependencies**
3. **Mark slow tests with `@pytest.mark.slow`**
4. **Run CI/CD with only relevant tests**

## ✅ Checklist for New Tests

- [ ] Descriptive and in English name
- [ ] Follows AAA pattern (Arrange-Act-Assert)
- [ ] Tests one concept per test
- [ ] Uses fixtures when appropriate
- [ ] Mocks external dependencies
- [ ] Correct marker (@pytest.mark.unit, etc)
- [ ] Documented with docstring
- [ ] Doesn't depend on execution order
- [ ] Deterministic (same input = same result)
- [ ] Cleans up state if necessary

## 🚨 Flaky Tests (Unreliable)

Avoid:

```python
# ❌ WRONG: Depends on time
def test_cache_expires():
    cache.set("key", "value")
    time.sleep(0.1)  # May fail if there's delay
    assert cache.get("key") is None

# ✅ CORRECT: Use time mock
from unittest.mock import patch
def test_cache_expires():
    with patch('time.time', return_value=1000):
        cache.set("key", "value")
    with patch('time.time', return_value=2000):
        assert cache.get("key") is None
```

## 🔐 Security Tests

Although not implemented yet, consider testing:

```python
# Input validation
def test_sql_injection_protection():
    malicious_query = "'; DROP TABLE users; --"
    assert is_safe_query(malicious_query) == False

# Authentication
def test_protected_endpoint_requires_token():
    response = client.get("/api/protected")
    assert response.status_code == 401
```

## 📚 Resources and References

- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [unittest.mock](https://docs.python.org/3/library/unittest.mock.html)
- [PySpark Testing](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.test.html)

## 🎓 Future Improvements

1. **Integration with CI/CD**: GitHub Actions, GitLab CI
2. **Code Coverage Tracking**: Codecov, Coveralls
3. **Load Testing**: Locust, pytest-benchmark
4. **Contract Testing**: For public APIs
5. **Mutation Testing**: Verify test quality

---

**Version**: 1.0  
**Last Updated**: 2026-03-03  
**Author**: QA Team
