from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import pyspark
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql import SparkSession
from pyspark.errors import PySparkException
from pyspark.sql.types import StructType, StructField, StringType, ArrayType

from py4j.protocol import Py4JJavaError

import json
import logging
from types import SimpleNamespace

from static.src.sqlgraph import *


# -------------------------------------------------------------------------------
# Configurations variables
# -------------------------------------------------------------------------------

CONFIG_SYS = SimpleNamespace(
    APP = SimpleNamespace(
        NAME ="Spark Graph Viewer",
        DESCRIPTION ="An Apache Spark application to visualize graph data.",
        VERSION ="1.0.0",
        AUTHOR ="Antonio Domingues Neto",
        DATE ="2025-10-12",
    ),
    DATA_LIMIT = 2048,
)

# logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(asctime)s - %(name)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


# -------------------------------------------------------------------------------
# Initialize Spark Session
# -------------------------------------------------------------------------------

# Create Spark session with Delta Lake support, using the remote cluster URL.
spark = SparkSession.builder \
    .appName("PysparkApp") \
    .remote("sc://spark-connect:15002") \
    .getOrCreate()


# -------------------------------------------------------------------------------
# Initialize FastAPI objects
# -------------------------------------------------------------------------------

# Initialize the FastAPI app
app = FastAPI()

# Mount the static directory to serve JavaScript, CSS, etc.
# The `name` is used by the template engine to reference the static files.
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize the Jinja2 templates, pointing to the templates directory.
templates = Jinja2Templates(directory="templates")


# -------------------------------------------------------------------------------
# HTML page endpoint
# -------------------------------------------------------------------------------

@app.get("/", response_class=templates.TemplateResponse)
async def serve_index(request: Request):
    """Serves the main index.html page.

    Arguments:
        request: Request - The incoming HTTP request object, required for template rendering.    
    Returns:
        templates.TemplateResponse - The rendered index.html template.
    """
    # When rendering a template, you must pass the `request` object.
    return templates.TemplateResponse("index.html", {"request": request})


# -------------------------------------------------------------------------------
# General functions
# -------------------------------------------------------------------------------

def get_dataframe_from_sql(sql_query: str) -> DataFrame:
    """Executes an SQL query and returns the result as a Spark DataFrame.
    
    Arguments:
        sql_query: str - The SQL query to execute.
    Returns:
        DataFrame - A Spark DataFrame containing the query results.
    """
    logging.info("call get_dataframe_from_sql")

    try:
        # Execute the SQL query using Spark SQL
        spark_df: DataFrame = spark.sql(sql_query)
        return spark_df
    except Exception as e:
        logging.error("get_dataframe_from_sql -> Error: {}\n\nSQL Query: {}\n\n".format(e, sql_query))
        raise e

# -------------------------------------------------------------------------------
# API endpoint
# -------------------------------------------------------------------------------

