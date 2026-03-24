"use strict";

import * as Utils from '../utils/utils.js';
import { motifFindTab } from './mainpage.motiffind.js';
import { pathsTab } from './mainpage.paths.js';
import { triangulationTab, showTriangulationTable } from './mainpage.triangulation.js';
import { showGraphForce } from './graphforce.js';


/**
 * Creates the initial state object for the graph visualization application.
 * This structure holds raw data, user selections, UI configurations, and file metadata.
 * 
 * @return {!Object} The initialized state hierarchy.
 */
const createInitialState = () => {
    // Return a deeply nested object representing the application baseline.
    return {
        /** @type {!Object} Raw datasets for vertices and edges. */
        Data: {
            catalog: undefined,

            // Tables containing the raw data rows
            vertices_table: undefined,
            vertices_statistics: undefined,

            // Tables containing relationship data
            edges_table: undefined,
            edges_statistics: undefined,

            // Filters applied to the source tables before visualization (e.g., SQL WHERE clauses)
            filters : {
                vertex: undefined,
                edge: undefined,
            }
        },

        /** @type {!Object} Current user selections and schema mapping. */
        Selected: {
            catalog: undefined,
            schema: undefined,
            vertices_table: undefined,
            edges_table: undefined,

            // Mapping for required vertex attributes
            vertex_fields: {
                id: undefined,
                label: undefined,
                type: undefined,
            },
            vertices_types: undefined,

            // Mapping for required edge (relationship) attributes
            edge_fields: {
                src: undefined,
                dst: undefined,
                type: undefined,
            },
            edges_types: undefined,

            /** @type {!Object} Visualization parameters for the D3 SVG canvas. */
            svg_settings: {
                width: 2400,
                height: 1800,
                vertex_size: 30,
                min_vertex_distance: 75,
            },
        },

        /** @type {!Object} Container for stored graph queries. */
        Queries: {},

        /** @type {!Object} Metadata about the currently loaded source file. */
        File: {
            name: undefined,
            lastModified: undefined,
        },
    };
};


/**
 * A collection of hex color codes used for styling graph elements.
 * Provides a variety of distinct colors for nodes, edges, and categories.
 * @const {!Array<string>}
 */
const CUSTOM_COLORS = [
    "#DF0000", "#009F00", "#0000FF", "#FF00FF", "#DFDF00", "#009F9F", "#808080", "#DD7539", "#6E654C",
    "#5F0000", "#004F00", "#00004F", "#5F005F", "#7F7F00", "#004F4F", "#3F3F3F", "#EB5406", "#483709",
];


/**
 * Bitwise or numeric constants representing the hierarchical levels of selections.
 * Used to track the current state of the navigation and data filtering.
 * @enum {number}
 */
const LEVEL = {
    // Top-level organization of datasets
    CATALOG: 1,
    // Database or logical grouping structure
    SCHEMA: 2,
    // Individual graph nodes
    VERTICES: 4,
    // Relationships between nodes
    EDGES: 8,
};


/**
 * The default prefix used for generated filenames when exporting graph data.
 * @const {string}
 * @private
 */
const _DEFAULT_FILENAME_PREFIX = "graph_notebook";


/**
 * Populates global filter dropdowns with vertex and edge columns and binds click events.
 * 
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @param {Object} context.Data Data object containing vertex and edge tables.
 * @returns {void}
 */
function fillGlobalColumnsFilters(context) {
    if (!context || !context.Data || !context.Data.vertices_table || !context.Data.edges_table) {
        return;
    }

    /**
     * Internal helper to generate list items from table columns.
     * @param {Object} table - The data table object.
     * @returns {jQuery[]} Array of jQuery <li> elements.
     */
    const generateColumnItems = (table) => {
        // Get the first entry of the table to extract column names.
        const firstKey = Object.keys(table)[0];
        const columns = table[firstKey] || {};
        
        return Object.values(columns).map(colName => {
            return $("<li>", {
                "type": "button",
                "class": "dropdown-item small"
            }).append(document.createTextNode(colName));
        });
    };

    // --- Process Vertex Columns ---
    const vertexItems = generateColumnItems(context.Data.vertices_table);
    $(".datasource-filter-vertex-column-tool").empty().append(vertexItems);

    // --- Process Edge Columns ---
    const edgeItems = generateColumnItems(context.Data.edges_table);
    $(".datasource-filter-edge-column-tool").empty().append(edgeItems);

    // --- Event Delegation & UI Interaction ---
    // Bind click events to the dynamically generated column options.
    const dropdownSelector = ".datasource-filter-vertex-column-tool li.dropdown-item, " + 
                             ".datasource-filter-edge-column-tool li.dropdown-item";

    $(dropdownSelector)
        .off("click")
        .on("click", function() {
            const $this = $(this);
            const columnName = $this.text();
            
            // Find the associated input field within the same input group.
            const filterInput = $this.closest(".input-group").find("input")[0];
            if (filterInput) {
                // Insert column name at the current cursor position using native DOM API.
                filterInput.setRangeText(columnName, filterInput.selectionStart, filterInput.selectionEnd,  "end");
                filterInput.focus();
            }
        });
}




/** ********************************************************************************
 * Save JSON data to a file using the File System Access API
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @param {!object} jsonData JSON data to save
 * @returns {void}
 * ********************************************************************************/
async function fileSaveJSON(context, jsonData) {
    // Immediate return if the application context is undefined.
    if (!context || !jsonData) {
        return;
    }

    // Define default file name if not already defined
    if (context.File.name == undefined) {
        // Generate the timestamp: YYYYMMDDHHMMSS
        const now = new Date();
        const timestamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'), // Months are 0-indexed
            String(now.getDate()).padStart(2, '0'),
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0')
        ].join('');

        context.File.name = `${_DEFAULT_FILENAME_PREFIX}_${timestamp}.json`;
    }

    // Define file save options
    const options = {
        startIn: 'downloads', // Suggest starting in the Downloads folder
        suggestedName: context.File.name, // Set your desired file name here
        types: [{
            description: "JSON Files",
            accept: { "application/json": [".json"] },
        }],
    };

    // Show the save file picker
    try {
        const handle = await window.showSaveFilePicker(options);

        const fileName = handle.name;
        context.File.name = fileName;
        context.File.lastModified = Date.now();

        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(jsonData, (key, value) => { return (value === undefined) ? null : value }, 2));
        await writable.close();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('User cancelled the file save operation.');
        } else {
            console.error('Error saving file:', error);
        }
    }

    // Hide all tooltips
    $(".tooltip").hide();
}


/** ********************************************************************************
 * Read JSON data from a file using the File System Access API
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @returns {object} - parsed JSON data
 * ********************************************************************************/
async function fileReadJSON(context) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context.File) {
        return;
    }

    try {
        // Open the file picker with a filter for JSON files
        const [fileHandle] = await window.showOpenFilePicker({
            startIn: 'downloads', // Suggest starting in the Downloads folder
            suggestedName: `${_DEFAULT_FILENAME_PREFIX}_*.json`, // Set your desired file name here
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }],
            multiple: false
        });

        // Get the actual File object from the handle
        const file = await fileHandle.getFile();

        // Read the file content as text
        const contents = await file.text();

        // Store file metadata
        context.File.name = file.name;
        context.File.lastModified = file.lastModified;

        // Parse and return the JSON data
        const jsonData = JSON.parse(contents, (key, value) => { return (value === null) ? undefined : value });
        return jsonData;

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('User cancelled the file selection.');
        } else {
            console.error('Error reading file:', error);
        }
    }
}


/**
 * Clears application settings selections based on a specified level bitmask.
 *
 * This function resets the internal state of the context object and cleans up
 * the associated UI elements (DOM, event listeners, and CSS classes) for 
 * catalogs, schemas, vertices, and edges.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @param {number=} clearLevel Bitmask indicating which levels to clear:
 *     1 (LEVEL.CATALOG) - Clear catalog and all dependent levels.
 *     2 (LEVEL.SCHEMA)  - Clear schema and its dependent levels.
 *     4 (LEVEL.VERTICES)- Clear vertex-specific settings.
 *     8 (LEVEL.EDGES)   - Clear edge-specific settings.
 * @return {void}
 */
