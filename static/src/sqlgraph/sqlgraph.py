import re
import logging

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

def sql_graph_motif_find(
    vertex_table: str,
    vertex_id: str,
    edge_table: str,
    edge_src_id: str,
    edge_dst_id: str,
    motif_expression: str,
    filter_clause: str = None,
    limit: int = 2028,
    global_filter_vertex: str = None,
    global_filter_edge: str = None
) -> str:
    """
    Generates a SQL query to retrieve graph nodes and edges based on a MOTIF expression.
    The result is returned as a JSON structure containing arrays of vertices and edges.

    Args:
        vertex_table (str): Name of the source vertex table.
        vertex_id (str): Primary key column name of the vertex.
        edge_table (str): Name of the source edge table.
        edge_src_id (str): Column name for the source vertex ID in edges.
        edge_dst_id (str): Column name for the destination vertex ID in edges.
        motif_expression (str): Pattern expression (e.g., "(v1)-[e1]->(v2)").
        filter_clause (str, optional): Specific WHERE clause for the path discovery.
        limit (int): Maximum number of paths to return.
        global_filter_vertex (str, optional): Global filter condition for vertices.
        global_filter_edge (str, optional): Global filter condition for edges.

    Returns:
        str: A Spark SQL command returning a JSON string.
    """
    logging.info("Executing sql_graph_motif_find")

    try:
        # list[str]: Parse individual segments of the motif
        patterns: list[str] = [p.strip() for p in motif_expression.split(";")]
        
        # list[str]: Components for the path array construction
        path_array_elements: list[str] = []
        # list[str]: JOIN clauses for the main path discovery CTE
        path_joins: list[str] = []
        # set[str]: Tracks vertices already joined to prevent duplicates
        visited_vertices: set[str] = set()
        # str: The alias of the starting vertex
        anchor_vertex: str = ""

        # Processing the MOTIF segments to build the path logic
        for i, pattern in enumerate(patterns):
            # re.Match: Extract source vertex, edge alias, and destination vertex
            match: re.Match = re.search(r"\((\w+)\)-\[(\w+)\]->\((\w+)\)", pattern)
            if match:
                v_src_alias: str = match.group(1)
                e_alias: str = match.group(2)
                v_dst_alias: str = match.group(3)

                if i == 0:
                    anchor_vertex = v_src_alias
                    visited_vertices.add(v_src_alias)
                    path_array_elements.append(f"{e_alias}.{edge_src_id}")
                
                path_array_elements.append(f"{e_alias}.{edge_dst_id}")

                # Use the pre-filtered CTEs for JOINs
                path_joins.append(f"         JOIN cte_filtered_edge {e_alias} "
                                 f"ON {e_alias}.{edge_src_id} = {v_src_alias}.{vertex_id}")
                
                if v_dst_alias not in visited_vertices:
                    path_joins.append(f"         JOIN cte_filtered_vertex {v_dst_alias} "
                                     f"ON {v_dst_alias}.{vertex_id} = {e_alias}.{edge_dst_id}")
                    visited_vertices.add(v_dst_alias)

        # str: SQL snippets for array and path generation
        path_arr_str: str = f"ARRAY({', '.join(path_array_elements)})"
        edge_pairs: list[str] = [f"ARRAY(path[{j}], path[{j+1}])" for j in range(len(patterns))]
        edge_explode_str: str = f"ARRAY({', '.join(edge_pairs)})"
        
        # str: Prepare the WHERE clause with the specific filter_clause
        where_sql: str = f"         WHERE {filter_clause}" if filter_clause else ""

        # Constructing the Final SQL with CTEs for pre-filtering
        sql: str = "WITH\n"
        
        # CTE for filtered vertices
        v_filter_sql: str = f" WHERE ({global_filter_vertex})" if global_filter_vertex else ""
        sql += f"    cte_filtered_vertex AS (\n        SELECT * FROM {vertex_table}{v_filter_sql}\n    ),\n"
        
        # CTE for filtered edges
        e_filter_sql: str = f" WHERE ({global_filter_edge})" if global_filter_edge else ""
        sql += f"    cte_filtered_edge AS (\n        SELECT * FROM {edge_table}{e_filter_sql}\n    ),\n"
        
        # CTE for path discovery
        sql += "    cte_paths AS (\n"
        sql += f"         SELECT {path_arr_str} AS path\n"
        sql += f"         FROM cte_filtered_vertex {anchor_vertex}\n"
        sql += "\n".join(path_joins) + "\n"
        sql += f"{where_sql}\n"
        sql += f"         LIMIT {limit}\n"
        sql += "     ),\n"
        
        # CTEs for final JSON assembly
        sql += (
            f"     cte_vertices_ids AS (\n"
            f"         SELECT DISTINCT EXPLODE(path) AS {vertex_id}\n"
            f"         FROM cte_paths\n"
            f"     ),\n"
            f"     cte_vertices AS (\n"
            f"        SELECT ARRAY_AGG(STRUCT(t.*)) AS vertices\n"
            f"        FROM {vertex_table} t\n"
            f"        JOIN cte_vertices_ids v ON v.{vertex_id} = t.{vertex_id}\n"
            f"    ),\n"
            f"     cte_edges_ids AS (\n"
            f"         SELECT DISTINCT EXPLODE({edge_explode_str}) AS edge\n"
            f"         FROM cte_paths\n"
            f"     ),\n"
            f"     cte_edges AS (\n"
            f"        SELECT ARRAY_AGG(STRUCT(t.*)) AS edges\n"
            f"        FROM {edge_table} t\n"
            f"        JOIN cte_edges_ids e ON t.{edge_src_id} = e.edge[0] "
            f"AND t.{edge_dst_id} = e.edge[1]\n"
            f"    )\n"
            f"SELECT\n"
            f"    TO_JSON(\n"
            f"        STRUCT(\n"
            f"            vertices,\n"
            f"            edges\n"
            f"        )\n"
            f"    ) AS jsondata\n"
            f"FROM\n"
            f"    cte_vertices JOIN cte_edges"
        )

        return sql

    except Exception as e:
        logging.error(f"sql_graph_motif_find -> Error: {e}")
        raise e
    
# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

def sql_graph_all_paths(
    vertex_table: str,
    vertex_id: str,
    edge_table: str,
    edge_src_id: str,
    edge_dst_id: str,
    fromExpr: str,
    toExpr: str,
    max_distance: int = 4,
    edgeExpr: str = None,
    global_filter_vertex: str = None,
    global_filter_edge: str = None
) -> str:
    """
    Generates a Spark SQL query to find all paths between two sets of nodes 
    defined by expressions, returning the result in a JSON structure.

    Args:
        vertex_table (str): Name of the table containing vertex data.
        vertex_id (str): Column name for the vertex unique identifier.
        edge_table (str): Name of the table containing edge data.
        edge_src_id (str): Column name for source vertex in the edge table.
        edge_dst_id (str): Column name for destination vertex in the edge table.
        fromExpr (str): SQL expression to define the starting vertices.
        toExpr (str): SQL expression to define the target vertices.
        max_distance (int): Maximum number of hops allowed. Defaults to 4.
        edgeExpr (str, optional): Additional SQL filter for the edges.
        global_filter_vertex (str, optional): Global filter applied to all vertex selections.
        global_filter_edge (str, optional): Global filter applied to all edge selections.

    Returns:
        str: A complete Spark SQL query string.
    """
    logging.info("Calling sql_graph_all_paths")

    try:
        # str: Build global vertex filter clause if provided
        v_global: str = f"({global_filter_vertex}) AND " if global_filter_vertex else ""
        
        # str: Define selection for source vertices (fromExpr)
        v_from_sql: str = (f"SELECT {vertex_id} FROM {vertex_table} "
                          f"WHERE {v_global}{fromExpr}")
        
        # str: Define selection for target vertices (toExpr)
        v_to_sql: str = (f"SELECT {vertex_id} FROM {vertex_table} "
                        f"WHERE {v_global}{toExpr}")
        
        # list[str]: Combine global and specific edge filters
        edge_filters: list[str] = []
        if global_filter_edge:
            edge_filters.append(f"({global_filter_edge})")
        if edgeExpr:
            edge_filters.append(f"({edgeExpr})")
        
        # str: Build the final edge filter clause
        e_filter_clause: str = " WHERE " + " AND ".join(edge_filters) if edge_filters else ""
        e_expr_sql: str = (f"SELECT {edge_src_id}, {edge_dst_id} FROM {edge_table}"
                          f"{e_filter_clause}")
    
        # list[str]: Define columns for the path array (e.g., e1.src, e1.dst, e2.dst...)
        path_elements: list[str] = [f"e1.{edge_src_id}"] + \
                                   [f"e{i}.{edge_dst_id}" for i in range(1, max_distance + 1)]
        
        # str: SQL snippets for path construction and target verification
        path_array_str: str = f"ARRAY({', '.join(path_elements)})"
        path_array_test: str = f"ARRAY({', '.join(path_elements[1:])})"
    
        # list[str]: Build iterative LEFT JOINs to expand paths up to max_distance
        joins_list: list[str] = [f"        LEFT JOIN cte_edge_edgeExpr e1 "
                                f"ON e1.{edge_src_id} = vFrom.{vertex_id}"]
        
        for i in range(2, max_distance + 1):
            prev_alias: str = f"e{i-1}"
            curr_alias: str = f"e{i}"
            joins_list.append(f"        LEFT JOIN cte_edge_edgeExpr {curr_alias}\n"
                              f"        ON {curr_alias}.{edge_src_id} = {prev_alias}.{edge_dst_id}\n"
                              f"        AND {prev_alias}.{edge_dst_id} != vTo.{vertex_id}")
        
        # str: Combine all JOIN clauses into a single block
        joins_block: str = "\n".join(joins_list)
    
        # list[str]: Create array pairs for edge reconstruction (path[0], path[1], etc.)
        edge_pairs: list[str] = [f"ARRAY(path[{j}], path[{j+1}])" for j in range(max_distance)]
        explode_edges_str: str = f"ARRAY({', '.join(edge_pairs)})"
    
        # Construct the final SQL query using CTEs
        sql: str = "WITH\n"
        sql += f"    cte_vertex_fromExpr AS (\n        {v_from_sql}\n    ),\n"
        sql += f"    cte_vertex_toExpr AS (\n        {v_to_sql}\n    ),\n"
        sql += f"    cte_edge_edgeExpr AS (\n        {e_expr_sql}\n    ),\n"
        sql += f"    cte_paths AS (\n"
        sql += f"        SELECT {path_array_str} AS path\n"
        sql += f"        FROM cte_vertex_toExpr vTo\n"
        sql += f"        JOIN cte_vertex_fromExpr vFrom\n"
        sql += f"{joins_block}\n"
        sql += f"        WHERE ARRAY_CONTAINS({path_array_test}, vTo.{vertex_id})\n"
        sql += f"        AND SIZE(ARRAY_DISTINCT(ARRAY_COMPACT({path_array_test}))) = " \
               f"SIZE(ARRAY_COMPACT({path_array_test}))\n"
        sql += f"        LIMIT 1024\n"
        sql += "    ),\n"
        sql += "    cte_paths_edges AS (\n"
        sql += f"        SELECT DISTINCT EXPLODE({explode_edges_str}) AS edge\n"
        sql += "        FROM cte_paths\n"
        sql += "    ),\n"
        sql += "    cte_edges AS (\n"
        sql += f"        SELECT ARRAY_AGG(STRUCT(e.*)) AS edges\n"
        sql += f"        FROM {edge_table} e\n"
        sql += f"        JOIN cte_paths_edges sp ON sp.edge[0] = e.{edge_src_id} " \
               f"AND sp.edge[1] = e.{edge_dst_id}\n"
        sql += "    ),\n"
        sql += "    cte_vertices_ids AS (\n"
        sql += f"        SELECT DISTINCT EXPLODE(ARRAY(edge[0], edge[1])) AS {vertex_id}\n"
        sql += "        FROM cte_paths_edges\n"
        sql += "    ),\n"
        sql += "    cte_vertices AS (\n"
        sql += "        SELECT ARRAY_AGG(STRUCT(t.*)) AS vertices\n"
        sql += f"        FROM {vertex_table} t\n"
        sql += f"        JOIN cte_vertices_ids v ON v.{vertex_id} = t.{vertex_id}\n"
        sql += "    )\n"
        sql += "SELECT\n"
        sql += "    TO_JSON(\n"
        sql += "        STRUCT(\n            vertices,\n            edges\n        )\n"
        sql += "    ) AS jsondata\n"
        sql += "FROM\n    cte_vertices JOIN cte_edges"
    
        return sql

    except Exception as e:
        logging.error(f"sql_graph_all_paths -> Error: {e}")
        raise e

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

