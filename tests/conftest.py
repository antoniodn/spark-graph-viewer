"""
Pytest configuration and fixtures for automated tests.
This file contains global configurations and reusable fixtures.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, MagicMock
import sys
from pathlib import Path

# Add project root directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import app


# -------------------------------------------------------------------------------
# Fixtures - FastAPI Client
# -------------------------------------------------------------------------------

@pytest.fixture
def client():
    """Fixture that provides a test client for the FastAPI application.
    
    Returns:
        TestClient: Client for making HTTP requests during testing.
    """
    return TestClient(app)


# -------------------------------------------------------------------------------
# Fixtures - Mock Spark Session
# -------------------------------------------------------------------------------

@pytest.fixture
def mock_spark_session():
    """Fixture that provides a mock of SparkSession for tests without real connection.
    
    Returns:
        MagicMock: Mock of SparkSession configured to return test DataFrames.
    """
    spark_mock = MagicMock()
    
    # Mock of the sql() method that returns a simulated DataFrame
    spark_mock.sql = MagicMock()
    
    return spark_mock


@pytest.fixture
def mock_spark_dataframe():
    """Fixture that provides a mock of a Spark DataFrame for tests.
    
    Returns:
        MagicMock: Mock of a DataFrame with common methods.
    """
    df_mock = MagicMock()
    df_mock.show = MagicMock()
    df_mock.count = MagicMock(return_value=42)
    df_mock.toPandas = MagicMock(return_value=None)
    df_mock.select = MagicMock(return_value=df_mock)
    df_mock.filter = MagicMock(return_value=df_mock)
    df_mock.groupBy = MagicMock(return_value=df_mock)
    
    return df_mock


# -------------------------------------------------------------------------------
# Fixtures - Test Data
# -------------------------------------------------------------------------------

@pytest.fixture
def sample_sql_query():
    """Fixture that provides a sample SQL query for tests.
    
    Returns:
        str: Valid SQL query.
    """
    return "SELECT * FROM nytaxi_trips LIMIT 100"


@pytest.fixture
def sample_invalid_query():
    """Fixture that provides an invalid SQL query for error tests.
    
    Returns:
        str: Malformed SQL query.
    """
    return "SELECT * INVALID SQL SYNTAX"


@pytest.fixture
def sample_request_data():
    """Fixture that provides sample data for POST requests.
    
    Returns:
        dict: Sample data for tests.
    """
    return {
        "query": "SELECT COUNT(*) FROM nytaxi_trips",
        "database": "default",
        "limit": 1000
    }


# -------------------------------------------------------------------------------
# Pytest Configuration
# -------------------------------------------------------------------------------

def pytest_configure(config):
    """Pytest hook for initial configuration.
    
    Arguments:
        config: Pytest configuration object.
    """
    # Register custom markers
    config.addinivalue_line(
        "markers", 
        "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", 
        "unit: marks tests as unit tests"
    )
    config.addinivalue_line(
        "markers", 
        "spark: marks tests that depend on Spark"
    )
    config.addinivalue_line(
        "markers", 
        "slow: marks tests that are slow"
    )