function clearSettingsSelections(context, clearLevel = 0) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context.Selected) {
        return;
    }
    
    // Normalize clearLevel to a valid integer and apply bitwise AND with allowed levels.
    clearLevel = (isNaN(clearLevel) ? 0 : parseInt(clearLevel)) & 
                 (LEVEL.CATALOG | LEVEL.SCHEMA | LEVEL.VERTICES | LEVEL.EDGES);

    // --- Catalog Level Reset ---
    if (clearLevel & LEVEL.CATALOG) {
        context.Selected.catalog = undefined;
        
        // Reset dependent tables and input fields.
        $("#schemaTable, #verticesTable, #edgesTable, #vertexId, #vertexLabel, " +
          "#vertexType, #edgeSrc, #edgeDst, #edgeType")
            .empty()
            .off("change")
            .removeClass("border-danger");

        // Disable action buttons and revert to secondary styling.
        $("#btnApplyVerticesEdgesColumnsSettings, #btnApplyVerticesEdgesTypesSettings")
            .removeClass("btn-primary")
            .addClass("btn-secondary opacity-50 blocked-click")
            .off("click");

        // Hide configuration groups.
        $("#groupColumnsSettings, #groupIconsColorsVerticesEdges").hide();
    }

    // --- Schema Level Reset ---
    if (clearLevel & (LEVEL.CATALOG | LEVEL.SCHEMA)) {
        context.Selected.schema = undefined;
        
        // Clear schema-dependent UI components.
        $("#verticesTable, #edgesTable, #vertexId, #vertexLabel, #vertexType, " +
          "#edgeSrc, #edgeDst, #edgeType")
            .empty()
            .off("change")
            .removeClass("border-danger");

        $("#btnApplyVerticesEdgesColumnsSettings, #btnApplyVerticesEdgesTypesSettings")
            .removeClass("btn-primary")
            .addClass("btn-secondary opacity-50 blocked-click")
            .off("click");

        $("#groupColumnsSettings, #groupIconsColorsVerticesEdges").hide();
    }

    // --- Vertices Level Reset ---
    if (clearLevel & (LEVEL.CATALOG | LEVEL.SCHEMA | LEVEL.VERTICES)) {
        // Reset vertex state and mapping fields.
        context.Selected.vertices_table = undefined;
        context.Selected.vertex_fields = {
            id: undefined,
            label: undefined,
            type: undefined,
        };
        context.Selected.vertices_types = undefined;

        // Clear vertex-specific UI inputs.
        $("#vertexId, #vertexLabel, #vertexType")
            .empty()
            .off("change")
            .removeClass("border-danger");

        $("#btnApplyVerticesEdgesTypesSettings")
            .removeClass("btn-primary")
            .addClass("btn-secondary opacity-50 blocked-click")
            .off("click");

        $("#groupIconsColorsVerticesEdges").hide();
    }

    // --- Edges Level Reset ---
    if (clearLevel & (LEVEL.CATALOG | LEVEL.SCHEMA | LEVEL.EDGES)) {
        // Reset edge state and mapping fields.
        context.Selected.edges_table = undefined;
        context.Selected.edge_fields = {
            src: undefined,
            dst: undefined,
            type: undefined,
        };
        context.Selected.edges_types = undefined;

        // Clear edge-specific UI inputs.
        $("#edgeSrc, #edgeDst, #edgeType")
            .empty()
            .off("change")
            .removeClass("border-danger");

        $("#btnApplyVerticesEdgesTypesSettings")
            .removeClass("btn-primary")
            .addClass("btn-secondary opacity-50 blocked-click")
            .off("click");

        $("#groupIconsColorsVerticesEdges").hide();
    }
}


/**
 * Configures application settings and UI event listeners based on a bitmask.
 *
 * This function synchronizes the application context with UI selections (DOM values),
 * populates dependent dropdown menus (cascading selects), and manages the lifecycle 
 * of change events for catalogs, schemas, vertices, and edges.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @param {number=} setLevel Bitmask indicating which levels to process:
 *     1 (LEVEL.CATALOG)  - Process catalog selection and update schemas.
 *     2 (LEVEL.SCHEMA)   - Process schema selection and update tables.
 *     4 (LEVEL.VERTICES) - Process vertex table selection.
 *     8 (LEVEL.EDGES)    - Process edge table selection.
 * @return {void}
 */
function setEventsSettingsSelections(context, setLevel = 0) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context.Data || !context.Selected) {
        return;
    }

    // Normalize and validate the bitmask against allowed levels.
    setLevel = (isNaN(setLevel) ? 0 : parseInt(setLevel)) & 
               (LEVEL.CATALOG | LEVEL.SCHEMA | LEVEL.VERTICES | LEVEL.EDGES);

    // --- Catalog Level Selection ---
    if (setLevel & LEVEL.CATALOG) {
        try {
            const currentCatalogVal = $("#catalogTable").val() || undefined;
            
            // Only trigger update if the selected catalog has changed.
            if (context.Selected.catalog !== currentCatalogVal) {
                context.Selected.catalog = currentCatalogVal;

                if (context.Selected.catalog) {
                    const catalog = context.Data.catalog[context.Selected.catalog];
                    if (catalog) {
                        // Populate the schema dropdown with keys from the catalog object.
                        const opSchemas = [$("<option>", {"value": ""}).append(document.createTextNode(""))];
                        Object.keys(catalog).forEach(key => {
                            opSchemas.push($("<option>", {"value": key}).append(document.createTextNode(key)));
                        });

                        $("#schemaTable").empty().append(opSchemas);
                        clearSettingsSelections(context, LEVEL.SCHEMA);

                        // Re-bind change event to trigger schema-level processing.
                        $("#schemaTable")
                            .off("change")
                            .on("change", function() { setEventsSettingsSelections(context, LEVEL.SCHEMA); })
                            .trigger("change");
                    }
                } else {
                    // If catalog is deselected, clear all dependent levels.
                    clearSettingsSelections(context, LEVEL.CATALOG);
                    return;
                }
            }            
        } catch (error) {
            // clear all dependent levels.
            clearSettingsSelections(context, LEVEL.CATALOG);
            return;
        }
    }

    // --- Schema Level Selection ---
    if (setLevel & (LEVEL.CATALOG | LEVEL.SCHEMA)) {
        try {
            const rawSchemaVal = $("#schemaTable").val() || undefined;
            
            if (context.Selected.schema !== rawSchemaVal) {
                // Build fully qualified schema name (Catalog.Schema).
                context.Selected.schema = (context.Selected.catalog && rawSchemaVal) ? 
                    `${context.Selected.catalog}.${rawSchemaVal}` : undefined;

                if (context.Selected.schema) {
                    const schemaKey = context.Selected.schema.split(".").pop();
                    const schema = context.Data.catalog[context.Selected.catalog][schemaKey];
                    
                    if (schema) {
                        // Prepare table options for both vertices and edges dropdowns.
                        const opTables = [$("<option>", {"value": ""}).append(document.createTextNode(""))];
                        schema.forEach(tbl => {
                            opTables.push($("<option>", {"value": tbl}).append(document.createTextNode(tbl)));
                        });

                        // Populate vertex and edge selects using clones of the options array.
                        $("#verticesTable").empty().append(opTables.map(x => x.clone()));
                        $("#edgesTable").empty().append(opTables.map(x => x.clone()));

                        clearSettingsSelections(context, LEVEL.VERTICES | LEVEL.EDGES);

                        // Re-bind change events for table-level processing.
                        $("#verticesTable")
                            .off("change")
                            .on("change", function() { setEventsSettingsSelections(context, LEVEL.VERTICES); })
                            .trigger("change");
                            
                        $("#edgesTable")
                            .off("change")
                            .on("change", function() { setEventsSettingsSelections(context, LEVEL.EDGES); })
                            .trigger("change");
                    }
                } else {
                    // clear all dependent levels.
                    clearSettingsSelections(context, LEVEL.SCHEMA);
                    return;
                }
            }            
        } catch (error) {
            //clear all dependent levels.
            clearSettingsSelections(context, LEVEL.SCHEMA);
            return;
        }
    }

    // --- Vertices Level Selection ---
    if (setLevel & (LEVEL.CATALOG | LEVEL.SCHEMA | LEVEL.VERTICES)) {
        context.Selected.vertices_table = undefined;
        context.Selected.vertex_fields = { id: undefined, label: undefined, type: undefined };

        clearSettingsSelections(context, LEVEL.VERTICES);

        const vTableVal = $("#verticesTable").val();
        if (context.Selected.catalog && context.Selected.schema && vTableVal) {
            // Store the fully qualified table name.
            context.Selected.vertices_table = `${context.Selected.schema}.${vTableVal}`;
        }
    }

    // --- Edges Level Selection ---
    if (setLevel & (LEVEL.CATALOG | LEVEL.SCHEMA | LEVEL.EDGES)) {
        context.Selected.edges_table = undefined;
        context.Selected.edge_fields = { src: undefined, dst: undefined, type: undefined };

        clearSettingsSelections(context, LEVEL.EDGES);

        const eTableVal = $("#edgesTable").val();
        if (context.Selected.catalog && context.Selected.schema && eTableVal) {
            // Store the fully qualified table name.
            context.Selected.edges_table = `${context.Selected.schema}.${eTableVal}`;
        }
    }

    // --- Global UI Reset for Columns and Buttons ---
    if (setLevel) {
        // Reset column-specific inputs and disable action buttons.
        $("#vertexId, #vertexLabel, #vertexType, #edgeSrc, #edgeDst, #edgeType")
            .empty()
            .off("change")
            .removeClass("border-danger");

        $("#btnApplyVerticesEdgesColumnsSettings, #btnApplyVerticesEdgesTypesSettings")
            .removeClass("btn-primary")
            .addClass("btn-secondary opacity-50 blocked-click")
            .off("click");

        $("#groupColumnsSettings, #groupIconsColorsVerticesEdges").hide();
    }
}