def sql_graph_shortest_path(
    vertex_table: str,
    vertex_id: str,
    edge_table: str,
    edge_src_id: str,
    edge_dst_id: str,
    fromExpr: str,
    toExpr: str,
    max_distance: int = 4,
    edgeExpr: str = None,
    global_filter_vertex: str = None,
    global_filter_edge: str = None
) -> str:
    """
    Generates a Spark SQL query to find the shortest path between nodes.
    The result is returned as a JSON containing aggregated vertices and edges.

    Args:
        vertex_table (str): Name of the vertex table.
        vertex_id (str): Primary key column of the vertex table.
        edge_table (str): Name of the edge table.
        edge_src_id (str): Source identifier column in the edge table.
        edge_dst_id (str): Destination identifier column in the edge table.
        fromExpr (str): Filter expression for the starting nodes.
        toExpr (str): Filter expression for the target nodes.
        max_distance (int): Maximum search depth (hops). Defaults to 4.
        edgeExpr (str, optional): Specific filter for edges.
        global_filter_vertex (str, optional): Global filter for all vertex selections.
        global_filter_edge (str, optional): Global filter for all edge selections.

    Returns:
        str: A formatted Spark SQL query string.
    """
    logging.info("Executing sql_graph_shortest_path")

    try:
        # str: Build the global vertex filter clause if applicable
        v_global: str = f"({global_filter_vertex}) AND " if global_filter_vertex else ""
        
        # str: CTE for source vertices applying global and specific filters
        v_from_sql: str = (f"SELECT {vertex_id} FROM {vertex_table} "
                          f"WHERE {v_global}{fromExpr}")
        
        # str: CTE for target vertices applying global and specific filters
        v_to_sql: str = (f"SELECT {vertex_id} FROM {vertex_table} "
                        f"WHERE {v_global}{toExpr}")
        
        # list[str]: Combine global and specific edge filters for the base edge CTE
        edge_filters: list[str] = []
        if global_filter_edge:
            edge_filters.append(f"({global_filter_edge})")
        if edgeExpr:
            edge_filters.append(f"({edgeExpr})")
        
        # str: Build final edge filter clause
        e_filter_clause: str = " WHERE " + " AND ".join(edge_filters) if edge_filters else ""
        e_expr_sql: str = (f"SELECT {edge_src_id}, {edge_dst_id} FROM {edge_table}"
                          f"{e_filter_clause}")
    
        # list[str]: Define column references for the path array construction
        path_elements: list[str] = [f"e1.{edge_src_id}"] + \
                                   [f"e{i}.{edge_dst_id}" for i in range(1, max_distance + 1)]
        
        # str: SQL strings for the full path array and the sub-array for target checking
        path_array_str: str = f"ARRAY({', '.join(path_elements)})"
        path_array_test: str = f"ARRAY({', '.join(path_elements[1:])})"
    
        # str: Build iterative LEFT JOINs with target-stop logic to prevent unnecessary expansion
        joins_list: list[str] = [f"            LEFT JOIN cte_edge_edgeExpr e1 "
                                f"ON e1.{edge_src_id} = vFrom.{vertex_id}"]
        for i in range(2, max_distance + 1):
            prev: str = f"e{i-1}"
            curr: str = f"e{i}"
            joins_list.append(f"            LEFT JOIN cte_edge_edgeExpr {curr} "
                              f"ON {curr}.{edge_src_id} = {prev}.{edge_dst_id} "
                              f"AND {prev}.{edge_dst_id} != vTo.{vertex_id}")
        
        # str: Combine all JOIN statements into a block
        joins_block: str = "\n".join(joins_list)
    
        # list[str]: Construct array pairs to identify individual edges within paths
        edge_pairs: list[str] = [f"ARRAY(path[{j}], path[{j+1}])" for j in range(max_distance)]
        explode_edges_str: str = f"ARRAY({', '.join(edge_pairs)})"
    
        # Final SQL Assembly using CTEs for clear execution flow
        sql: str = "WITH\n"
        sql += f"    cte_vertex_fromExpr AS (\n        {v_from_sql}\n    ),\n"
        sql += f"    cte_vertex_toExpr AS (\n        {v_to_sql}\n    ),\n"
        sql += f"    cte_edge_edgeExpr AS (\n        {e_expr_sql}\n    ),\n"
        sql += "    cte_paths AS (\n"
        sql += "        SELECT path, SIZE(ARRAY_COMPACT(path)) AS distance\n"
        sql += "        FROM (\n"
        sql += f"            SELECT {path_array_str} AS path\n"
        sql += "            FROM cte_vertex_toExpr vTo\n"
        sql += "            JOIN cte_vertex_fromExpr vFrom\n"
        sql += f"{joins_block}\n"
        sql += f"            WHERE ARRAY_CONTAINS({path_array_test}, vTo.{vertex_id})\n"
        sql += f"            AND SIZE(ARRAY_DISTINCT(ARRAY_COMPACT({path_array_test}))) = " \
               f"SIZE(ARRAY_COMPACT({path_array_test}))\n"
        sql += "        )\n"
        sql += "    ),\n"
        sql += "    cte_shortest_paths AS (\n"
        sql += "        SELECT path\n"
        sql += "        FROM (SELECT path, distance, DENSE_RANK() OVER (ORDER BY distance ASC) AS position FROM cte_paths)\n"
        sql += "        WHERE position = 1\n"
        sql += "        LIMIT 1024\n"
        sql += "    ),\n"
        sql += "    cte_shortest_paths_edges AS (\n"
        sql += f"        SELECT DISTINCT EXPLODE({explode_edges_str}) AS edge\n"
        sql += "        FROM cte_shortest_paths\n"
        sql += "    ),\n"
        sql += "    cte_edges AS (\n"
        sql += "        SELECT ARRAY_AGG(STRUCT(e.*)) AS edges\n"
        sql += f"        FROM {edge_table} e\n"
        sql += f"        JOIN cte_shortest_paths_edges sp ON sp.edge[0] = e.{edge_src_id} " \
               f"AND sp.edge[1] = e.{edge_dst_id}\n"
        sql += "    ),\n"
        sql += "    cte_vertices_ids AS (\n"
        sql += f"        SELECT DISTINCT EXPLODE(ARRAY(edge[0], edge[1])) AS {vertex_id}\n"
        sql += "        FROM cte_shortest_paths_edges\n"
        sql += "    ),\n"
        sql += "    cte_vertices AS (\n"
        sql += "        SELECT ARRAY_AGG(STRUCT(t.*)) AS vertices\n"
        sql += f"        FROM {vertex_table} t\n"
        sql += f"        JOIN cte_vertices_ids v ON v.{vertex_id} = t.{vertex_id}\n"
        sql += "    )\n"
        sql += "SELECT\n"
        sql += "    TO_JSON(\n"
        sql += "        STRUCT(\n            vertices,\n            edges\n        )\n"
        sql += "    ) AS jsondata\n"
        sql += "FROM\n    cte_vertices JOIN cte_edges"
    
        return sql

    except Exception as e:
        logging.error(f"sql_graph_shortest_path -> Error: {e}")
        raise e

# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

def sql_graph_vertex_triangulation(
    vertex_table: str,
    vertex_id: str,
    edge_table: str,
    edge_src_id: str,
    edge_dst_id: str,
    fromExpr: str,
    max_distance: int,
    edgeExpr: str = None,
    global_filter_vertex: str = None,
    global_filter_edge: str = None
) -> str:
    """
    Generates a SQL command for graph vertex triangulation (cycles starting and ending 
    at the same node) and returns the result as a JSON string.

    Args:
        vertex_table (str): Name of the table containing vertex data.
        vertex_id (str): Primary identifier column for vertices.
        edge_table (str): Name of the table containing edge/relationship data.
        edge_src_id (str): Column name for the source vertex in the edge table.
        edge_dst_id (str): Column name for the destination vertex in the edge table.
        fromExpr (str): SQL filter expression for the starting vertices.
        max_distance (int): Maximum number of hops for the triangulation path.
        edgeExpr (str, optional): SQL filter expression for edges.
        global_filter_vertex (str, optional): Global filter for all vertex selections.
        global_filter_edge (str, optional): Global filter for all edge selections.

    Returns:
        str: A formatted SQL query string returning JSON.
    """
    logging.info("call sql_graph_vertex_triangulation")

    try:
        # str: Build the global vertex filter clause if provided
        v_global: str = f"({global_filter_vertex}) AND " if global_filter_vertex else ""
        
        # str: Construct the source vertex filter including global constraints
        v_from_sql: str = f"SELECT {vertex_id} FROM {vertex_table} WHERE {v_global}({fromExpr})"
        
        # list[str]: Collect all edge filter conditions
        edge_conds: list[str] = []
        if global_filter_edge:
            edge_conds.append(f"({global_filter_edge})")
        if edgeExpr:
            edge_conds.append(f"({edgeExpr})")
            
        # str: Join edge conditions with AND for the base edge CTE
        e_filter_str: str = " WHERE " + " AND ".join(edge_conds) if edge_conds else ""
        e_expr_sql: str = f"SELECT {edge_src_id}, {edge_dst_id} FROM {edge_table}{e_filter_str}"

        # list[str]: Store JOIN clauses for iterative expansion
        joins_list: list[str] = []
        # list[str]: Track destination columns for the path array
        path_elements: list[str] = [f"e{i}.{edge_dst_id}" for i in range(1, max_distance + 1)]
        
        for i in range(2, max_distance + 1):
            prev_idx: int = i - 1
            # str: Build the JOIN logic with target-avoidance to ensure cycle is only at the end
            join_str: str = (
                f"LEFT JOIN cte_edge_edgeExpr e{i} "
                f"ON e{i}.{edge_src_id} = e{prev_idx}.{edge_dst_id} "
                f"AND e{prev_idx}.{edge_dst_id} != vFrom.{vertex_id}"
            )
            joins_list.append(join_str)

        # str: Format parts for the main path discovery query
        joins_sql: str = "\n                ".join(joins_list)
        path_array: str = f"ARRAY(e1.{edge_src_id}, {', '.join(path_elements)})"
        contains_array: str = f"ARRAY({', '.join(path_elements)})"

        # Final SQL assembly using concatenated strings to maintain indentation
        sql: str = "WITH\n"
        sql += f"    cte_vertex_fromExpr AS (\n        {v_from_sql}\n    ),\n"
        sql += f"    cte_edge_edgeExpr AS (\n        {e_expr_sql}\n    ),\n"
        sql += "    cte_paths AS (\n"
        sql += f"        SELECT path[0] as {vertex_id}, SIZE(ARRAY_COMPACT(path)) - 1 AS distance\n"
        sql += "        FROM\n"
        sql += "            (\n"
        sql += f"                SELECT {path_array} AS path\n"
        sql += "                FROM cte_vertex_fromExpr vFrom\n"
        sql += f"                LEFT JOIN cte_edge_edgeExpr e1 ON e1.{edge_src_id} = vFrom.{vertex_id}\n"
        sql += f"                {joins_sql}\n"
        sql += f"                WHERE ARRAY_CONTAINS({contains_array}, vFrom.{vertex_id})\n"
        sql += "            )\n"
        sql += "    ),\n"
        sql += "    cte_vertices_occurrences AS (\n"
        sql += f"        SELECT {vertex_id}, COUNT(*) AS occurrences, MAX(distance) AS max_distance \n"
        sql += "          FROM cte_paths \n"
        sql += f"         GROUP BY {vertex_id}\n"
        sql += "         LIMIT 1024\n"
        sql += "     ),\n"
        sql += "     cte_result_items AS (\n"
        sql += f"         SELECT ARRAY_AGG(STRUCT(vo.{vertex_id} as id, vo.occurrences, vo.max_distance, \n"
        sql += "                STRUCT(v.*) AS vertex)) AS vertices\n"
        sql += "          FROM cte_vertices_occurrences vo\n"
        sql += f"          JOIN {vertex_table} v ON v.{vertex_id} = vo.{vertex_id}\n"
        sql += "    )\n"
        sql += "SELECT\n"
        sql += "    TO_JSON(STRUCT(vertices AS triangulation)) AS jsondata\n"
        sql += "FROM\n"
        sql += "    cte_result_items"

        return sql

    except Exception as e:
        logging.error(f"sql_graph_vertex_triangulation -> Error: {e}")
        raise e
