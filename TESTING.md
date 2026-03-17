# 📋 Automated Testing Guide - Spark Graph Viewer

This document describes how to run, write, and maintain automated tests for the Spark Graph Viewer project.

## 📦 Installing Test Dependencies

### 1. Install pytest and plugins

```bash
pip install -r requirements.txt
```

Or install the specific test packages:

```bash
pip install pytest>=7.0.0 pytest-asyncio>=0.21.0 pytest-cov>=4.0.0 pytest-mock>=3.10.0 httpx>=0.24.0
```

## 🚀 Running Tests

### Run all tests

```bash
pytest
```

### Run tests with verbose output

```bash
pytest -v
```

### Run tests from a specific file

```bash
pytest tests/test_app.py
```

### Run tests from a specific class

```bash
pytest tests/test_app.py::TestAboutEndpoint
```

### Run a specific test

```bash
pytest tests/test_app.py::TestAboutEndpoint::test_get_api_about_success
```

### Run tests by marker

```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# Spark-specific tests only
pytest -m spark

# Skip slow tests
pytest -m "not slow"
```

### Run tests with code coverage

```bash
pytest --cov=app --cov-report=html --cov-report=term-missing
```

This generates an HTML report at `htmlcov/index.html`.

### Run tests in parallel (faster)

```bash
pip install pytest-xdist
pytest -n auto
```

### Stop on first failure

```bash
pytest -x
```

### Show the 10 slowest tests

```bash
pytest --durations=10
```

## 📁 Test Structure

```
tests/
├── __init__.py           # Marks directory as a Python package
├── conftest.py           # Global configurations and fixtures
├── test_app.py           # Endpoint tests (integration)
└── test_functions.py     # Function tests (unit)
```

## 🧪 Writing New Tests

### Basic Structure

```python
import pytest

@pytest.mark.unit  # Test type marker
class TestMyComponent:
    """Tests for my component."""
    
    def test_success_case(self):
        """Tests the happy path."""
        assert True
    
    def test_error_case(self):
        """Tests error handling."""
        with pytest.raises(ValueError):
            raise ValueError("Expected error")
```

### Using Fixtures

Fixtures are reusable functions that prepare data for tests:

```python
def test_endpoint_with_client(client):
    """Uses the client fixture to test an endpoint."""
    response = client.get("/api/about")
    assert response.status_code == 200
```

Available fixtures in `conftest.py`:
- **client** - FastAPI client for making requests
- **mock_spark_session** - Mock of SparkSession
- **mock_spark_dataframe** - Mock of a Spark DataFrame
- **sample_sql_query** - Example of a valid SQL query
- **sample_invalid_query** - Invalid SQL query
- **sample_request_data** - Example POST data


### Using Mocks

```python
from unittest.mock import patch

@patch('app.spark')
def test_with_mock_spark(mock_spark):
    """Mock of the spark module."""
    mock_spark.sql.return_value = None
    # Your test here
```

### Testing Endpoints

```python
def test_get_endpoint(client):
    """Tests a GET endpoint."""
    response = client.get("/api/about")
    assert response.status_code == 200
    assert response.json()["name"] == "Graph Bricks"

def test_required_parameter_endpoint(client):
    """Tests parameter validation."""
    response = client.get("/api/columns")
    assert response.status_code == 400
```

## 🏷️ Available Markers

| Marker | Description |
|--------|-------------|
| `@pytest.mark.unit` | Unit tests (fast) |
| `@pytest.mark.integration` | Integration tests (medium) |
| `@pytest.mark.spark` | Test requires Spark (slow, may fail without cluster) |
| `@pytest.mark.slow` | Long-running test (skipped by default) |
| `@pytest.mark.smoke` | Basic tests (quick sanity checks) |

## 📊 Analyzing Test Coverage

### Generate coverage report

```bash
pytest --cov=app --cov-report=html --cov-report=term-missing
```

### View report (Windows)

```bash
start htmlcov/index.html
```

### View report (Linux/Mac)

```bash
open htmlcov/index.html
```

## 🔧 pytest Configuration

All configurations are located in pytest.ini:

- **testpaths** - Directory where tests are located
- **python_files** - Filename patterns
- **addopts** - Default options (verbose, decorators, etc.)
- **markers** - Marker definitions

## 🐛 Debugging Tests

### View test output/prints

```bash
pytest -s tests/test_app.py::TestAboutEndpoint::test_get_api_about_success
```

### Use debugger (breakpoint)

```python
def test_debugging(client):
    response = client.get("/api/about")
    breakpoint()  # Pauses here for debugging
    assert response.status_code == 200
```

### Interactive mode with pdb

```bash
pytest --pdb tests/test_app.py
```

## ✅ Best Practices

1. **Clear Naming**: Use descriptive names: `test_endpoint_returns_200_on_success`
2. **Arrange-Act-Assert**: Organize tests into 3 phases:
   ```python
   # Arrange (prepare data)
   data = {"key": "value"}
   
   # Act (execute)
   response = client.post("/api/endpoint", json=data)
   
   # Assert (verify)
   assert response.status_code == 201
   ```
3. **Isolation**: Each test must be independent.
4. **Mocking**: Use mocks for external dependencies (Spark, Database).
5. **Coverage**: Aim for > 80% code coverage.
6. **Performance**: Mark slow tests with @pytest.mark.slow.


## 🚨 Troubleshooting

### Error: "module 'app' not found"

Ensure that `conftest.py` adds the root directory to the path:
```python
sys.path.insert(0, str(Path(__file__).parent.parent))
```

### Spark is not available

Spark tests require a cluster. Use `-m "not spark"`:
```bash
pytest -m "not spark"
```

### TimeoutError in tests

Increase the timeout:
```bash
pytest --timeout=300
```

## 📚 Additional Resources

- [pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [unittest.mock Documentation](https://docs.python.org/3/library/unittest.mock.html)
- [Pytest Fixtures](https://docs.pytest.org/en/stable/reference.html#fixtures)

## 💡 Next Steps

1. ✅ Install dependencies: `pip install -r requirements.txt`
2. ✅ Run tests: `pytest`
3. ✅ Check coverage: `pytest --cov=app --cov-report=term-missing`
4. ✅ Add new tests as features are implemented
5. ✅ Use CI/CD to run tests automatically

---

**Last update**: 2026-03-03