/**
 * Populates the catalog dropdown and restores previous selections.
 *
 * This function initializes the catalog selection UI, binds change events 
 * for cascading updates, and attempts to restore a deep-nested selection 
 * state (catalog > schema > tables) if the current context contains 
 * valid previous data.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @return {void}
 */
function fillSettingsCatalog(context) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context.Data || !context.Selected) {
        return;
    }

    // Prepare the list of catalog options for the dropdown.
    const opCatalogs = [$("<option>", {"value": ""}).append(document.createTextNode(""))];
    
    Object.keys(context.Data.catalog).forEach(key => {
        opCatalogs.push($("<option>", {"value": key}).append(document.createTextNode(key)));
    });

    // Update the DOM and reset dependent selection levels.
    $("#catalogTable").empty().append(opCatalogs);
    clearSettingsSelections(context, LEVEL.CATALOG);

    // Deep validation to restore previous session state if data is still valid.
    const hasValidCatalog = context.Selected.catalog && 
                            context.Data.catalog[context.Selected.catalog];
    
    if (hasValidCatalog) {
        const schemaKey = context.Selected.schema?.split(".").pop();
        const hasValidSchema = schemaKey && context.Data.catalog[context.Selected.catalog][schemaKey];

        if (hasValidSchema) {
            const tables = context.Data.catalog[context.Selected.catalog][schemaKey];
            const vTableKey = context.Selected.vertices_table?.split(".").pop();
            const eTableKey = context.Selected.edges_table?.split(".").pop();

            // Verify if both vertex and edge tables exist in the current schema.
            if (tables.includes(vTableKey) && tables.includes(eTableKey)) {
                setEventsSettingsSelections(context, LEVEL.CATALOG);
                $("#catalogTable").val(context.Selected.catalog).trigger("change");
            }
        }
    }

    // Bind the change event to handle cascading updates when a catalog is selected.
    $("#catalogTable")
        .off("change")
        .on("change", function() { 
            setEventsSettingsSelections(context, LEVEL.CATALOG); 
        })
        .trigger("change");

    // Initialize action buttons for table metadata loading.
    $("#btnGetTableDetails")
        .off("click")
        .on("click", function() { 
            loadTablesColumnsVeticesEdges(context); 
        });

    // Reset settings buttons to a disabled/neutral state.
    $("#btnApplyVerticesEdgesColumnsSettings, #btnApplyVerticesEdgesTypesSettings")
        .removeClass("btn-primary")
        .addClass("btn-secondary opacity-50 blocked-click")
        .off("click");
}


/**
 * Populates column selection dropdowns for both vertex and edge tables.
 *
 * This function extracts metadata (column names) from the loaded tables,
 * generates option elements, and binds change listeners to synchronize 
 * the selected mapping fields with the application context.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @return {void}
 */
function fillSettingsColumnsVerticesEdges(context) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context?.Data.vertices_table || !context?.Data.edges_table || !context.Selected) {
        return;
    }

    // Extract column arrays from the first key of each table metadata object.
    const vertices_cols = context.Data.vertices_table[Object.keys(context.Data.vertices_table)[0]];
    const edges_cols = context.Data.edges_table[Object.keys(context.Data.edges_table)[0]];

    // Iterate through vertex and edge column sets to populate respective selects.
    [vertices_cols, edges_cols].forEach((cols, idx_group) => {
        // Define target element IDs based on the current group index (0: Vertex, 1: Edge).
        const selects = (idx_group === 0) ? 
            ["vertexId", "vertexLabel", "vertexType"] : 
            ["edgeSrc", "edgeDst", "edgeType"];

        // Create a reusable array of option elements including an initial empty state.
        const opColumns = [$("<option>", {"value": ""}).append(document.createTextNode(""))];
        
        cols.forEach((col) => {
            opColumns.push($("<option>", {"value": col}).append(document.createTextNode(col)));
        });

        // Batch update all dropdowns in the group using cloned options to maintain DOM integrity.
        selects.forEach(id => {
            $(`#${id}`).empty().append(opColumns.map(x => x.clone()));
        });
    });

    // --- Vertex Mapping Events ---
    // Bind listeners to update context and reset dependent UI sections on change.
    $("#vertexId")
        .off("change")
        .on("change", function() { 
            context.Selected.vertex_fields.id = $(this).val() || undefined; 
            $("#groupIconsColorsVerticesEdges").hide(); 
        })
        .trigger("change");

    $("#vertexLabel")
        .off("change")
        .on("change", function() { 
            context.Selected.vertex_fields.label = $(this).val() || undefined; 
            $("#groupIconsColorsVerticesEdges").hide(); 
        })
        .trigger("change");

    $("#vertexType")
        .off("change")
        .on("change", function() { 
            context.Selected.vertex_fields.type = $(this).val() || undefined; 
            $("#groupIconsColorsVerticesEdges").hide(); 
        })
        .trigger("change");

    // --- Edge Mapping Events ---
    $("#edgeSrc")
        .off("change")
        .on("change", function() { 
            context.Selected.edge_fields.src = $(this).val() || undefined; 
            $("#groupIconsColorsVerticesEdges").hide(); 
        })
        .trigger("change");

    $("#edgeDst")
        .off("change")
        .on("change", function() { 
            context.Selected.edge_fields.dst = $(this).val() || undefined; 
            $("#groupIconsColorsVerticesEdges").hide(); 
        })
        .trigger("change");

    $("#edgeType")
        .off("change")
        .on("change", function() { 
            context.Selected.edge_fields.type = $(this).val() || undefined; 
            $("#groupIconsColorsVerticesEdges").hide(); 
        })
        .trigger("change");

    // --- Action Button Configuration ---
    // Enable the 'Apply' button and bind it to trigger the next configuration step (Types/Icons).
    $("#btnApplyVerticesEdgesColumnsSettings")
        .removeClass("btn-secondary opacity-50 blocked-click")
        .addClass("btn-primary")
        .off("click")
        .on("click", function() {
            loadTypesVeticesEdges(context);
            $("#groupColumnsSettings").show();
        });

    // Reveal the column settings container once initialization is complete.
    $("#groupColumnsSettings").show();
}


/**
 * Configures visual properties (icons and colors) for vertex and edge types.
 *
 * This function initializes default styles for graph elements using automated 
 * matching (FontAwesome), generates dynamic UI rows for manual adjustments, 
 * initializes Select2 components for icon picking, and binds the final 
 * application logic for SVG and graph settings.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @return {void}
 */