@app.get("/api/about")
async def get_api_about():
    """App Information.
    
    Returns:
        dict - A JSON object with the app information.
    """
    return {
            "name": CONFIG_SYS.APP.NAME,
            "version": CONFIG_SYS.APP.VERSION,
            "description": CONFIG_SYS.APP.DESCRIPTION,
            "author": CONFIG_SYS.APP.AUTHOR,
            "date": CONFIG_SYS.APP.DATE,
        }

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/catalogs")
async def get_api_catalogs():
    """Returns the catalogs in a JSON format.
    
    Returns:
        dict - A JSON object with the catalogs, schemas, and tables.
    """
    logging.info("call get_api_catalogs")

    try:
        # Get list of catalogs
        catalogs_df: DataFrame = get_dataframe_from_sql(f"SHOW CATALOGS")
        catalogs = [row[0] for row in catalogs_df.collect()]

        # Get the list of catalogs, schemas, and tables.
        all_data: list = []
        for cat in catalogs:
            # Get the schema list for each catalog from SHOW SCHEMAS
            schemas_df: DataFrame = get_dataframe_from_sql(f"SHOW SCHEMAS IN {cat}")
            schemas_list: list = [row[0] for row in schemas_df.collect()]

            # From the list of schemas, you obtain the tables.
            for schema in schemas_list:
                # Get the table list for each schema from SHOW TABLES
                tables_df: DataFrame = get_dataframe_from_sql(f"SHOW TABLES IN {cat}.{schema}")

                # If there are tables, process them
                if tables_df.isEmpty() == False:
                    # Gets the names of the tables
                    tables: list = [row.tableName for row in tables_df.collect()]
                    
                    # Stores the catalog name, schema, and table
                    all_data.append((cat, schema, sorted(tables)))
                else:
                    # If no tables in schema, still add the catalog and schema with an empty list
                    all_data.append((cat, schema, []))

        logging.info("all_data: {}".format(all_data))

        # Create a DataFrame from all_data
        schema_df: StructType = StructType([
            StructField("table_catalog", StringType(), True),
            StructField("table_schema", StringType(), True),
            StructField("tables", ArrayType(StringType()), True)
        ])
        df: DataFrame = spark.createDataFrame(all_data, schema_df)

        # Creates the catalog structure in JSON format.
        final_json_str: str = (df
            .groupBy("table_catalog")
            .agg(F.map_from_entries(
                F.collect_list(F.struct("table_schema", "tables"))
            ).alias("schemas"))
            .groupBy()
            .agg(F.to_json(
                F.map_from_entries(
                    F.collect_list(F.struct("table_catalog", "schemas"))
                )
            ).alias("catalogs"))
        ).collect()[0][0]
        final_json: dict = json.loads(final_json_str)

        # Successful return catalogs
        return final_json

    except HTTPException as http_exc:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_catalogs -> Error: {}".format(http_exc.detail))
        # Re-raise existing HTTPException without modification
        raise http_exc
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_catalogs -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/columns")
async def get_api_columns(cat_sch_tab_lst: str = None):
    """Returns the columns list of tables.
    
    Arguments:
        cat_sch_tab_lst: str - list of string in the format 'catalog.schema.table' divide by comma to filter tables.
    Returns:
        dict - A JSON object with the columns of the specified tables.
    """
    logging.info("call get_api_columns")

    # Validate input parameter
    if (cat_sch_tab_lst == None) or (len(cat_sch_tab_lst.strip()) == 0):
        raise HTTPException(status_code=400, detail="Parameter 'cat_sch_tab' is required in the format 'catalog.schema.table' list.")

    # Get columns
    try:
        all_columns_data: list = []

        # Iterate through the tables to find the columns using SHOW COLUMNS.
        for full_table_path in cat_sch_tab_lst.split(","):
            parts: list = full_table_path.strip().split(".")
            if len(parts) == 3:
                # Executes the equivalent command to INFORMATION_SCHEMA.COLUMNS for each table
                cols_df: DataFrame = get_dataframe_from_sql(f"SHOW COLUMNS IN {full_table_path}")
                
                # Get the column names
                column_names: list = []
                if cols_df.isEmpty() == False:
                    column_names = sorted([row['col_name'] for row in cols_df.collect()])

                # Store the table path and its columns
                all_columns_data.append((full_table_path, column_names))
            else:
                raise HTTPException(status_code=400, detail="Invalid format for 'cat_sch_tab': {}. Expected format is 'catalog.schema.table'.".format(full_table_path))

        # Create a DataFrame with the results and generate the final JSON.
        if all_columns_data:
            final_json_str: str = (spark.createDataFrame(all_columns_data, ["table_path", "columns"])
                .groupBy()
                .agg(F.to_json(
                    F.map_from_entries(
                        F.collect_list(F.struct("table_path", "columns"))
                    )
                ).alias("columns_json"))
            ).collect()[0][0]
            final_json: dict = json.loads(final_json_str)

            # Successful return columns information
            return final_json
        else:
            return {}

    except HTTPException as http_exc:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_columns -> Error: {}".format(http_exc.detail))
        # Re-raise existing HTTPException without modification
        raise http_exc
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_columns -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/types")
async def get_api_types(
        vertices_table: str = None,
        vertices_column_type: str = None,
        edges_table: str = None,
        edges_column_type: str = None ):
    """Returns the types of vertices and edges.
    
    Arguments:
        vertices_table: full name of table (with catalog, schema e table).
		vertices_column_type: column name.
        edges_table: full name of table (with catalog, schema e table).
		edges_column_type: column name.
    Returns:
        dict - A JSON object with the types of vertices and edges.
    """
    logging.info("call get_api_types")

    # Validate input parameter
    for param in [(vertices_table,"vertices_table"), (edges_table,"edges_table")]:
        if (param[0] == None) or (len(str(param[0]).strip()) == 0):
            raise HTTPException(status_code=400, detail="Parameter '{}' is required.".format(param[1]))

    # Execute query to get columns
    try:
        # Build SQL query to get types of vertices and edges
        sql_query: str = """
                    with
                        cte_vertices as (
                            select to_json(map_from_entries(collect_list(struct(colkey, qty)))) as vertices
                              from (select coalesce(colkey::string, "") as colkey, count(*) as qty
                                      from (select {vertices_column_type} as colkey from {vertices_table})
                                     group by colkey)
                             limit 64
                        ),
                        cte_edges as (
                            select to_json(map_from_entries(collect_list(struct(colkey, qty)))) as edges
                              from (select coalesce(colkey::string, "") as colkey, count(*) as qty 
                                      from (select {edges_column_type} as colkey from {edges_table})
                                     group by colkey)
                              limit 64
                        )
                    select to_json(named_struct("vertices", parse_json(vertices), "edges", parse_json(edges))) as types
                      from cte_vertices, cte_edges
                """.format(
                    vertices_table=vertices_table, 
                    vertices_column_type=(vertices_column_type if vertices_column_type else "'_'"), 
                    edges_table=edges_table, 
                    edges_column_type=(edges_column_type if edges_column_type else "'_'")
                )
        
        # Get types DataFrame from SQL
        types_df: DataFrame = get_dataframe_from_sql(sql_query)

        # Verify if types information is available
        if types_df.isEmpty() == True:
            raise HTTPException(status_code=404, detail="No types information found.")
        
        types_values: str = types_df.collect()[0][0]
        if (types_values is None) or (len(types_values.strip()) == 0):
            raise HTTPException(status_code=404, detail="No types information found.")

        # Convert types JSON string to dictionary
        types_values: dict = json.loads(types_values)

        # Successful return types information
        return types_values

    except HTTPException as http_exc:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_types -> Error: {}".format(http_exc.detail))
        # Re-raise existing HTTPException without modification
        raise http_exc
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_types -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/graph/cancel")
def get_api_cancel_job(job_id):
    """Cancel a specific Spark job by its ID.
    
    Arguments:
        job_id: str - The ID of the Spark job to cancel.

    Returns:
        dict - A JSON object indicating the cancellation status."""
    logging.info("call get_api_cancel_job")

    try:
        spark.interruptTag(job_id)
        return {"status": "interrupted", "job_id": job_id}
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_cancel_job -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/graph/find")
async def get_api_graph_find(
        job_id: str = None,
        vertices_table: str = None,
        edges_table: str = None,
        col_vertex_id: str = None,
        col_edge_src: str = None,
        col_edge_dst: str = None,
        motif_expression: str = None,
        filter_clause: str = None,
        global_filter_vertex: str = None,
        global_filter_edge: str = None
    ):
    """Returns graph data in JSON format based on a sample query.
    
    Arguments:
        vertices_table: str - full name of table (with catalog, schema e table).
        edges_table: str - full name of table (with catalog, schema e table).
        col_vertex_id: str - column name for vertex ID.
        col_edge_src: str - column name for edge source.
        col_edge_dst: str - column name for edge destination.
        motif_expression: str - motif expression to match.
        filter_clause: str - filter clause to apply.
        global_filter_vertex (str, optional): Global filter condition for vertices.
        global_filter_edge (str, optional): Global filter condition for edges.

    Returns:
        dict - A JSON object with the graph data (vertices and edges).
    """
    logging.info("call get_api_graph_find")

    try:
        # Validate input parameter
        for param in [(job_id,"job_id"),
                        (vertices_table,"vertices_table"), 
                        (edges_table,"edges_table"),
                        (col_vertex_id,"col_vertex_id"),
                        (col_edge_src,"col_edge_src"),
                        (col_edge_dst,"col_edge_dst"),
                        (motif_expression,"motif_expression")]:
            if (param[0] == None) or (len(str(param[0]).strip()) == 0):
                raise HTTPException(status_code=400, detail="Parameter '{}' is required.".format(param[1]))
            
        # Add job_id as a tag to the Spark session for better traceability in logs and monitoring
        spark.addTag(job_id)

        # execute SQL to find graph patterns based on the motif expression and filter clause
        params = {
            "vertex_table": vertices_table,
            "vertex_id": col_vertex_id,
            "edge_table": edges_table,
            "edge_src_id": col_edge_src,
            "edge_dst_id": col_edge_dst,
            "motif_expression": motif_expression,
            "filter_clause": filter_clause if filter_clause else "true",
            "global_filter_vertex": global_filter_vertex if global_filter_vertex else None,
            "global_filter_edge": global_filter_edge if global_filter_edge else None
        }
        sql_cmd: str = sql_graph_motif_find(**params)
        results_df: DataFrame = get_dataframe_from_sql(sql_cmd)

        # Collect results from the DataFrame
        rows = results_df.collect()

        # Convert the JSON from result to a Python dictionary
        if rows:
            graph_dict: dict = json.loads(rows[0][0])  # Convert the JSON string from the first row and first column of the DataFrame to a Python dictionary
        else:
            graph_dict: dict = { "vertices": [], "edges": [] }
        
        # Successful return graph data
        return graph_dict
    
    except HTTPException as http_exc:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_find -> Error: {}".format(http_exc.detail))
        # Re-raise existing HTTPException without modification
        raise http_exc
    except Py4JJavaError as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_find -> Error: {}".format(str(e.java_exception.getMessage()).splitlines()[0]))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(str(e.java_exception.getMessage()).splitlines()[0]))
    except PySparkException as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_find -> Error: {}".format(e.getMessage()))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(e.getMessage()))
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_find -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/graph/allpaths")
async def get_api_graph_allpaths(
        job_id: str = None,
        vertices_table: str = None,
        edges_table: str = None,
        col_vertex_id: str = None,
        col_edge_src: str = None,
        col_edge_dst: str = None,
        fromExpr: str = None,
        toExpr: str = None,
        max_distance: int = None,
        edgeExpr: str = None,
        global_filter_vertex: str = None,
        global_filter_edge: str = None
    ):
    """Returns graph data in JSON format based on a sample query.
    
    Arguments:
        job_id: str - The ID of the Spark job to cancel.
        vertices_table: str - full name of table (with catalog, schema e table).
        edges_table: str - full name of table (with catalog, schema e table).
        col_vertex_id: str - column name for vertex ID.
        col_edge_src: str - column name for edge source.
        col_edge_dst: str - column name for edge destination.
        fromExpr: str - SQL filter expression for the starting point.
        toExpr: str - SQL filter expression for the end point.
        max_distance: int - Maximum number of hops.
        edgeExpr: str(optional) - SQL filter expression for edges.
        global_filter_vertex (str, optional): Global filter condition for vertices.
        global_filter_edge (str, optional): Global filter condition for edges.

    Returns:
        dict - A JSON object with the graph data (vertices and edges).
    """
    logging.info("call get_api_graph_allpaths")

    try:
        # Validate input parameter
        for param in [(job_id,"job_id"),
                        (vertices_table,"vertices_table"), 
                        (edges_table,"edges_table"),
                        (col_vertex_id,"col_vertex_id"),
                        (col_edge_src,"col_edge_src"),
                        (col_edge_dst,"col_edge_dst"),
                        (fromExpr,"fromExpr"),
                        (toExpr,"toExpr"),
                        (max_distance,"max_distance")]:
            if (param[0] == None) or (len(str(param[0]).strip()) == 0):
                raise HTTPException(status_code=400, detail="Parameter '{}' is required.".format(param[1]))
            
        # Add job_id as a tag to the Spark session for better traceability in logs and monitoring
        spark.addTag(job_id)

        # execute SQL to find graph patterns based on the motif expression and filter clause
        params = {
            "vertex_table": vertices_table,
            "vertex_id": col_vertex_id,
            "edge_table": edges_table,
            "edge_src_id": col_edge_src,
            "edge_dst_id": col_edge_dst,
            "fromExpr": fromExpr,
            "toExpr": toExpr,
            "max_distance": max_distance,
            "edgeExpr": edgeExpr,
            "global_filter_vertex": global_filter_vertex if global_filter_vertex else None,
            "global_filter_edge": global_filter_edge if global_filter_edge else None
        }
        sql_cmd: str = sql_graph_all_paths(**params)
        results_df: DataFrame = get_dataframe_from_sql(sql_cmd)

        # Collect results from the DataFrame
        rows = results_df.collect()

        # Convert the JSON from result to a Python dictionary
        if rows:
            graph_dict: dict = json.loads(rows[0][0])  # Convert the JSON string from the first row and first column of the DataFrame to a Python dictionary
        else:
            graph_dict: dict = { "vertices": [], "edges": [] }

        # Successful return graph data
        return graph_dict
    
    except HTTPException as http_exc:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_allpaths -> Error: {}".format(http_exc.detail))
        # Re-raise existing HTTPException without modification
        raise http_exc
    except Py4JJavaError as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_allpaths -> Error: {}".format(str(e.java_exception.getMessage()).splitlines()[0]))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(str(e.java_exception.getMessage()).splitlines()[0]))
    except PySparkException as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_allpaths -> Error: {}".format(e.getMessage()))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(e.getMessage()))
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_allpaths -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/graph/shortestpath")
async def get_api_graph_shortestpath(
        job_id: str = None,
        vertices_table: str = None,
        edges_table: str = None,
        col_vertex_id: str = None,
        col_edge_src: str = None,
        col_edge_dst: str = None,
        fromExpr: str = None,
        toExpr: str = None,
        max_distance: int = None,
        edgeExpr: str = None,
        global_filter_vertex: str = None,
        global_filter_edge: str = None
    ):
    """Returns graph data in JSON format based on a sample query.
    
    Arguments:
        job_id: str - The ID of the Spark job to cancel.
        vertices_table: str - full name of table (with catalog, schema e table).
        edges_table: str - full name of table (with catalog, schema e table).
        col_vertex_id: str - column name for vertex ID.
        col_edge_src: str - column name for edge source.
        col_edge_dst: str - column name for edge destination.
        fromExpr: str - SQL filter expression for the starting point.
        toExpr: str - SQL filter expression for the end point.
        max_distance: int - Maximum number of hops.
        edgeExpr: str(optional) - SQL filter expression for edges.
        global_filter_vertex (str, optional): Global filter condition for vertices.
        global_filter_edge (str, optional): Global filter condition for edges.

    Returns:
        dict - A JSON object with the graph data (vertices and edges).
    """
    logging.info("call get_api_graph_shortestpath")

    try:
        # Validate input parameter
        for param in [(job_id,"job_id"),
                        (vertices_table,"vertices_table"), 
                        (edges_table,"edges_table"),
                        (col_vertex_id,"col_vertex_id"),
                        (col_edge_src,"col_edge_src"),
                        (col_edge_dst,"col_edge_dst"),
                        (fromExpr,"fromExpr"),
                        (toExpr,"toExpr"),
                        (max_distance,"max_distance")]:
            if (param[0] == None) or (len(str(param[0]).strip()) == 0):
                raise HTTPException(status_code=400, detail="Parameter '{}' is required.".format(param[1]))
            
        # Add job_id as a tag to the Spark session for better traceability in logs and monitoring
        spark.addTag(job_id)

        # execute SQL to find graph patterns based on the motif expression and filter clause
        params = {
            "vertex_table": vertices_table,
            "vertex_id": col_vertex_id,
            "edge_table": edges_table,
            "edge_src_id": col_edge_src,
            "edge_dst_id": col_edge_dst,
            "fromExpr": fromExpr,
            "toExpr": toExpr,
            "max_distance": max_distance,
            "edgeExpr": edgeExpr,
            "global_filter_vertex": global_filter_vertex if global_filter_vertex else None,
            "global_filter_edge": global_filter_edge if global_filter_edge else None
        }
        sql_cmd: str = sql_graph_shortest_path(**params)
        results_df: DataFrame = get_dataframe_from_sql(sql_cmd)

        # Collect results from the DataFrame
        rows = results_df.collect()

        # Convert the JSON from result to a Python dictionary
        if rows:
            graph_dict: dict = json.loads(rows[0][0])  # Convert the JSON string from the first row and first column of the DataFrame to a Python dictionary
        else:
            graph_dict: dict = { "vertices": [], "edges": [] }

        # Successful return graph data
        return graph_dict
    
    except HTTPException as http_exc:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_shortestpath -> Error: {}".format(http_exc.detail))
        # Re-raise existing HTTPException without modification
        raise http_exc
    except Py4JJavaError as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_shortestpath -> Error: {}".format(str(e.java_exception.getMessage()).splitlines()[0]))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(str(e.java_exception.getMessage()).splitlines()[0]))
    except PySparkException as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_shortestpath -> Error: {}".format(e.getMessage()))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(e.getMessage()))
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_shortestpath -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

