"""
Examples of how to add new tests to the project.
This file contains templates and patterns for different types of tests.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException


# ===============================================================================
# EXAMPLE 1: Simple Unit Test
# ===============================================================================

@pytest.mark.unit
class TestSimpleUnitTest:
    """Example of a simple unit test."""
    
    def test_validate_positive_parameter(self):
        """Test if validation works with positive number."""
        value = 42
        assert value > 0
    
    def test_validate_negative_parameter(self):
        """Test if validation works with negative number."""
        value = -10
        assert value < 0


# ===============================================================================
# EXAMPLE 2: Endpoint Test with FastAPI Client
# ===============================================================================

@pytest.mark.integration
class TestEndpointExample:
    """Example of endpoint test."""
    
    def test_endpoint_returns_status_200(self, client):
        """Test if endpoint returns status 200."""
        response = client.get("/api/about")
        assert response.status_code == 200
    
    def test_endpoint_returns_valid_json(self, client):
        """Test if endpoint returns valid JSON."""
        response = client.get("/api/about")
        data = response.json()
        assert isinstance(data, dict)
        assert len(data) > 0


# ===============================================================================
# EXAMPLE 3: Test with Spark Mock
# ===============================================================================

@pytest.mark.unit
@pytest.mark.spark
class TestExampleWithSparkMock:
    """Example of test with Spark mock."""
    
    @patch('app.spark')
    def test_function_with_spark_mock(self, mock_spark):
        """Test function that uses Spark with mock."""
        # Arrange: Configure the mock
        mock_dataframe = MagicMock()
        mock_dataframe.count.return_value = 100
        mock_spark.sql.return_value = mock_dataframe
        
        # Import function (after configuring mock)
        from app import get_dataframe_from_sql
        
        # Act: Call function
        result = get_dataframe_from_sql("SELECT * FROM table")
        
        # Assert: Verify results
        assert result is not None
        mock_spark.sql.assert_called_once_with("SELECT * FROM table")
        assert result.count() == 100


# ===============================================================================
# EXAMPLE 4: Test with Expected Exceptions
# ===============================================================================

@pytest.mark.unit
class TestExampleWithExceptions:
    """Example of tests that verify exceptions."""
    
    def test_division_by_zero_raises_exception(self):
        """Test if ZeroDivisionError is raised."""
        with pytest.raises(ZeroDivisionError):
            result = 10 / 0
    
    def test_http_exception_with_status_400(self):
        """Test if HTTPException is raised with correct status."""
        with pytest.raises(HTTPException) as exc_info:
            raise HTTPException(status_code=400, detail="Bad Request")
        
        assert exc_info.value.status_code == 400
        assert "Bad Request" in exc_info.value.detail


# ===============================================================================
# EXAMPLE 5: Endpoint Test with Query Parameters
# ===============================================================================

@pytest.mark.integration
class TestEndpointWithParameters:
    """Example of endpoint test with query parameters."""
    
    def test_endpoint_with_valid_parameter(self, client):
        """Test endpoint with valid parameter."""
        response = client.get("/api/columns?cat_sch_tab_lst=catalog.schema.table")
        # Note: May return 400 if there's no Spark connection
        assert response.status_code in [200, 400, 500]
    
    def test_endpoint_without_required_parameter(self, client):
        """Test endpoint without required parameter."""
        response = client.get("/api/columns")
        assert response.status_code == 400


# ===============================================================================
# EXAMPLE 6: Parametrized Test (Multiple Cases)
# ===============================================================================

@pytest.mark.unit
class TestParametrizedExample:
    """Example of parametrized test that runs multiple scenarios."""
    
    @pytest.mark.parametrize("input_value,expected", [
        (0, "zero"),
        (1, "one"),
        (2, "two"),
        (-1, "negative"),
    ])
    def test_convert_number_to_text(self, input_value, expected):
        """Test number to text conversion with multiple values."""
        converter_map = {
            0: "zero",
            1: "one",
            2: "two",
            -1: "negative"
        }
        assert converter_map.get(input_value) == expected
    
    @pytest.mark.parametrize("query", [
        "SELECT * FROM table",
        "SELECT id, name FROM users WHERE id > 10",
        "SELECT COUNT(*) FROM products",
    ])
    def test_multiple_queries_are_valid(self, query):
        """Test multiple queries."""
        assert query.startswith("SELECT")


# ===============================================================================
# EXAMPLE 7: Test with Custom Fixtures
# ===============================================================================

@pytest.fixture
def user_test_data():
    """Fixture that provides user test data."""
    return {
        "id": 1,
        "name": "John Silva",
        "email": "joao@example.com",
        "active": True
    }

@pytest.mark.unit
class TestExampleWithCustomFixture:
    """Example using custom fixture."""
    
    def test_user_has_valid_email(self, user_test_data):
        """Test if user has valid email."""
        assert "@" in user_test_data["email"]
        assert "." in user_test_data["email"]
    
    def test_user_is_active(self, user_test_data):
        """Test if user is active."""
        assert user_test_data["active"] is True


# ===============================================================================
# EXAMPLE 8: Asynchronous Behavior Test
# ===============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
class TestAsyncExample:
    """Example of test with asynchronous code."""
    
    async def test_endpoint_async(self, client):
        """Test endpoint in asynchronous way (compatible with FastAPI)."""
        response = client.get("/api/about")
        assert response.status_code == 200


# ===============================================================================
# EXAMPLE 9: Performance/Benchmark Test
# ===============================================================================

@pytest.mark.slow
class TestPerformanceExample:
    """Example of performance test."""
    
    def test_function_with_timeout(self):
        """Test if function executes within time limit."""
        import time
        
        start = time.time()
        # Simulate fast operation
        time.sleep(0.01)
        duration = time.time() - start
        
        # Must execute in less than 1 second
        assert duration < 1.0


# ===============================================================================
# EXAMPLE 10: Test with Mock Context Manager
# ===============================================================================

@pytest.mark.unit
class TestContextManagerExample:
    """Example using patch as context manager."""
    
    def test_with_patch_as_context_manager(self):
        """Test using patch within context manager."""
        from unittest.mock import patch
        
        with patch('app.CONFIG_SYS.APP.NAME') as mock_name:
            mock_name.__str__.return_value = "Test App"
            # Test here
            assert True


# ===============================================================================
# TIPS AND BEST PRACTICES
# ===============================================================================

"""
✅ DO:

1. Use descriptive names in English
   ✓ test_endpoint_returns_200_with_valid_parameter
   ✗ test_endpoint1

2. Follow AAA pattern (Arrange-Act-Assert)
   ✓ Prepare data -> Execute -> Verify results
   ✗ Mix setup logic with assertions

3. Use fixtures for reusable data
   ✓ Fixture provides data
   ✗ Hardcode data in each test

4. Mock external dependencies
   ✓ Mock Spark, Database, External APIs
   ✗ Depend on real services running

5. Independent tests
   ✓ Each test is isolated
   ✗ Test A depends on Test B result

6. Use markers (@pytest.mark)
   ✓ @pytest.mark.unit, @pytest.mark.spark
   ✗ No categorization

7. Document with docstrings
   ✓ def test_example(): \"\"\"Test behavior X.\"\"\"
   ✗ def test_example(): pass


❌ AVOID:

1. Sleeps and timeouts
   ❌ time.sleep(0.5); assert True
   ✓ Use mocks to control time

2. Non-deterministic tests
   ❌ Test that fails randomly
   ✓ Same input = same result always

3. Complex logic in tests
   ❌ Test with loops, complex conditionals
   ✓ Simple and direct tests

4. Multiple asserts without context
   ❌ assert x == 1; assert y == 2; assert z == 3
   ✓ Group asserts with clear description

5. Test implementation (not behavior)
   ❌ assert mock_spark.sql.called  (implementation)
   ✓ assert result.count() == 42 (behavior)

6. Copy-paste test code
   ❌ Same code in 10 tests
   ✓ Use fixtures and parametrization

7. Tests without purpose
   ❌ Test that always passes without checking anything
   ✓ Each test should fail if code breaks


🎯 FINAL GOAL:

Tests that:
  • Are easy to understand
  • Execute fast
  • Don't interfere with each other
  • Fail when code breaks
  • Document expected behavior
  • Are easy to maintain
"""