function fillSettingsTypesVerticesEdges(context) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context?.Data.vertices_statistics || !context?.Data.edges_statistics) {
        return;
    }

    // Get Font Awesome icons
    const fontAwesomeIcons = Utils.fontAwesomeIconNames();

    // --- Automatic Vertex Type Initialization ---
    if (!context.Selected.vertices_types) {
        context.Selected.vertices_types = {};
        Object.keys(context.Data.vertices_statistics).forEach((key_vertex, index) => {
            // Attempt to find a matching icon based on the first letter of the type.
            const ico = fontAwesomeIcons.find(icon => 
                icon.uiText.toLowerCase().startsWith(key_vertex[0].toLowerCase())
            );
            
            context.Selected.vertices_types[key_vertex] = {
                "icon": (ico ? `${ico.prefix} fa-${ico.iconName}` : null),
                "color": CUSTOM_COLORS[index % CUSTOM_COLORS.length],
            };
        });
    }

    // --- Automatic Edge Type Initialization ---
    if (!context.Selected.edges_types) {
        context.Selected.edges_types = {};
        Object.keys(context.Data.edges_statistics).forEach((key_edge, index) => {
            context.Selected.edges_types[key_edge] = {
                "color": "#808080" // Default gray color for edges
            };
        });
    }

    // --- FontAwesome Option Generation ---
    const optionsHtmlAwesomeFont = [$("<option>", {"value": null, "data-icon": null}).append("")];
    
    fontAwesomeIcons.forEach(icon => {
        const fullIconClass = `${icon.prefix} fa-${icon.iconName}`;
        optionsHtmlAwesomeFont.push(
            $("<option>", {
                "value": fullIconClass, 
                "data-icon": `${fullIconClass} fa-2xl`
            }).append(document.createTextNode(icon.uiText))
        );
    });

    // --- Vertex UI Component Generation ---
    const jq_vertex_types = [];
    Object.keys(context.Data.vertices_statistics).forEach((key, index) => {
        const typeLabel = (key === "_" ? "( Type Not Defined )" : key);
        const jq_vertex = $("<div>", {"class": "row mb-5 vertex-type", "data-key": key})
            .append(
                $("<div>", {"class": "pt-2 col-3"})
                    .append($("<span>").append(document.createTextNode(`4.${index + 1}. ${typeLabel}`))),
                $("<div>", {"class": "col-auto"})
                    .append(
                        $("<div>", {"class": "d-flex"})
                            .append(
                                $("<div>", {"class": "border border-dark-subtle rounded p-1 me-3", "style": "min-height:44px;"})
                                    .append(
                                        $("<select>", {"class": "form-select m-0 p-0 border-0 select2-ctrl vertex-select2-ctrl", "style": "width:360px;"})
                                            .append(optionsHtmlAwesomeFont.map(x => x.clone()))
                                            .val(context.Selected.vertices_types[key]?.icon || null)
                                    ),
                                $("<input>", {
                                    "type": "color",
                                    "class": "m-0 p-0 cursor-hand border-0 rounded-circle vertex-input-color", 
                                    "style": "width:40px;height:40px;", 
                                    "title": "Choose your color"
                                }).val(context.Selected.vertices_types[key].color)
                            ),
                        $("<span>", {
                            "class": "fw-lighter fst-italic text-secondary small", 
                            "id": `vertex-items-${Utils.fastHash(key)}`
                        }).append(document.createTextNode(`Number of Items: ${Utils.formatWithSpace(context.Data.vertices_statistics[key])}`))
                    )
            );
        jq_vertex_types.push(jq_vertex);
    });
    $("#verticeTypesSettings").empty().append(jq_vertex_types);

    // Helper function for Select2 to render FontAwesome icons within the dropdown.
    const __formatIcon = function(state) {
        if (!state.id) return state.text;
        const iconClass = $(state.element).data('icon');
        return $(`<span><i class="${iconClass}"></i> ${state.text}</span>`);
    };

    // Initialize Select2 with Bootstrap 5 theme and custom icon templates.
    $(".select2-ctrl").select2({
        theme: "bootstrap-5",             // Use Bootstrap 5 theme
        minimumResultsForSearch: 0,       // Show search box only if there are more than 0 results
        templateResult: __formatIcon,     // Styles the options in the dropdown
        templateSelection: __formatIcon,  // Required if returning strings instead of jQuery objects
        escapeMarkup: (m) => m
    });

    // --- Edge UI Component Generation ---
    const jq_edge_types = [];
    Object.keys(context.Data.edges_statistics).forEach((key, index) => {
        const typeLabel = (key === "_" ? "( Type Not Defined )" : key);
        const jq_edge = $("<div>", {"class": "row mb-5 edge-type", "data-key": key})
            .append(
                $("<div>", {"class": "pt-2 col-3"})
                    .append($("<span>").append(document.createTextNode(`5.${index + 1}. ${typeLabel}`))),
                $("<div>", {"class": "col-auto"})
                    .append(
                        $("<div>", {"class": "row", "style": "min-width:200px"})
                            .append(
                                $("<input>", {
                                    "type": "color",
                                    "class": "m-0 p-0 me-2 mt-2 cursor-hand border-0 rounded-pill edge-input-color", 
                                    "title": "Choose your color"
                                }).val(context.Selected.edges_types[key]?.color)
                            ),
                        $("<div>", {"class": "row", "style": "min-width:200px"})
                            .append(
                                $("<span>", {
                                    "class": "fw-lighter fst-italic text-secondary small m-0 p-0", 
                                    "id": `edge-items-${Utils.fastHash(key)}`
                                }).append(document.createTextNode(`Number of Items: ${Utils.formatWithSpace(context.Data.edges_statistics[key])}`))
                            )
                    )
            );
        jq_edge_types.push(jq_edge);
    });
    $("#edgeTypesSettings").empty().append(jq_edge_types);

    // --- Final Settings Application Event ---
    $("#btnApplyVerticesEdgesTypesSettings")
        .removeClass("btn-secondary opacity-50 blocked-click")
        .addClass("btn-primary")
        .off("click")
        .on("click", function() {
            // Save modified vertex icons and colors.
            context.Selected.vertices_types = {...context.Selected.vertices_types};
            Object.keys(context.Data.vertices_statistics).forEach(key => {
                const container = $(`.vertex-type[data-key='${key}']`);
                context.Selected.vertices_types[key] = {
                    "icon": container.find(".vertex-select2-ctrl").val(),
                    "color": container.find(".vertex-input-color").val()
                };
            });

            // Save modified edge colors.
            context.Selected.edges_types = {...context.Selected.edges_types};
            Object.keys(context.Data.edges_statistics).forEach(key => {
                const container = $(`.edge-type[data-key='${key}']`);
                context.Selected.edges_types[key] = {
                    "color": container.find(".edge-input-color").val()
                };
            });

            // Filters on Source Tables
            if (context.Data.hasOwnProperty("filters") === false) {
                context.Data.filters = {
                    vertex: undefined,
                    edge: undefined
                };
            }
            context.Data.filters.vertex = $(`#datasource-filter-vertex`).val() || undefined;
            context.Data.filters.edge = $(`#datasource-filter-edge`).val() || undefined;

            // Persist SVG physical parameters from inputs.
            const settings = context.Selected.svg_settings;
            settings.width = parseInt($("#svgWidth").val()) || 2400;
            settings.height = parseInt($("#svgHeight").val()) || 1800;
            settings.vertex_size = parseInt($("#svgVertexSize").val()) || 30;
            settings.min_vertex_distance = parseInt($("#svgMinVertexDistance").val()) || 75;

            // Feedback: Refresh input values to show defaults if invalid data was entered.
            $("#svgWidth").val(settings.width);
            $("#svgHeight").val(settings.height);
            $("#svgVertexSize").val(settings.vertex_size);
            $("#svgMinVertexDistance").val(settings.min_vertex_distance);

            // Open a new query tab if none exists.
            if ($(".nav.nav-tabs li").length === 1) {
                motifFindTab(context);
            }
        });

    // Reveal the final settings container.
    $("#groupIconsColorsVerticesEdges").show();
}


/**
 * Fetches the database catalog metadata from the server and initializes the UI.
 *
 * This function handles the asynchronous retrieval of catalog data. It manages 
 * the UI state by disabling navigation links and showing loading indicators 
 * during the request. Upon success, it persists the data to the context and 
 * triggers the catalog population.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @return {void}
 */
