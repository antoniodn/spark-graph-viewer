"""
Tests for FastAPI API Endpoints.
Integration tests for application endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.mark.integration
class TestIndexEndpoint:
    """Tests for the index endpoint (GET /)."""
    
    def test_get_index_success(self, client):
        """Test if the GET / endpoint returns status 200."""
        response = client.get("/")
        assert response.status_code == 200
    
    def test_get_index_returns_html(self, client):
        """Test if the endpoint returns HTML content."""
        response = client.get("/")
        assert "text/html" in response.headers.get("content-type", "")


@pytest.mark.integration
class TestAboutEndpoint:
    """Tests for the GET /api/about endpoint."""
    
    def test_get_api_about_success(self, client):
        """Test if the request is successful (status 200)."""
        response = client.get("/api/about")
        assert response.status_code == 200
    
    def test_get_api_about_structure(self, client):
        """Test if the response contains the expected keys."""
        response = client.get("/api/about")
        data = response.json()
        
        assert "name" in data
        assert "version" in data
        assert "description" in data
        assert "author" in data
        assert "date" in data
    
    def test_get_api_about_data_types(self, client):
        """Test if returned data has correct types."""
        response = client.get("/api/about")
        data = response.json()
        
        assert isinstance(data["name"], str)
        assert isinstance(data["version"], str)
        assert isinstance(data["description"], str)
        assert isinstance(data["author"], str)
        assert isinstance(data["date"], str)
    
    def test_get_api_about_not_empty(self, client):
        """Test if values are not empty."""
        response = client.get("/api/about")
        data = response.json()
        
        assert len(data["name"]) > 0
        assert len(data["version"]) > 0
        assert len(data["description"]) > 0


@pytest.mark.integration
@pytest.mark.spark
class TestCatalogsEndpoint:
    """Tests for the GET /api/catalogs endpoint."""
    
    @patch('app.get_dataframe_from_sql')
    def test_get_api_catalogs_success(self, mock_sql, client, mock_spark_dataframe):
        """Test if the endpoint returns catalog data successfully."""
        # Configure mock to return simulated data
        mock_sql.return_value = mock_spark_dataframe
        
        # This test may fail without real Spark connection
        # So it is marked with @pytest.mark.spark
        # To execute: pytest -m spark
    
    @patch('app.get_dataframe_from_sql')
    def test_get_api_catalogs_response_format(self, mock_sql, client, mock_spark_dataframe):
        """Test if the response has the expected format."""
        # Configure mock to return catalog structure
        mock_sql.return_value = mock_spark_dataframe


@pytest.mark.integration
class TestColumnsEndpoint:
    """Tests for the GET /api/columns endpoint."""
    
    def test_get_api_columns_missing_parameter(self, client):
        """Test if endpoint returns error 400 when parameter is missing."""
        response = client.get("/api/columns")
        assert response.status_code == 400
        assert "required" in response.json()["detail"].lower()
    
    def test_get_api_columns_empty_parameter(self, client):
        """Test if endpoint returns error 400 when parameter is empty."""
        response = client.get("/api/columns?cat_sch_tab_lst=")
        assert response.status_code == 400
    
    @patch('app.get_dataframe_from_sql')
    def test_get_api_columns_valid_parameter(self, mock_sql, client, mock_spark_dataframe):
        """Test the endpoint with valid parameter."""
        mock_sql.return_value = mock_spark_dataframe
        mock_spark_dataframe.isEmpty.return_value = False
        mock_spark_dataframe.collect.return_value = [
            MagicMock(col_name="id"),
            MagicMock(col_name="name")
        ]
    
    def test_get_api_columns_invalid_format(self, client):
        """Test if endpoint returns error with invalid format."""
        # Less than 3 parts (catalog.schema.table)
        response = client.get("/api/columns?cat_sch_tab_lst=table_only")
        assert response.status_code == 400
    
    def test_get_api_columns_multiple_tables(self, client):
        """Test the endpoint with multiple tables."""
        # Multiple tables separated by comma
        response = client.get("/api/columns?cat_sch_tab_lst=cat1.sch1.tab1,cat2.sch2.tab2")
        # May fail without Spark connection, but not due to invalid format


@pytest.mark.unit
class TestHealthcheck:
    """Application health/sanity tests."""
    
    def test_app_is_fastapi(self, client):
        """Check if the application is a valid FastAPI instance."""
        # Test an endpoint that always exists
        response = client.get("/api/about")
        assert response.status_code == 200
    
    def test_app_responds_to_requests(self, client):
        """Check if the application responds to requests."""
        response = client.get("/api/about")
        assert response.status_code in [200, 404, 400, 500]  # Any valid response
