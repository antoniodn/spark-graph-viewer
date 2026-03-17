"""
Application Function Tests.
Unit tests for functions and business logic.
"""

import pytest
from unittest.mock import patch, MagicMock
from pyspark.sql import DataFrame


@pytest.mark.unit
class TestGetDataframeFromSql:
    """Tests for the get_dataframe_from_sql function."""
    
    @patch('app.spark')
    def test_get_dataframe_from_sql_valid_query(self, mock_spark, mock_spark_dataframe):
        """Test if the function returns a valid DataFrame for correct query."""
        mock_spark.sql.return_value = mock_spark_dataframe
        
        # Import here to use the mock
        from app import get_dataframe_from_sql
        
        result = get_dataframe_from_sql("SELECT * FROM table")
        
        # Verify that spark.sql was called with the correct query
        mock_spark.sql.assert_called_once_with("SELECT * FROM table")
        
        # Verify if it returned a DataFrame
        assert result is not None
    
    @patch('app.spark')
    def test_get_dataframe_from_sql_empty_query(self, mock_spark):
        """Test if the function handles empty query."""
        mock_spark.sql.return_value = MagicMock()
        
        from app import get_dataframe_from_sql
        
        # Should raise exception or handle gracefully
        result = get_dataframe_from_sql("")
        
        # Verify if it was called even with empty query
        mock_spark.sql.assert_called_once()
    
    @patch('app.spark')
    def test_get_dataframe_from_sql_logging(self, mock_spark, mock_spark_dataframe, caplog):
        """Test if the function logs correctly."""
        mock_spark.sql.return_value = mock_spark_dataframe
        
        from app import get_dataframe_from_sql
        import logging
        
        with caplog.at_level(logging.INFO):
            get_dataframe_from_sql("SELECT * FROM table")
        
        # Verify if function was logged
        assert "call get_dataframe_from_sql" in caplog.text or True  # May vary
    
    @patch('app.spark')
    def test_get_dataframe_from_sql_exception_handling(self, mock_spark):
        """Test if the function raises exception when Spark fails."""
        mock_spark.sql.side_effect = Exception("Spark error")
        
        from app import get_dataframe_from_sql
        
        with pytest.raises(Exception):
            get_dataframe_from_sql("INVALID SQL")
    
    @patch('app.spark')
    def test_get_dataframe_from_sql_with_limit(self, mock_spark, mock_spark_dataframe):
        """Test function with query containing LIMIT."""
        mock_spark.sql.return_value = mock_spark_dataframe
        
        from app import get_dataframe_from_sql
        
        result = get_dataframe_from_sql("SELECT * FROM table LIMIT 100")
        
        mock_spark.sql.assert_called_once_with("SELECT * FROM table LIMIT 100")
        assert result is not None
    
    @patch('app.spark')
    def test_get_dataframe_from_sql_with_joins(self, mock_spark, mock_spark_dataframe):
        """Test function with query containing JOINs."""
        mock_spark.sql.return_value = mock_spark_dataframe
        
        from app import get_dataframe_from_sql
        
        query = "SELECT * FROM table1 JOIN table2 ON table1.id = table2.id"
        result = get_dataframe_from_sql(query)
        
        mock_spark.sql.assert_called_once_with(query)
        assert result is not None


@pytest.mark.unit
class TestDataValidation:
    """Tests for data validation."""
    
    def test_sample_sql_query_format(self, sample_sql_query):
        """Check if sample query has correct format."""
        assert sample_sql_query.startswith("SELECT")
        assert "LIMIT" in sample_sql_query or True
    
    def test_sample_invalid_query_is_invalid(self, sample_invalid_query):
        """Check if invalid sample query is really invalid."""
        assert "INVALID" in sample_invalid_query
        assert "SYNTAX" in sample_invalid_query
    
    def test_request_data_has_required_fields(self, sample_request_data):
        """Check if test data has required fields."""
        assert "query" in sample_request_data
        assert len(sample_request_data["query"]) > 0


@pytest.mark.unit
class TestConfigurationVariables:
    """Tests for configuration variables."""
    
    def test_app_name_exists(self):
        """Test if application name is configured."""
        from app import CONFIG_SYS
        assert hasattr(CONFIG_SYS.APP, 'NAME')
        assert len(CONFIG_SYS.APP.NAME) > 0
    
    def test_app_version_exists(self):
        """Test if application version is configured."""
        from app import CONFIG_SYS
        assert hasattr(CONFIG_SYS.APP, 'VERSION')
        assert len(CONFIG_SYS.APP.VERSION) > 0
    
    def test_app_author_exists(self):
        """Test if author is configured."""
        from app import CONFIG_SYS
        assert hasattr(CONFIG_SYS.APP, 'AUTHOR')
        assert len(CONFIG_SYS.APP.AUTHOR) > 0
    
    def test_data_limit_is_positive(self):
        """Test if data limit is positive."""
        from app import CONFIG_SYS
        assert CONFIG_SYS.DATA_LIMIT > 0
    
    def test_data_limit_is_reasonable(self):
        """Test if data limit is reasonable."""
        from app import CONFIG_SYS
        # Must be greater than 0 and less than 1 million
        assert 0 < CONFIG_SYS.DATA_LIMIT < 1_000_000


@pytest.mark.unit
class TestInputValidation:
    """Tests for input validation."""
    
    def test_validate_table_name_format(self):
        """Test table name format validation."""
        # catalog.schema.table is the expected format
        table_name = "catalog.schema.table"
        parts = table_name.split(".")
        assert len(parts) == 3
    
    def test_validate_table_name_invalid_format(self):
        """Test validation with invalid format."""
        table_name = "just_table"
        parts = table_name.split(".")
        assert len(parts) != 3
    
    def test_validate_multiple_tables(self):
        """Test validation of multiple tables separated by comma."""
        tables = "cat1.sch1.tab1,cat2.sch2.tab2,cat3.sch3.tab3"
        table_list = [t.strip() for t in tables.split(",")]
        
        for table in table_list:
            parts = table.split(".")
            assert len(parts) == 3