function loadCatalog(context) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context.Data) {
        return;
    }

    // Disable navigation links to prevent user interaction during the AJAX call.
    $(".nav-link").addClass("disabled");

    // Clear error styling from all configuration selects.
    $("#catalogTable, #schemaTable, #verticesTable, #edgesTable, #vertexId, " +
      "#vertexLabel, #vertexType, #edgeSrc, #edgeDst, #edgeType")
        .removeClass("border-danger");

    // Clean up previous event listeners for action buttons to avoid duplicates.
    $("#btnGetTableDetails, #btnApplyVerticesEdgesColumnsSettings, " +
      "#btnApplyVerticesEdgesTypesSettings").off("click");

    // Display the loading alert to the user.
    $(".alert-message").removeClass("text-danger").addClass("text-secondary");
    $(".alert-message-border").removeClass("border-danger bg-danger-subtle").addClass("border-secondary bg-secondary-subtle");
    $(".alert-message").text("Wait, loading data...");
    $(".alert-message, .alert-message-border").removeClass("d-none");

    // Perform the asynchronous GET request to the catalogs API.
    $.ajax({
        type: "GET",
        url: `./api/catalogs/`,
        contentType: "application/x-www-form-urlencoded; charset=utf-8",
        success: function(result) {
            // Hide the loading alert on successful response.
            $(".alert-message, .alert-message-border").addClass("d-none");

            // Validate the result returned by the API.
            if (!result) {
                $(".alert-message").removeClass("text-secondary").addClass("text-danger");
                $(".alert-message-border").removeClass("border-secondary bg-secondary-subtle").addClass("border-danger bg-danger-subtle");
                $(".alert-message").text("Error loading data, please try again.");
                $(".alert-message, .alert-message-border").removeClass("d-none");
                context.Data.catalog = undefined;
                return;
            }

            // Persist the data and trigger the UI population.
            context.Data.catalog = result;
            fillSettingsCatalog(context);
        },
        error: function(xhr, status, error) {
            // Inform the user about the failure.
            $(".alert-message").removeClass("text-secondary").addClass("text-danger");
            $(".alert-message-border").removeClass("border-secondary bg-secondary-subtle").addClass("border-danger bg-danger-subtle");
            $(".alert-message").text("Error: Could not load data catalog.");
            $(".alert-message, .alert-message-border").removeClass("d-none");
        },
        complete: function() {
            // Restore navigation links functionality regardless of the request outcome.
            $(".nav-link").removeClass("disabled");
        }
    });
}


/**
 * Fetches column metadata for the selected vertex and edge tables via AJAX.
 *
 * This function validates that a unique catalog, schema, and distinct tables 
 * for vertices and edges have been selected. It manages the UI state by 
 * highlighting missing fields, displaying loading indicators, and 
 * orchestrating the population of column-mapping dropdowns upon success.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @return {void}
 */
function loadTablesColumnsVeticesEdges(context) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context.Data || !context.Selected) {
        return;
    }

    // Reset UI state: remove error highlighting and clear previous column data.
    $("#catalogTable, #schemaTable, #verticesTable, #edgesTable, #vertexId, " + 
      "#vertexLabel, #vertexType, #edgeSrc, #edgeDst, #edgeType")
        .removeClass("border-danger");

    $("#vertexId, #vertexLabel, #vertexType, #edgeSrc, #edgeDst, #edgeType")
        .empty()
        .off("change");

    // Disable action buttons and hide dependent configuration groups.
    $("#btnApplyVerticesEdgesColumnsSettings, #btnApplyVerticesEdgesTypesSettings")
        .removeClass("btn-primary")
        .addClass("btn-secondary opacity-50 blocked-click")
        .off("click");

    $("#groupColumnsSettings, #groupIconsColorsVerticesEdges").hide();

    // --- Selection Validation ---
    const selected = context.Selected;
    const isValidSelection = selected.catalog && 
                             selected.schema && 
                             selected.vertices_table && 
                             selected.edges_table && 
                             (selected.vertices_table !== selected.edges_table);

    const tableList = [];
    if (isValidSelection) {
        tableList.push(selected.vertices_table);
        tableList.push(selected.edges_table);
    } else {
        // Highlight missing or invalid (duplicate) selections to the user.
        if (!selected.catalog) $("#catalogTable").addClass("border-danger");
        if (!selected.schema) $("#schemaTable").addClass("border-danger");
        if (!selected.vertices_table) $("#verticesTable").addClass("border-danger");
        if (!selected.edges_table) $("#edgesTable").addClass("border-danger");
        
        // Handle the specific case where vertex and edge tables are the same.
        if (selected.vertices_table && 
            selected.edges_table && 
            (selected.vertices_table === selected.edges_table)) {
            $("#verticesTable, #edgesTable").addClass("border-danger");
        }
        return;
    }

    // Display loading feedback.
    $(".alert-message").removeClass("text-danger").addClass("text-secondary");
    $(".alert-message-border").removeClass("border-danger bg-danger-subtle").addClass("border-secondary bg-secondary-subtle");
    $(".alert-message").text("Wait, loading data...");
    $(".alert-message, .alert-message-border").removeClass("d-none");

    $("#btnGetTableDetails").prop("disabled", true);

    // Execute the asynchronous request to fetch column definitions.
    $.ajax({
        type: "GET",
        url: `./api/columns/`,
        data: $.param({cat_sch_tab_lst: tableList.join(",")}),
        contentType: "application/x-www-form-urlencoded; charset=utf-8",
        success: function(result) {
            $(".alert-message, .alert-message-border").addClass("d-none");

            // Basic validation of the API response.
            if (!result || typeof result !== "object") {
                return;
            }

            // Map the API results back to the context. 
            // Assumes index 0 is Vertices and index 1 is Edges based on tableList order.
            tableList.forEach((tableKey, index) => {
                if (result[tableKey] && Array.isArray(result[tableKey])) {
                    const storageKey = (index === 0) ? "vertices_table" : "edges_table";
                    context.Data[storageKey] = { [tableKey]: result[tableKey] };
                }
            });

            // Trigger the UI population for column mapping selects.
            fillSettingsColumnsVerticesEdges(context);
        },
        error: function(xhr, status, error) {
            // Error handling: notify the user of the communication failure.
            $(".alert-message").removeClass("text-secondary").addClass("text-danger");
            $(".alert-message-border").removeClass("border-secondary bg-secondary-subtle").addClass("border-danger bg-danger-subtle");
            $(".alert-message").text("Error: Could not load data catalog.");
            $(".alert-message, .alert-message-border").removeClass("d-none");
        },
        complete: function() {
            $("#btnGetTableDetails").prop("disabled", false);
        }
    });
}


/**
 * Fetches unique category types for vertices and edges from the API.
 *
 * This function validates that all mandatory mapping fields (IDs, labels, sources, 
 * and targets) are selected. It then performs an AJAX request to retrieve unique 
 * values for the specified 'type' columns, automatically assigning default 
 * FontAwesome icons and colors based on the results.
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @return {void}
 */