@app.get("/api/graph/triangulation")
async def get_api_graph_triangulation(
        job_id: str = None,
        vertices_table: str = None,
        edges_table: str = None,
        col_vertex_id: str = None,
        col_edge_src: str = None,
        col_edge_dst: str = None,
        fromExpr: str = None,
        max_distance: int = None,
        edgeExpr: str = None,
        global_filter_vertex: str = None,
        global_filter_edge: str = None
    ):
    """Returns graph data in JSON format based on a sample query.
    
    Arguments:
        job_id: str - The ID of the Spark job to cancel.
        vertices_table: str - full name of table (with catalog, schema e table).
        edges_table: str - full name of table (with catalog, schema e table).
        col_vertex_id: str - column name for vertex ID.
        col_edge_src: str - column name for edge source.
        col_edge_dst: str - column name for edge destination.
        fromExpr: str - SQL filter expression for the starting point.
        max_distance: int - Maximum number of hops.
        edgeExpr: str(optional) - SQL filter expression for edges.
        global_filter_vertex (str, optional): Global filter condition for vertices.
        global_filter_edge (str, optional): Global filter condition for edges.

    Returns:
        dict - A JSON object with the graph data (vertices and edges).
    """
    logging.info("call get_api_graph_triangulation")

    try:
        # Validate input parameter
        for param in [(job_id,"job_id"),
                        (vertices_table,"vertices_table"), 
                        (edges_table,"edges_table"),
                        (col_vertex_id,"col_vertex_id"),
                        (col_edge_src,"col_edge_src"),
                        (col_edge_dst,"col_edge_dst"),
                        (fromExpr,"fromExpr"),
                        (max_distance,"max_distance")]:
            if (param[0] == None) or (len(str(param[0]).strip()) == 0):
                raise HTTPException(status_code=400, detail="Parameter '{}' is required.".format(param[1]))
            
        # Add job_id as a tag to the Spark session for better traceability in logs and monitoring
        spark.addTag(job_id)

        # execute SQL to find graph patterns based on the motif expression and filter clause
        params = {
            "vertex_table": vertices_table,
            "vertex_id": col_vertex_id,
            "edge_table": edges_table,
            "edge_src_id": col_edge_src,
            "edge_dst_id": col_edge_dst,
            "fromExpr": fromExpr,
            "max_distance": max_distance,
            "edgeExpr": edgeExpr,
            "global_filter_vertex": global_filter_vertex if global_filter_vertex else None,
            "global_filter_edge": global_filter_edge if global_filter_edge else None
        }
        sql_cmd: str = sql_graph_vertex_triangulation(**params)
        results_df: DataFrame = get_dataframe_from_sql(sql_cmd)

        # Collect results from the DataFrame
        rows = results_df.collect()

        # Convert the JSON from result to a Python dictionary
        if rows:
            graph_dict: dict = json.loads(rows[0][0])  # Convert the JSON string from the first row and first column of the DataFrame to a Python dictionary
        else:
            graph_dict: dict = { "vertices": [], "edges": [] }

        # Successful return graph data
        return graph_dict
    
    except HTTPException as http_exc:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_triangulation -> Error: {}".format(http_exc.detail))
        # Re-raise existing HTTPException without modification
        raise http_exc
    except Py4JJavaError as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_triangulation -> Error: {}".format(str(e.java_exception.getMessage()).splitlines()[0]))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(str(e.java_exception.getMessage()).splitlines()[0]))
    except PySparkException as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_triangulation -> Error: {}".format(e.getMessage()))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="{}".format(e.getMessage()))
    except Exception as e:
        # Log the detailed error for debugging purposes (optional but recommended)
        logging.error("get_api_graph_triangulation -> Error: {}".format(e))
        # Raise a new HTTPException with a 500 status code and a generic detail message
        # Avoid exposing raw internal error details to the client in production
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the request.")