function loadTypesVeticesEdges(context) {
    // Immediate return if the application context or required state is missing.
    if (!context || !context.Data || !context.Selected) {
        return;
    }

    // Hide dependent UI sections and reset error highlighting.
    $("#groupIconsColorsVerticesEdges").hide();
    $("#catalogTable, #schemaTable, #verticesTable, #edgesTable, #vertexId, " +
      "#vertexLabel, #vertexType, #edgeSrc, #edgeDst, #edgeType")
        .removeClass("border-danger");

    // --- Selection Validation ---
    const selected = context.Selected;
    const fields = selected.vertex_fields;
    const edgeFields = selected.edge_fields;
    const apiParams = {};

    const isBasicValid = selected.catalog && selected.schema && 
                         selected.vertices_table && selected.edges_table && 
                         (selected.vertices_table !== selected.edges_table);

    const isMappingValid = fields.id && fields.label && 
                           edgeFields.src && edgeFields.dst;

    if (isBasicValid && isMappingValid) {
        apiParams.vertices_table = selected.vertices_table;
        if (fields.type) {
            apiParams.vertices_column_type = fields.type;
        }
        apiParams.edges_table = selected.edges_table;
        if (edgeFields.type) {
            apiParams.edges_column_type = edgeFields.type;
        }
    } else {
        // Highlight missing mandatory selections for the user.
        if (!selected.catalog) $("#catalogTable").addClass("border-danger");
        if (!selected.schema) $("#schemaTable").addClass("border-danger");
        if (!selected.vertices_table) $("#verticesTable").addClass("border-danger");
        if (!selected.edges_table) $("#edgesTable").addClass("border-danger");
        
        if (selected.vertices_table && selected.edges_table && 
           (selected.vertices_table === selected.edges_table)) {
            $("#verticesTable, #edgesTable").addClass("border-danger");
        }

        if (!fields.id) $("#vertexId").addClass("border-danger");
        if (!fields.label) $("#vertexLabel").addClass("border-danger");
        if (!edgeFields.src) $("#edgeSrc").addClass("border-danger");
        if (!edgeFields.dst) $("#edgeDst").addClass("border-danger");

        return;
    }

    // Exit if no parameters are available for the API call.
    if (Object.keys(apiParams).length === 0) {
        return;
    }

    // Display loading feedback.
    $(".alert-message").removeClass("text-danger").addClass("text-secondary");
    $(".alert-message-border").removeClass("border-danger bg-danger-subtle").addClass("border-secondary bg-secondary-subtle");
    $(".alert-message").text("Wait, loading data...");
    $(".alert-message, .alert-message-border").removeClass("d-none");

    $("#btnGetTableDetails, #btnApplyVerticesEdgesColumnsSettings").prop("disabled", true);

    // Execute the asynchronous request to fetch unique type values.
    $.ajax({
        type: "GET",
        url: `./api/types/`,
        data: $.param(apiParams),
        contentType: "application/x-www-form-urlencoded; charset=utf-8",
        success: function(result) {
            $(".alert-message, .alert-message-border").addClass("d-none");

            // Validate the API response structure.
            if (!result || typeof result !== 'object') {
                return;
            }

            // Persist the retrieved vertex and edge types into the context.
            context.Data.vertices_statistics = {...result.vertices};
            context.Data.edges_statistics = {...result.edges};

            // Retrieve FontAwesome metadata for automatic icon matching.
            const fontAwesomeIcons = Utils.fontAwesomeIconNames();

            // --- Default Style Assignment for Vertices ---
            context.Selected.vertices_types = {};
            Object.keys(context.Data.vertices_statistics).forEach((key, index) => {
                // Find an icon starting with the first letter of the type name.
                const firstChar = key[0]?.toLowerCase() || "exclamation";
                const ico = fontAwesomeIcons.find(icon => 
                    icon.uiText.toLowerCase().startsWith(firstChar)
                );

                context.Selected.vertices_types[key] = {
                    "icon": ico ? `${ico.prefix} fa-${ico.iconName}` : null,
                    "color": CUSTOM_COLORS[index % CUSTOM_COLORS.length]
                };
            });

            // --- Default Style Assignment for Edges ---
            context.Selected.edges_types = {};
            Object.keys(context.Data.edges_statistics).forEach((key, index) => {
                context.Selected.edges_types[key] = {
                    "color": "#808080" // Default gray color for edges
                };
            });

            // Trigger the UI population for icons and color pickers.
            fillSettingsTypesVerticesEdges(context);
        },
        error: function(xhr, status, error) {
            // Notify the user of the communication failure.
            $(".alert-message").removeClass("text-secondary").addClass("text-danger");
            $(".alert-message-border").removeClass("border-secondary bg-secondary-subtle").addClass("border-secondary bg-secondary-subtle");
            $(".alert-message").text("Error: Could not load data catalog.");
            $(".alert-message, .alert-message-border").removeClass("d-none");
        },
        complete: function() {
            // Fill global filters columns dropdowns for vertices and edges.
            fillGlobalColumnsFilters(context);

            $("#btnGetTableDetails, #btnApplyVerticesEdgesColumnsSettings").prop("disabled", false);
        }
    });
}


/**
 * Validates and saves the current graph project as a JSON notebook file.
 *
 * This function performs a deep validation of the required configuration 
 * (data source, vertex/edge mappings, and styles). If the validation fails, 
 * it dynamically generates and displays a Bootstrap error modal. 
 * On success, it sanitizes internal D3/SVG metadata and restores 
 * original edge field names before triggering the file download.
 *
 * @param {!Object} context The application state object containing 
 *     all project data, selections, and queries.
 * @return {void}
 */
function fileSaveGraphNotebook(context) {
    // Remove any existing error modal from the DOM to ensure a clean state.
    $("#errorSaveGraphNotebookModal").remove();

    // --- Configuration Validation ---
    // Ensure all mandatory settings are defined before allowing the save operation.
    const selected = context.Selected;
    const isValid = selected.catalog &&
                    selected.schema &&
                    selected.vertices_table &&
                    selected.edges_table &&
                    selected.vertex_fields.id &&
                    selected.vertex_fields.label &&
                    selected.edge_fields.src &&
                    selected.edge_fields.dst &&
                    selected.vertices_types &&
                    selected.edges_types;

    if (!isValid) {
        // Dynamically build the error modal using jQuery.
        const jq_modal = $("<div>", {"class": "modal fade", "id": "errorSaveGraphNotebookModal", "tabindex": "-1", "aria-hidden": "true"})
            .append(
                $("<div>", {"class": "modal-dialog"})
                    .append(
                        $("<div>", {"class": "modal-content"})
                            .append(
                                $("<div>", {"class": "modal-header"})
                                    .append(
                                        $("<h1>", {"class": "modal-title fs-5"}).append(document.createTextNode("Save Graph Notebook")),
                                        $("<button>", {"type": "button", "class": "btn-close", "data-bs-dismiss": "modal"})
                                    ),
                                $("<div>", {"class": "modal-body"})
                                    .append(
                                        $("<h6>").append(document.createTextNode("The following definitions are required:")),
                                        $("<ol>")
                                            .append(
                                                $("<li>").append(document.createTextNode("Data Source (Catalog & Schema)")),
                                                $("<li>").append(document.createTextNode("Vertices Mapping")),
                                                $("<li>").append(document.createTextNode("Edges Mapping")),
                                                $("<li>").append(document.createTextNode("Vertices - Icons & Colors")),
                                                $("<li>").append(document.createTextNode("Edges - Colors"))
                                            )
                                    ),
                                $("<div>", {"class": "modal-footer"})
                                    .append(
                                        $("<button>", {"type": "button", "class": "btn btn-danger", "data-bs-dismiss": "modal"}).append(document.createTextNode("Close"))
                                    )
                            )
                    )
            );

        $("body").append(jq_modal);
        
        // Initialize and show the Bootstrap modal.
        const modalElement = document.getElementById("errorSaveGraphNotebookModal");
        const errorModal = new bootstrap.Modal(modalElement, {keyboard: false});
        
        // Ensure the modal is removed from DOM after being hidden.
        modalElement.addEventListener("hidden.bs.modal", () => {
            $("#errorSaveGraphNotebookModal").remove();
        });
        
        errorModal.show();
        return;
    }

    // --- Data Sanitization and Preparation ---
    // Deep clone the context to avoid mutating the live application state.
    const projectData = (({Data, Selected, Queries}) => ({Data, Selected, Queries}))(
        JSON.parse(JSON.stringify(context))
    );

    // Iterate through all queries to strip internal D3/SVG helper properties.
    Object.keys(projectData.Queries).forEach(key => {
        const result = projectData.Queries[key].result;
        
        // Remove internal properties like ___id, ___typ, ___num, etc.
        result.vertices = result.vertices?.map(({___id, ___typ, ...rest}) => rest);
        result.edges = result.edges?.map(({___id, ___typ, ___num, ___ttl, ...rest}) => rest);
    });

    /**
     * Restores original field names for edges from D3's source/target format.
     * @param {!Array<!Object>} edge_vector Array of edges with D3-mapped keys.
     * @return {!Array<!Object>} Array of edges with original field names.
     */
    const _restoreFormatEdge = (edge_vector) => {
        return edge_vector.map(obj => {
            // Extract 'source' and 'target' values and capture the rest of the object.
            const {source, target, ...rest} = obj;
            
            // Map 'source' and 'target' back to the keys defined in the initial configuration.
            return {
                ...rest,
                [selected.edge_fields.src]: source,
                [selected.edge_fields.dst]: target
            };
        });
    };

    // Apply the restoration logic to all stored query results.
    Object.keys(projectData.Queries).forEach(key => {
        if (Array.isArray(projectData.Queries[key].result.edges)) {
            projectData.Queries[key].result.edges = _restoreFormatEdge(projectData.Queries[key].result.edges);
        }
    });

    // Execute the final file save operation.
    fileSaveJSON(context, projectData);
}


/**
 * Validates the structural integrity of a Graph Notebook JSON object.
 *
 * This function performs a deep check on the provided data to ensure it contains
 * the mandatory 'Data' and 'Selected' schemas, including nested properties like
 * catalog definitions, table mappings, and visual configurations (icons/colors).
 *
 * @param {Object} jsonData The JSON object to be validated.
 * @return {boolean} True if the structure matches the expected Graph Notebook 
 *     format; otherwise, false.
 */
function validateGraphNotebook(jsonData) {
    // Immediate check for non-object or null input.
    if (!jsonData || typeof jsonData !== 'object') {
        return false;
    }

    try {
        // --- Data Object Validation ---
        // Verify existence and type of core data structures and metadata.
        const data = jsonData.Data;
        if (!data || typeof data !== 'object') return false;

        // Validate Catalog, Vertices, and Edges definitions (must be non-empty objects).
        const isInvalidData = (obj) => !obj || typeof obj !== 'object' || Object.keys(obj).length === 0;

        if (isInvalidData(data.catalog)) return false;
        if (isInvalidData(data.vertices_statistics)) return false;
        if (isInvalidData(data.vertices_table)) return false;
        if (isInvalidData(data.edges_statistics)) return false;
        if (isInvalidData(data.edges_table)) return false;

        // --- Selected Configurations Validation ---
        // Verify user selection state and mapping configurations.
        const selected = jsonData.Selected;
        if (!selected || typeof selected !== 'object') return false;

        // Check for mandatory string selections (Catalog, Schema, and Tables).
        const requiredStrings = ['catalog', 'schema', 'vertices_table', 'edges_table'];
        if (!requiredStrings.every(key => typeof selected[key] === 'string')) {
            return false;
        }

        // --- Vertex and Edge Mapping Integrity ---
        // Validate Vertex field mappings: must contain at least 'id' and 'label'.
        const vFields = selected.vertex_fields;
        if (!vFields || typeof vFields !== 'object') return false;
        if (!['id', 'label'].every(key => Object.keys(vFields).includes(key))) {
            return false;
        }

        // Validate Edge field mappings: must contain at least 'src' and 'dst'.
        const eFields = selected.edge_fields;
        if (!eFields || typeof eFields !== 'object') return false;
        if (!['src', 'dst'].every(key => Object.keys(eFields).includes(key))) {
            return false;
        }

        // Validate visual style definitions (Types/Icons/Colors).
        if (isInvalidData(selected.vertices_types)) return false;
        if (isInvalidData(selected.edges_types)) return false;

    } catch (error) {
        // Return false if any unexpected property access error occurs during validation.
        return false;
    }

    // Object passed all structural integrity checks.
    return true;
}


/**
 * Reads a Graph Notebook file and restores the entire application state.
 *
 * This function triggers the JSON file picker, validates the uploaded content,
 * clears the current workspace, and rehydrates the application context (Data, 
 * Selected, and Queries). It also synchronizes the DOM elements, restores 
 * previous query tabs, and refreshes vertex/edge item counts from the API.
 *
 * @param {!Object} context The instance context (usually 'this') containing state object to be rehydrated..
 * @return {void}
 */
function fileReadGraphNotebook(context) {
    // Immediate return if the application context or required state is missing.
    if (!context) {
        return;
    }

    // Initialize a new graph notebook state to ensure a clean slate before loading.
    newGraphNotebook(context);

    // Remove any existing error modal before starting the process.
    $("#errorLoadGraphNotebookModal").remove();

    fileReadJSON(context).then(jsonData => {
        // Proceed only if data is valid and passes structural integrity checks.
        if (jsonData !== undefined && typeof jsonData === 'object' && validateGraphNotebook(jsonData)) {
            
            // --- Workspace Cleanup ---
            // Remove all existing query tabs and their associated content.
            $(".nav-item.query-tab-header").each(function() {
                const index = parseInt($(this).data("query-index")) || 1;
                $(`#query-tab-header-${index}`).remove();
                $(`#query-${index}`).remove();
            });

            // Switch to the Datasource tab to initiate UI rehydration.
            const triggerEl = document.querySelector('.graphTabHeader .datasourceHeaderTab button');
            bootstrap.Tab.getOrCreateInstance(triggerEl).show();

            // --- UI Rehydration: Selects and Config ---

            // Cascade triggers to rebuild the dropdowns based on the saved JSON.
            $("#catalogTable").val(jsonData.Selected.catalog).trigger("change");
            $("#schemaTable").val(jsonData.Selected.schema.split(".").pop()).trigger("change");
            $("#verticesTable").val(jsonData.Selected.vertices_table.split(".").pop()).trigger("change");
            $("#edgesTable").val(jsonData.Selected.edges_table.split(".").pop()).trigger("change");

            // Deep clone Data metadata and populate column mapping dropdowns.
            context.Data = JSON.parse(JSON.stringify(jsonData.Data));
            fillSettingsColumnsVerticesEdges(context);

            // Restore vertex mapping selections.
            $("#vertexId").val(jsonData.Selected.vertex_fields.id).trigger("change");
            $("#vertexLabel").val(jsonData.Selected.vertex_fields.label).trigger("change");
            $("#vertexType").val(jsonData.Selected.vertex_fields.type || "").trigger("change");

            // Restore edge mapping selections.
            $("#edgeSrc").val(jsonData.Selected.edge_fields.src).trigger("change");
            $("#edgeDst").val(jsonData.Selected.edge_fields.dst).trigger("change");
            $("#edgeType").val(jsonData.Selected.edge_fields.type || "").trigger("change");

            // Deep clone Selected configurations and populate icons/colors settings.
            context.Selected = JSON.parse(JSON.stringify(jsonData.Selected));
            fillSettingsTypesVerticesEdges(context);

            $(`#datasource-filter-vertex`).val(context.Data?.filters?.vertex || "");
            $(`#datasource-filter-edge`).val(context.Data?.filters?.edge || "");

            // Synchronize SVG physical parameters in the UI.
            const settings = context.Selected.svg_settings;
            $("#svgWidth").val(settings.width || 2400);
            $("#svgHeight").val(settings.height || 1800);
            $("#svgVertexSize").val(settings.vertex_size || 30);
            $("#svgMinVertexDistance").val(settings.min_vertex_distance || 75);

            // Apply the restored visual settings.
            $("#btnApplyVerticesEdgesTypesSettings").trigger("click");

            // Prepare API parameters to refresh item counts for the current session.
            const apiParams = {};
            if (context.Selected.vertex_fields.type) {
                apiParams.vertices_table = context.Selected.vertices_table;
                apiParams.vertices_column_type = context.Selected.vertex_fields.type;
            }
            if (context.Selected.edge_fields.type) {
                apiParams.edges_table = context.Selected.edges_table;
                apiParams.edges_column_type = context.Selected.edge_fields.type;
            }

            // Fill global filters columns dropdowns for vertices and edges.
            fillGlobalColumnsFilters(context);

            // --- Query Tabs Restoration ---
            if (jsonData.Queries) {
                $(".query-tab-header-close").trigger("click");
                
                Object.keys(jsonData.Queries).forEach(key => {
                    const query = jsonData.Queries[key];
                    
                    if (["motiffind"].includes(query.type)) {
                        const index = motifFindTab(context);                    
                        const expressionCount = (query.motif || "").split(";").length;

                        // Update UI inputs for each query tab.
                        $(`.query-motifExpr-input[data-query-index=${index}]`).val(query.motif);
                        $(`.query-filter-input[data-query-index=${index}]`).val(query.filter);
                        $(`.query-motif-distance[data-query-index=${index}]`).text(`Distance: ${expressionCount}`);

                        // Hydrate query state and render the graph visualization.
                        context.Queries[`${index}`] = {
                            type: query.type,
                            motif: query.motif,
                            filter: query.filter,
                            result: query.result,
                        };
                        showGraphForce(context, index, $(`#query-${index}-result-visualization`), query.result);
                    }
                    else if (["allpaths","shortestpath"].includes(query.type)) {
                        const index = pathsTab(context, query.type);

                        // Update UI inputs for each query tab.
                        $(`.paths-fromExpr-input[data-query-index=${index}]`).val(query.fromExpr);
                        $(`.paths-toExpr-input[data-query-index=${index}]`).val(query.toExpr);
                        $(`.paths-edgeExpr-input[data-query-index=${index}]`).val(query.edgeExpr);
                        $(`.paths-max-distance-input[data-query-index=${index}]`).val(query.max_distance);

                        // Hydrate query state and render the graph visualization.
                        context.Queries[`${index}`] = {
                            type: query.type,
                            fromExpr: query.fromExpr,
                            toExpr: query.toExpr,
                            edgeExpr: query.edgeExpr,
                            max_distance: query.max_distance,
                            result: query.result,
                        };
                        showGraphForce(context, index, $(`#query-${index}-result-visualization`), query.result);
                    }
                    else if (["triangulation"].includes(query.type)) {
                        const index = triangulationTab(context);                    

                        // Update UI inputs for each query tab.
                        $(`.triangulation-fromExpr-input[data-query-index=${index}]`).val(query.fromExpr);
                        $(`.triangulation-edgeExpr-input[data-query-index=${index}]`).val(query.edgeExpr);
                        $(`.triangulation-max-distance-input[data-query-index=${index}]`).val(query.max_distance);

                        // Hydrate query state and render the graph visualization.
                        context.Queries[`${index}`] = {
                            type: query.type,
                            fromExpr: query.fromExpr,
                            edgeExpr: query.edgeExpr,
                            max_distance: query.max_distance,
                            result: query.result,
                        };
                        showTriangulationTable(context, index, $(`#query-${index}-result-visualization`), query.result);
                    }
                });
            }

            // Trigger a click on the Datasource tab to ensure the UI is in sync with the restored state.
            $("#datasource-tab").trigger("click");

            // Display loading feedback.
            $(".alert-message").removeClass("text-danger").addClass("text-secondary");
            $(".alert-message-border").removeClass("border-danger bg-danger-subtle").addClass("border-secondary bg-secondary-subtle");
            $(".alert-message").text("Wait, loading data...");
            $(".alert-message, .alert-message-border").removeClass("d-none");
            $(".btn-execute-command").addClass("disabled");

            // --- Server-side Metadata Refresh ---
            if (Object.keys(apiParams).length > 0) {
                $.ajax({
                    type: "GET",
                    url: `./api/types/`,
                    data: $.param(apiParams),
                    contentType: "application/x-www-form-urlencoded; charset=utf-8",
                    success: function(result) {
                        if (!result || typeof result !== 'object') return;

                        // Update the context with the refreshed vertex and edge type statistics.
                        let hasChanges = false;

                        // Retrieve FontAwesome metadata for automatic icon matching.
                        const fontAwesomeIcons = Utils.fontAwesomeIconNames();

                        // Synchronize vertex counts and update UI labels.
                        Object.keys(result.vertices).forEach(key => {
                            if (context.Data.vertices_statistics[key] !== undefined) {
                                context.Data.vertices_statistics[key] = result.vertices[key];
                                const elementId = `#vertex-items-${Utils.fastHash(key)}`;
                                $(elementId).text(`Number of Items: ${Utils.formatWithSpace(result.vertices[key])}`);
                            }
                            else {
                                // If a new type is found that wasn't in the saved JSON, add it to the context with default styling.
                                context.Data.vertices_statistics = context.Data.vertices_statistics || {};
                                const numItems = Object.keys(context.Data.vertices_statistics).length;
                                
                                context.Data.vertices_statistics[key] = result.vertices[key];

                                // Find an icon starting with the first letter of the type name.
                                const firstChar = key[0]?.toLowerCase() || "exclamation";
                                const ico = fontAwesomeIcons.find(icon => 
                                    icon.uiText.toLowerCase().startsWith(firstChar)
                                );

                                context.Selected.vertices_types[key] = {
                                    "icon": ico ? `${ico.prefix} fa-${ico.iconName}` : null,
                                    "color": CUSTOM_COLORS[(numItems - 1) % CUSTOM_COLORS.length]
                                };

                                // Mark that changes were detected to trigger a UI refresh after synchronization.
                                hasChanges = true;
                            }
                        });

                        // Synchronize edge counts and update UI labels.
                        Object.keys(result.edges).forEach(key => {
                            if (context.Data.edges_statistics[key] !== undefined) {
                                context.Data.edges_statistics[key] = result.edges[key];
                                const elementId = `#edge-items-${Utils.fastHash(key)}`;
                                $(elementId).text(`Number of Items: ${Utils.formatWithSpace(result.edges[key])}`);
                            }
                            else {
                                // If a new type is found that wasn't in the saved JSON, add it to the context with default styling.
                                context.Data.edges_statistics = context.Data.edges_statistics || {};
                                const numItems = Object.keys(context.Data.edges_statistics).length;
                                context.Data.edges_statistics[key] = result.edges[key];
                                context.Selected.edges_types[key] = {
                                    "color": CUSTOM_COLORS[(numItems - 1) % CUSTOM_COLORS.length]
                                };

                                // Mark that changes were detected to trigger a UI refresh after synchronization.
                                hasChanges = true;
                            }
                        });

                        // Trigger the UI population for icons and color pickers.
                        if (hasChanges) {
                            fillSettingsTypesVerticesEdges(context);
                            $("#btnApplyVerticesEdgesTypesSettings").trigger("click");
                        }
                    },
                    complete: function() {
                        $(".alert-message, .alert-message-border").addClass("d-none");
                        $(".btn-execute-command").removeClass("disabled");
                    }
                });
            }

            $(".tooltip").hide();
            return;
        }

        // --- Error Handling ---
        // Display an error modal if the JSON structure is invalid.
        if (jsonData !== undefined) {
            const jqModal = $("<div>", {"class": "modal fade", "id": "errorLoadGraphNotebookModal", "tabindex": "-1", "aria-hidden": "true"})
                .append(
                    $("<div>", {"class": "modal-dialog"})
                        .append(
                            $("<div>", {"class": "modal-content"})
                                .append(
                                    $("<div>", {"class": "modal-header"})
                                        .append(
                                            $("<h1>", {"class": "modal-title fs-5"}).append(document.createTextNode("Load Graph Notebook")),
                                            $("<button>", {"type": "button", "class": "btn-close", "data-bs-dismiss":"modal"})
                                        ),
                                    $("<div>", {"class": "modal-body"})
                                        .append($("<h6>").append(document.createTextNode("Invalid Graph Notebook JSON structure."))),
                                    $("<div>", {"class": "modal-footer"})
                                        .append($("<button>", {"type": "button", "class": "btn btn-danger", "data-bs-dismiss": "modal"}).append(document.createTextNode("Close")))
                                )
                        )
                );

            $("body").append(jqModal);
            const errorModal = new bootstrap.Modal(document.getElementById("errorLoadGraphNotebookModal"), {keyboard: false});
            
            document.getElementById("errorLoadGraphNotebookModal")
                .addEventListener("hidden.bs.modal", () => $("#errorLoadGraphNotebookModal").remove());
            
            errorModal.show();
        }
    });
}


/**
 * Resets the application state to initialize a new graph project.
 *
 * This function clears all current configurations, removes active query tabs,
 * resets the data context, and triggers a fresh reload of the data catalog 
 * from the server to start a clean session.
 *
 * @param {!Object} context The application state object (usually AppSparkGraph)
 *     to be reset and re-initialized.
 * @return {void}
 */
function newGraphNotebook(context) {
    // Exit immediately if the application context is not provided.
    if (!context) {
        return;
    }

    // Remove all existing query tabs by triggering their respective close events.
    $(".query-tab-header-close").trigger("click");

    // Reset the internal data structure to its initial undefined state.
    const newContext = createInitialState();
    Object.keys(newContext).forEach(key => {
        context[key] = newContext[key];
    });

    // Clear the catalog dropdown and cascade the reset through all selection levels.
    $("#catalogTable").empty().trigger("change");
    clearSettingsSelections(context, LEVEL.CATALOG);

    // Re-initiate the catalog loading process via the MainPage module.
    context.MainPage.loadCatalog(context);
}


/**
 * @fileoverview Export definitions for the Graph Project Lifecycle module.
 * Provides the public API for state initialization, remote data loading,
 * and file-based persistence (Save/Read/New) of Graph Notebooks.
 */

/**
 * Public API for Graph Notebook lifecycle management.
 */
export {
    /** @see createInitialState */
    createInitialState,
    /** @see loadCatalog */
    loadCatalog,
    /** @see fileSaveGraphNotebook */
    fileSaveGraphNotebook,
    /** @see fileReadGraphNotebook */
    fileReadGraphNotebook,
    /** @see newGraphNotebook */
    newGraphNotebook,
};
