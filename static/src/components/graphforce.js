"use strict";

import * as Utils from '../utils/utils.js';


/**
 * Converts a FontAwesome-style icon class string into a graph-compatible object.
 *
 * @param {string} i - The full icon class string (e.g., "fas fa-user").
 * @return {{prefix: string, iconName: string}} An object containing the icon 
 *     prefix and the base icon name.
 */
const iconToGraph = (i) => {
    return {
        prefix: i.split(" ")[0],
        iconName: i.split(" ")[1].substring(i.split(" ")[1].indexOf("-") + 1)
    };
};


/**
 * Formats a collection of icon objects into a graph-compatible structure.
 *
 * @param {Object<string, Object>} obj - A collection of icon configuration objects, 
 *     where each key is an identifier.
 * @return {Object<string, Object>} A new object containing updated icon 
 *     configurations with formatted icon data.
 */
const formatIcon = (obj) => {
    return Object.entries(obj).reduce((acc, [key, internalObj]) => {
        // Return a new version of the internal object with changes
        acc[key || "_"] = {
            ...internalObj,
            color: internalObj.color,
            icon: iconToGraph(internalObj.icon)
        };
        return acc;
    }, {});
};


/**
 * Formats an array of edge objects into a structure compatible with d3.
 *
 * This function extracts source and target fields based on dynamic global 
 * configurations, renames them to "source" and "target", and filters out 
 * any edges with null or undefined endpoints.
 *
 * @param {Array<Object>} edge_vector - An array of raw edge data objects.
 * @return {Array<Object>} A filtered array of formatted edge objects with 
 *     standardized source and target properties.
 */
const formatEdge = (edge_vector, key_src, key_dst) => {
    return edge_vector.map(obj => {
        // Extract current value to variables, keep the rest
        const { 
            [key_src]: source, 
            [key_dst]: target, 
            ...rest 
        } = obj; 
        
        // Return the rest + new keys set by variables
        return { ...rest, ["source"]: source, ["target"]: target }; 
    }).filter(e => (e.source !== undefined) && (e.source !== null) && (e.target !== undefined) && (e.target !== null));
};

/**
 * Generates the default configuration object for the graph visualization.
 *
 * This function creates a configuration map including dimensions, distances,
 * and dynamically initialized vertex and edge types extracted from the 
 * global data set.
 *
 * @param {Object} data - Object containing arrays of vertices and edges.
 * @param {Object} svg_config - Optional configuration object to override 
 *     default visual and physical properties.
 * @return {Object} The default configuration object containing dimensions, 
 *     icon settings, and categorized vertex and edge styling.
 */
const createDefaultConfig = (data, svg_config) => {
    return {
        icon_radius: 28,
        vertices_distance: 75,
        width: 2000,
        height: 1500,
        vertices: [...new Set(data.vertices.map(d => (d[svg_config?.mapping?.vertex?.type] !== undefined ? d[svg_config?.mapping?.vertex?.type] : "_")))]
            .reduce((accumulator, currentValue) => {
                accumulator[currentValue] = {color:"#7f7f7f", icon:{prefix:"far", iconName:"file-lines"}};
                return accumulator;
            }, {}),
        edges: [...new Set(data.edges.map(d => (d[svg_config?.mapping?.edge?.type] !== undefined ? d[svg_config?.mapping?.edge?.type] : "_")))]
            .reduce((accumulator, currentValue) => {
                accumulator[currentValue] = { color:"#7f7f7f" };
                return accumulator;
            }, {}),
    };
};


/**
 * Creates an arc generator function for D3 force-directed graph edges.
 *
 * This factory function captures the node radius and returns a specialized
 * path generator that handles both self-loops (using Cubic Bézier) and
 * multi-link curved edges between different nodes (using Quadratic Bézier).
 * 1. Self-loops: Represented as cubic Bézier curves (C) distributed 
 *    radially around the node.
 * 2. Standard edges: Represented as quadratic Bézier curves (Q) with 
 *    offsets to handle multiple links between the same pair of nodes.
 *
 * @param {number} RADIUS_NODES - The visual radius of the nodes to calculate 
 *     proper start and end offsets.
 * @return {function(!Object): string} A function that takes a D3 link object 
 *     and returns an SVG path data string ("d" attribute).
 */
const createEdgeArc = (RADIUS_NODES) => {
    /**
     * Generates the SVG path for a specific link.
     * @param {Object} d - The D3 link/edge object containing source and target.
     * @param {Object} d.source - The source node object with x and y coordinates.
     * @param {Object} d.target - The target node object with x and y coordinates.
     * @param {number} d.___num - The index of the current link among multiple edges.
     * @param {number} d.___ttl - The total number of edges between the same nodes.
     * @return {string} An SVG path data string (e.g., "M... C..." or "M... Q...").
     */
    return (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);

        // --- Logic for self-relationships (Self-loop) ---
        if (dr === 0) {
            // Radial distribution: ensures overlapping loops spread out.
            // Starts at the top (-90 deg) and spreads in 45-degree intervals.
            const baseAngle = -Math.PI / 2;
            const angleStep = Math.PI / 4;
            const angle = baseAngle + ((d["___num"] - 1) * angleStep);

            // Angular spread: distance between start and end points on the node border.
            const spread = 0.5;

            // Calculate points on the node border to prevent line-to-fill overlapping.
            const startX = d.source.x + RADIUS_NODES * Math.cos(angle - spread);
            const startY = d.source.y + RADIUS_NODES * Math.sin(angle - spread);
            const endX = d.source.x + RADIUS_NODES * Math.cos(angle + spread);
            const endY = d.source.y + RADIUS_NODES * Math.sin(angle + spread);

            // Control points for the loop's oval shape.
            // Stiffness determines the "height" of the loop handle.
            const stiffness = RADIUS_NODES * 3.5;
            const cpx1 = startX + stiffness * Math.cos(angle - spread);
            const cpy1 = startY + stiffness * Math.sin(angle - spread);
            const cpx2 = endX + stiffness * Math.cos(angle + spread);
            const cpy2 = endY + stiffness * Math.sin(angle + spread);

            // Returns a Cubic Bézier curve for the loop.
            return `M${startX},${startY} C${cpx1},${cpy1} ${cpx2},${cpy2} ${endX},${endY}`;
        }

        // --- Logic for Normal Links (between different nodes) ---
        // Calculate offsets to start the line at the node's edge instead of center.
        const offsetSourceX = (dx * RADIUS_NODES) / dr;
        const offsetSourceY = (dy * RADIUS_NODES) / dr;
        const offsetTargetX = (dx * RADIUS_NODES) / dr;
        const offsetTargetY = (dy * RADIUS_NODES) / dr;

        const startX = d.source.x + offsetSourceX;
        const startY = d.source.y + offsetSourceY;
        const endX = d.target.x - offsetTargetX;
        const endY = d.target.y - offsetTargetY;

        // Multi-link separation logic: creates parallel arcs for multiple connections.
        const separation = 30;
        const total_offset = (d["___ttl"] - 1) / 2;
        const current_offset = (d["___num"] - 1) - total_offset;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        // Calculate perpendicular vector for the Quadratic Bézier control point.
        const perpX = (endY - startY);
        const perpY = (startX - endX);
        const norm = Math.sqrt(perpX * perpX + perpY * perpY);

        const controlX = midX + (perpX / norm) * current_offset * separation;
        const controlY = midY + (perpY / norm) * current_offset * separation;

        // Returns a Quadratic Bézier curve.
        return `M${startX},${startY} Q${controlX},${controlY} ${endX},${endY}`;
    };
};


/**
 * Creates and configures a D3 drag behavior for graph nodes.
 *
 * This function initializes the drag event listeners, allowing nodes to be
 * moved interactively while updating the force simulation's alpha target
 * to maintain movement fluidly.
 *
 * @param {Object} simulation - The D3 force simulation to be updated during drag.
 * @return {Function} A D3 drag behavior to be called on a selection.
 */
const drag = (simulation) => {
    // Flag to track if the drag has started, used to prevent unnecessary alphaTarget updates.
    let started = false;

    /**
     * Handles the start of a drag gesture.
     *
     * @param {Object} event - The D3 drag event.
     * @param {Object} d - The data bound to the dragged element.
     */
    function dragstarted(event, d) {
        // set alphaTarget to a non-zero value to keep the simulation "hot" during dragging, 
        // but only on the first drag event to prevent excessive restarts.
        started = false;

        // Fix the node's position to the current coordinates
        d.fx = d.x;
        d.fy = d.y;
    }

    /**
     * Handles the continuation of a drag gesture.
     *
     * @param {Object} event - The D3 drag event.
     * @param {Object} d - The data bound to the dragged element.
     */
    function dragged(event, d) {
        // If this is the first drag event, set the started flag to true and update the 
        // alphaTarget to keep the simulation responsive. This prevents multiple 
        // unnecessary restarts during a single drag action.
        if (!started) {
            simulation.alphaTarget(0.3).restart();
            started = true;
        }

        // Update the fixed position based on the event's coordinates
        d.fx = event.x;
        d.fy = event.y;
    }

    /**
     * Handles the end of a drag gesture.
     *
     * @param {Object} event - The D3 drag event.
     * @param {Object} d - The data bound to the dragged element.
     */
    function dragended(event, d) {
        // Set alphaTarget back to 0 to allow the simulation to cool down
        if (!event.active) {
            simulation.alphaTarget(0);
        }
        // Release the node's fixed position
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
};


/**
 * Displays the properties of a graph element in a side panel.
 *
 * This function clears the existing property table and populates it with 
 * metadata from the selected vertex or edge, using the current SVG 
 * configuration to map labels and values.
 *
 * @param {string|number} indexId - Unique identifier for the table container.
 * @param {?Object} element - The selected graph element (vertex or edge) 
 *     whose properties will be displayed.
 * @param {!Object=} svg_config - Configuration object for mapping property 
 *     names and labels.
 * @param {!Object=} graph_data - The complete graph data object, used for 
 *     contextual lookups if necessary.
 * @return {void}
 */
const showProperties = (indexId, element, svg_config = {}, graph_data) => {
    const propTblBody = $(`#propertyTableBody-${indexId}`);
    propTblBody.empty();

    // Define a maximum text size for display to prevent overflow in the properties panel.
    const MAX_TEXT_SIZE = 512;

    // Checks if the element exists; if it does not exist, returns without doing anything
    if (!element) return;

    const VERTEX_KEYS = Array.from(new Set([
        (svg_config?.mapping?.vertex?.id !== undefined ? svg_config?.mapping?.vertex?.id : ""),
        (svg_config?.mapping?.vertex?.label !== undefined ? svg_config?.mapping?.vertex?.label : ""),
        (svg_config?.mapping?.vertex?.type !== undefined ? svg_config?.mapping?.vertex?.type : "_")
    ]));
    const EDGES_KEYS = Array.from(new Set([
        (svg_config?.mapping?.edge?.src !== undefined ? svg_config?.mapping?.edge?.src : ""),
        (svg_config?.mapping?.edge?.dst !== undefined ? svg_config?.mapping?.edge?.dst : ""),
        (svg_config?.mapping?.edge?.type !== undefined ? svg_config?.mapping?.edge?.type : "_")
    ]));
    var type = element ? element["___typ"] : null;

    const elConfig = (type == "vertex") ? 
                        (svg_config?.vertices !== undefined ? svg_config?.vertices : {})[element[(svg_config?.mapping?.vertex?.type !== undefined) ? svg_config?.mapping?.vertex?.type : "_"] || "_"] :
                        (svg_config?.edges !== undefined ? svg_config?.edges : {})[element[(svg_config?.mapping?.edge?.type !== undefined) ? svg_config?.mapping?.edge?.type : "_"] || "_"];

    if (type === null) {
        return;
    }
    else if (type === "vertex") {
        // property box vertex data
        $(`#propertyHeader-${indexId}`).removeClass("bg-success").addClass("bg-primary");
        $(`#propertyTitle-${indexId}`).text("Vertex");

        // vertex data
        for (const key of VERTEX_KEYS) {
            const row = $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small", "style":"width: 74px;"}).append(document.createTextNode(key)),
                    $("<td>", {"class":"font-extra-small"}).append(
                        (() =>{
                            if (key == svg_config?.mapping?.vertex?.type) {
                                return $("<div>", {"class":"d-flex"})
                                    .append(
                                        $("<div>", {"class":"m-0 me-2 p-0 rounded-circle", "style":`width: 16px; height: 16px; background-color: ${elConfig?.color}; border: 1px solid gray; box-sizing: border-box;`}),
                                        $("<i>", {"id":"selIcon","class":`${elConfig?.icon?.prefix} fa-${elConfig?.icon?.iconName} fa-lg m-0 me-2 p-0`}),
                                        document.createTextNode(Utils.truncateText(element[key], 32) )
                                    )
                            }
                            return document.createTextNode(Utils.truncateText(element[key], MAX_TEXT_SIZE) );
                        })()                                
                    )
                );
            propTblBody.append(row);
        }

        // additional properties of the vertex
        let keysProperties = Object.getOwnPropertyNames(graph_data.vertices[0]).filter(k => !VERTEX_KEYS.includes(k) && !k.startsWith("___"));
        if (keysProperties.length > 0) {
            propTblBody.append(
                $("<tr>", {"class":"border-bottom"}).append($("<td>", {"class":"fw-bold font-extra-small bg-body-secondary", "colspan":2}).append(document.createTextNode("\u229E Properties")))
            );

            for (const key of keysProperties) {
                const row = $("<tr>", {"class":"border-bottom"})
                    .append(
                        $("<td>", {"class":"fw-bold font-extra-small", "style":"width: 74px;"}).append(document.createTextNode(key)),
                        $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText(String(element[key]), MAX_TEXT_SIZE)))
                    );
                propTblBody.append(row);
            }
        }

        // Copy to clipboard button event
        let objectToCopy = {};
        for (const key of Object.getOwnPropertyNames(graph_data.vertices[0]).filter(k => !k.startsWith("___"))) {
            objectToCopy = Object.assign(objectToCopy, { [key]: element[key] });
        }
        const dataText = escape(JSON.stringify(objectToCopy, null, 2));
        $(`#copyToClipboard-${indexId}`).off("click").on("click", function() {
            navigator.clipboard.writeText(unescape(dataText));
        });

        // event of the button to close the properties window
        $(`#closeProperties-${indexId}`).off("click").on("click", function() {
            $(`.btn-svg-${indexId}-prop-window`).trigger("click");
        });            
    } 
    else if (type === "edge") {
        // property box edge data
        $(`#propertyHeader-${indexId}`).removeClass("bg-primary").addClass("bg-success");
        $(`#propertyTitle-${indexId}`).text("Edge");

        // edge data type
        propTblBody.append(
            $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small", "style":"width: 74px;"}).append(document.createTextNode(svg_config?.mapping?.edge?.type || "type")),
                    $("<td>", {"class":"font-extra-small"}).append(
                        $("<div>", {"class":"d-flex"})
                            .append(
                                $("<div>", {"class":"m-0 me-2 p-0 rounded-circle", "style":`width: 16px; height: 16px; background-color: ${elConfig?.color}; border: 1px solid gray; box-sizing: border-box;`}),
                                document.createTextNode(Utils.truncateText((element[svg_config?.mapping?.edge?.type] !== undefined) ? element[svg_config?.mapping?.edge?.type] : "-", MAX_TEXT_SIZE))
                            )
                    )
                )
        );

        // data from the vertex of origin of the edge
        let source = Object.assign({}, element[svg_config?.mapping?.edge?.src || ""]);
        if (!source) return;
        let sourceCopy = {};
        for (const key of Object.getOwnPropertyNames(graph_data.vertices[0]).filter(k => !k.startsWith("___"))) {
            sourceCopy = Object.assign(sourceCopy, { [key]: source[key] });
        }
        source = sourceCopy;

        propTblBody.append($("<tr>", {"class":"border-bottom"}).append($("<td>", {"class":"fw-bold font-extra-small bg-body-secondary", "colspan":2}).append(document.createTextNode("\u229E Source"))));
        propTblBody.append(
            $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small", "style":"width: 74px;"}).append(document.createTextNode(svg_config?.mapping?.vertex?.id || "id")),
                    $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText((source[svg_config?.mapping?.vertex?.id || "_"] !== undefined) ? source[svg_config?.mapping?.vertex?.id || "_"] : "", MAX_TEXT_SIZE)))
                )
        );
        source[svg_config?.mapping?.vertex?.label] && (source[svg_config?.mapping?.vertex?.label] != source[svg_config?.mapping?.vertex?.id]) && propTblBody.append(
            $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small", "style":"width: 74px;"}).append(document.createTextNode(svg_config?.mapping?.vertex?.label || "label")),
                    $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText((source[svg_config?.mapping?.vertex?.label || ""] !== undefined) ? source[svg_config?.mapping?.vertex?.label || ""] : "", MAX_TEXT_SIZE)))
                )
        );
        source[svg_config?.mapping?.vertex?.type] && propTblBody.append(
            $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small", "style":"width: 74px;"}).append(document.createTextNode(svg_config?.mapping?.vertex?.type || "type")),
                    $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText((source[svg_config?.mapping?.vertex?.type || ""] !== undefined) ? source[svg_config?.mapping?.vertex?.type || ""] : "", MAX_TEXT_SIZE)))
                )
        );
        
        // data from the destination vertex of the edge
        let target = Object.assign({}, element[svg_config?.mapping?.edge?.dst || ""]);
        if (!target) return;
        let targetCopy = {};
        for (const key of Object.getOwnPropertyNames(graph_data.vertices[0]).filter(k => !k.startsWith("___"))) {
            targetCopy = Object.assign(targetCopy, { [key]: target[key] });
        }
        target = targetCopy;

        propTblBody.append($("<tr>", {"class":"border-bottom"}).append($("<td>", {"class":"fw-bold font-extra-small bg-body-secondary", "colspan":2}).append(document.createTextNode("\u229E Destination"))));
        propTblBody.append(
            $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small", "style":"width: 74px;"}).append(document.createTextNode(svg_config?.mapping?.vertex?.id || "id")),
                    $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText((target[svg_config?.mapping?.vertex?.id || ""] !== undefined) ? target[svg_config?.mapping?.vertex?.id || ""] : "", MAX_TEXT_SIZE)))
                )
        );
        target[svg_config?.mapping?.vertex?.label] && (target[svg_config?.mapping?.vertex?.label] != target[svg_config?.mapping?.vertex?.id]) && propTblBody.append(
            $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small"}).append(document.createTextNode(svg_config?.mapping?.vertex?.label || "label")),
                    $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText((target[svg_config?.mapping?.vertex?.label || ""] !== undefined) ? target[svg_config?.mapping?.vertex?.label || ""] : "", MAX_TEXT_SIZE)))
                )
        );
        target[svg_config?.mapping?.vertex?.type] && propTblBody.append(
            $("<tr>", {"class":"border-bottom"})
                .append(
                    $("<td>", {"class":"fw-bold font-extra-small"}).append(document.createTextNode(svg_config?.mapping?.vertex?.type || "type")),
                    $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText((target[svg_config?.mapping?.vertex?.type || ""] !== undefined) ? target[svg_config?.mapping?.vertex?.type || ""] : "", MAX_TEXT_SIZE)))
                )
        );

        // additional edge properties
        let keysProperties = Object.getOwnPropertyNames(graph_data.edges[0]).filter(k => !EDGES_KEYS.includes(k) && !k.startsWith("___"));
        if (keysProperties.length > 0) {
            propTblBody.append(
                $("<tr>", {"class":"border-bottom"}).append($("<td>", {"class":"fw-bold font-extra-small bg-body-secondary", "colspan":2}).append(document.createTextNode("\u229E Properties")))
            );
            for (const key of keysProperties) {
                const row = $("<tr>", {"class":"border-bottom"})
                    .append(
                        $("<td>", {"class":"fw-bold font-extra-small"}).append(document.createTextNode(key)),
                        $("<td>", {"class":"font-extra-small"}).append(document.createTextNode(Utils.truncateText(String((element[key] !== undefined) ? element[key] : ""), MAX_TEXT_SIZE)))
                    );
                propTblBody.append(row);
            }
        }

        // Copy to clipboard button event
        let objectToCopy = {};
        for (const key of Object.getOwnPropertyNames(graph_data.edges[0]).filter(k => !k.startsWith("___"))) {
            objectToCopy = Object.assign(objectToCopy, { [key]: element[key] });
        }
        objectToCopy[svg_config?.mapping?.edge?.src] = source;
        objectToCopy[svg_config?.mapping?.edge?.dst] = target;
        const dataText = escape(JSON.stringify(objectToCopy, null, 2));
        $(`#copyToClipboard-${indexId}`).off("click").on("click", function() {
            navigator.clipboard.writeText(unescape(dataText));
        });
    }

    // Displays the properties box.
    $(`#propertyBox-${indexId}`).css("display", "");

    // Sets the position of the properties box in the upper left corner of the SVG.
    const position = $(`#d3-tree-${indexId}`).offset();
    $(`#propertyBox-${indexId}`).offset({ top: position.top, left: position.left });
}


/**
 * Creates and manages the HTML structural elements for the graph visualization.
 *
 * This function handles the removal of existing instances to prevent ID 
 * duplication, creates a responsive toolbar with action buttons (download, 
 * zoom, refresh), initializes a search input, and sets up a floating 
 * properties table for metadata display.
 *
 * @param {string|number} indexId - Unique identifier used to namespace element IDs.
 * @param {string|jQuery} jqSvgParent - The selector or jQuery object where the 
 *     graph and its UI components will be appended.
 * @return {void}
 */
const showGraph_htmlElements = (indexId, jqSvgParent) => {
    // Remove existing visualization and property box to ensure a clean state.
    $(`#svg-d3-visualization-${indexId}, #propertyBox-${indexId}`).remove();

    // Create the main container and toolbar structure using jQuery.
    let toolbar_and_svg = $("<div>", {
        "class": "d-flex flex-column p-2 border w-100 border",
        "id": `svg-d3-visualization-${indexId}`,
        "style": "min-height: 760px; height: calc(100vh - 450px); overflow: hidden; min-width: 0;"
    }).append(
        $("<div>", {
            "class": "d-flex p-1 m-1 flex-shrink-0",
            "id": `sgv-toolbar-${indexId}`
        }).append(
            // Image download action button.
            $("<button>", {
                "type": "button",
                "class": `btn m-0 p-0 ms-3 btn-svg-${indexId}-download-image me-3 border-0 bg-transparent`,
                "title": "Download Image"
            }).append($("<i>", {"class": "fa-solid fa-file-image", "style": "width: 20px; height: 20px;"})),
            
            // Data export (JSON/Code) action button.
            $("<button>", {
                "type": "button",
                "class": `btn m-0 p-0 btn-svg-${indexId}-download-data me-3 border-0 bg-transparent`,
                "title": "Download Data"
            }).append($("<i>", {"class": "fa-solid fa-file-code", "style": "width: 20px; height: 20px;"})),
            
            $("<div>", {"class": "vr me-3"}), // Visual vertical separator.
            
            // Graph state refresh button.
            $("<button>", {
                "type": "button",
                "class": `btn m-0 p-0 btn-svg-${indexId}-refresh me-3 border-0 bg-transparent`,
                "title": "Refresh Graph"
            }).append($("<i>", {"class": "fa-solid fa-arrow-rotate-right", "style": "width: 20px; height: 20px;"})),
            
            $("<div>", {"class": "vr me-3"}),
            
            // Zoom control buttons (In/Out).
            $("<button>", {
                "type": "button",
                "class": `btn m-0 p-0 btn-svg-${indexId}-zoom-in me-3 border-0 bg-transparent`,
                "title": "Zoom In"
            }).append($("<i>", {"class": "fa-solid fa-magnifying-glass-plus", "style": "width: 20px; height: 20px;"})),
            
            $("<button>", {
                "type": "button",
                "class": `btn m-0 p-0 btn-svg-${indexId}-zoom-out me-3 border-0 bg-transparent`,
                "title": "Zoom Out"
            }).append($("<i>", {"class": "fa-solid fa-magnifying-glass-minus", "style": "width: 20px; height: 20px;"})),
            
            $("<div>", {"class": "vr me-3"}),
            
            // Toggle button for the properties side panel.
            $("<button>", {
                "type": "button",
                "class": `btn m-0 p-0 btn-svg-${indexId}-prop-window me-3 border-0 bg-transparent`,
                "title": "Properties"
            }).append($("<i>", {"class": "fa-solid fa-table-list", "style": "width: 20px; height: 20px;"})),
            
            $("<div>", {"class": "vr me-3"}),
            
            // Node search/find input group.
            $("<div>", {
                "class": "input-group input-group-sm  border border-dark-subtle rounded",
                "style": "font-size:0.80rem; max-width:300px"
            }).append(
                $("<span>", {
                    "class": "input-group-text border-0",
                    "style": "font-size:0.80rem;"
                }).append(document.createTextNode("Find")),
                $("<input>", {
                    "type": "text",
                    "class": "form-control border-0",
                    "style": "font-size:0.80rem;",
                    "aria-label": "Find",
                    "id": `svg-find-node-${indexId}`
                }),
                $("<button>", {
                    "class": "btn btn-outline-secondary border-0",
                    "type": "button",
                    "id": `svg-clear-find-node-${indexId}`
                }).append($("<i>", {"class": "fa-regular fa-circle-xmark"}))
            ),

            $("<div>", {"class": "vr mx-3"}),

            $("<span>", {"class": "text-muted small mt-1", "id": `vertices-edges-count-${indexId}`}).append(document.createTextNode("0 Vertices, 0 Edges")),
        ),
        // Main D3 container where the SVG will be rendered.
        $("<div>", {
            "class": "overflow-scroll d-flex flex-grow-1 h-100",
            "id": `d3-tree-${indexId}`,
            "style": "scrollbar-gutter: stable; width: 100%; min-width: 0; max-width: 100%; position: relative;"
        }),
    );
    $(jqSvgParent).append(toolbar_and_svg);

    // Initialize the floating properties box for vertex/edge metadata.
    let properties_table = $("<div>", {
        "id": `propertyBox-${indexId}`,
        "class": "position-absolute sticky-top border rounded shadow bg-light p-2 d-none",
        "style": "width: 300px; z-index: 1050; top: 20px; left: 80px; height: fit-content;"
    }).append(
        $("<div>", {
            "id": `propertyHeader-${indexId}`,
            "class": "d-flex justify-content-between align-items-center bg-primary text-white px-2 py-1 rounded font-extra-small"
        }).append(
            $("<span>", {
                "id": `propertyTitle-${indexId}`,
                "class": "font-extra-small"
            }).append(document.createTextNode("Properties")),
            $("<div>", {"class": "d-flex align-items-center"})
                .append(
                    // Clipboard action button for quick data copying.
                    $("<button>", {
                        "type": "button",
                        "id": `copyToClipboard-${indexId}`,
                        "class": "btn-sm m-0 p-0 border-0 bg-transparent",
                        "title": "Copy to Clipboard"
                    }).append($("<i>", {"class": "fa-regular fa-copy m-0 p-0 btn-sm", "style": "filter: invert(100%);"})),
                    
                    // Close button to hide the property box.
                    $("<button>", {
                        "type": "button",
                        "id": `closeProperties-${indexId}`,
                        "class": "btn-sm m-0 p-0 ms-3 border-0 bg-transparent",
                        "title": "Close Properties"
                    }).append($("<i>", {"class": "fa-regular fa-circle-xmark m-0 p-0 btn-sm", "style": "filter: invert(100%);"}))
                )
        ),
        // Scrollable container for the dynamic property table rows.
        $("<div>", {"class": "mt-2", "style": "max-height: 250px; overflow-y: auto;"})
            .append(
                $("<table>", {"class": "table table-borderless table-sm mb-0"})
                    .append($("<tbody>", {"id": `propertyTableBody-${indexId}`}))
            )
    );
    $(jqSvgParent).append(properties_table);
}


/**
 * Traverses a linked list of edges starting from a specific ID and returns all unique ___ids.
 * 
 * @param {Object} data - The base object containing the "edges" property.
 * @param {Array<Object>} data.edges - List of edge objects with source, target, and ___id.
 * @param {string} startId - The initial ___id to begin the traversal.
 * @returns {string[]} A list of unique ___id values found in the traversal path.
 */
const getEdgePathById = (data, startId) => {
    // Return early if data or edges are missing
    if (!data || !Array.isArray(data.edges)) return [];

    const { edges } = data;
    
    // Create a Map for O(1) access to edges by their source value.
    // This handles cases where one target might point to multiple sources.
    const sourceMap = new Map();
    edges.forEach(edge => {
        if (!sourceMap.has(edge.source)) {
            sourceMap.set(edge.source, []);
        }
        sourceMap.get(edge.source).push(edge);
    });

    // Find the starting edge by the provided ___id
    const startEdge = edges.find(edge => edge.___id === startId);
    if (!startEdge) return [];

    const visitedIds = new Set();
    const resultIds = [];
    
    // Initialize the traversal with the starting edge
    let currentEdges = [startEdge];

    /**
     * Traversal Logic:
     * A loop is used to traverse the chain. Since a target can potentially connect to 
     * multiple sources (branching), this situation is treated as a path traversal.
     */
    while (currentEdges.length > 0) {
        const nextIterationEdges = [];

        for (const edge of currentEdges) {
            // Avoid infinite loops and duplicate entries
            if (visitedIds.has(edge.___id)) continue;

            // Mark as visited and add to result
            visitedIds.add(edge.___id);
            resultIds.push(edge.___id);

            // Find edges where source matches the current target
            const nextEdges = sourceMap.get(edge.target);
            if (nextEdges) {
                nextIterationEdges.push(...nextEdges);
            }
        }
        
        currentEdges = nextIterationEdges;
    }

    return resultIds;
};


/**
 * Initializes and renders a d3-force directed graph simulation.
 *
 * This function processes vertex and edge data, applies custom configurations,
 * sets up physical forces, and generates the initial SVG structure for the graph.
 *
 * @param {string|number} indexId - Unique identifier for the SVG element.
 * @param {!Object} data - Object containing arrays of vertices and edges.
 * @param {!Object=} svg_config - Optional configuration object to override 
 *     default visual and physical properties.
 * @return {!d3.Selection} The d3 selection of the newly created SVG element.
 */
const chartGraphForce = (indexId, data, svg_config = {}) => {
    // Sets the default settings.
    const defaultConfig = createDefaultConfig(data);

    // Sets values ​​according to the SVG characteristics and sets constants.
    const RADIUS_NODES = svg_config.icon_radius || 28;
    const NODE_DISTANCE = svg_config.vertices_distance || 75;
    const SVG_WIDTH = svg_config.width || 2000;
    const SVG_HEIGHT = svg_config.height || 1500;

    const TEXT_MARGIN = RADIUS_NODES + 5;
    const MAX_TEXT_LENGTH = 15;

    const BRIGHTER_START = 1.5;
    const BRIGHTER_END = -1.5;
    const COLOR_OVER_MOUSER = "252, 197, 186";
    const COLOR_OVER_MOUSER_EXT_PATH = "119, 221, 119";

    const LINK_BORDER_WIDTH = 14;
    const NODE_BORDER_WIDTH = 20;

    // Validates SVG settings, ensuring valid configurations.
    svg_config.vertices = Object.assign(defaultConfig.vertices, svg_config.vertices || {});
    svg_config.edges = Object.assign(defaultConfig.edges, svg_config.edges || {});
    svg_config = Object.assign(defaultConfig, svg_config);
    window.svg_config = svg_config;


    // Defines the list of types of: vertices and edges
    const vertices = data.vertices.map(d => {
            const node = Object.assign({}, d);
            delete node.x;
            delete node.y;
            delete node.fx;
            delete node.fy;
            return node;
        });    
    const vertexTypes = [...new Set(vertices.map(d => d[svg_config?.mapping?.vertex?.type] || "_"))].sort();
    const customVerticesColorScheme = vertexTypes.map(c => (svg_config?.vertices || {})[c]?.color);
    const vertexColors = d3.scaleOrdinal(vertexTypes, customVerticesColorScheme.concat(d3.schemeCategory10));

    const edges = data.edges.map(d => Object.assign({}, d));
    const edgeTypes = [...new Set(edges.map(d => d[svg_config?.mapping?.edge?.type] || "_"))].sort();
    const customEdgesColorScheme = edgeTypes.map(c => (svg_config?.edges || {})[c]?.color);
    const edgeColors = d3.scaleOrdinal(edgeTypes, customEdgesColorScheme.concat(d3.schemeTableau10));

    // Defines the physical simulation parameters for the force graph.
    const simulation = d3.forceSimulation(vertices)
        .force("link", d3.forceLink(edges).id(d => d[svg_config?.mapping?.vertex?.id]))
        .force("charge", d3.forceManyBody().strength(-600))
        .force("x", d3.forceX(0).strength(0.1)) // Puxa explicitamente para o 0
        .force("y", d3.forceY(0).strength(0.1)) // Puxa explicitamente para o 0
        .force("center", d3.forceCenter(0, 0))  // Fixa o centro de massa em 0,0
        .force("collide", d3.forceCollide().radius(NODE_DISTANCE));

    // Creates the SVG structure.
    const svg = d3.create("svg")
        .attr("id", `svgGraphForceViewer-${indexId}`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("viewBox", [-SVG_WIDTH / 2, -SVG_HEIGHT / 2, SVG_WIDTH, SVG_HEIGHT])
        .style("font", "12px sans-serif")
        .style("flex-shrink", "0")
        .style("display", "block")
        .attr("fill", "white")
        .attr("width", SVG_WIDTH)
        .attr("height", SVG_HEIGHT);

    const defs = svg.append("defs");

    // ===============================================================
    // General SVG definitions
    // ===============================================================

    // Loads the icons used in DEFS.
    for(let nt of vertexTypes) {
        // Get the icon or set a default icon.
        let ico = (svg_config?.vertices || {})[nt || ""]?.icon;
        if (!((typeof(ico) =="object") && ico.hasOwnProperty("prefix") && ico.hasOwnProperty("iconName"))) {
            ico = { prefix: "far", iconName: "file-lines" };
        }

        // Definition of the node type icon (FontAwesome)
        const typeSVGPath = new DOMParser()
            .parseFromString(FontAwesome.icon(ico).html, "text/xml")
            .documentElement;
        const typePathElement = typeSVGPath.querySelector("path");
        const typeIconPath = typePathElement.getAttribute("d");
        const typeIconViewBox = typeSVGPath.getAttribute("viewBox");

        defs.append("symbol").attr("id", nt).attr("viewBox", typeIconViewBox)
            .append("path").attr("d", typeIconPath);
    }

    // Markers (arrows) for the directional edges
    defs.selectAll("marker")
        .data(edges, d => d.source[svg_config?.mapping?.vertex?.id] + "-" + d.target[svg_config?.mapping?.vertex?.id])
        .join(
            enter => {
                const marker = enter.append("marker")
                    .attr("id", d => `arrowhead-${d["___id"]}`)
                    .attr("viewBox", "0 -2 5 4")
                    .attr("refX", 5)
                    .attr("refY", 0)
                    .attr("orient", "auto-start-reverse")
                    .attr("markerWidth", 5)
                    .attr("markerHeight", 4);
                
                marker.append("path")
                    .attr("data-edge-type", d => d[svg_config?.mapping?.edge?.type])
                    .attr("d", "M0,-2L5,0L0,2")
                    .attr("fill", d => d3.rgb(edgeColors(d[svg_config?.mapping?.edge?.type] || "_")).brighter(BRIGHTER_END));
                
                return marker;
            },
            update => update,
            exit => exit.remove()
        );                

    // ===============================================================
    // Edges/Links
    // ===============================================================

    // Sets the gradients for the edges.
    const edgeGradients = defs.selectAll("linearGradient")
        .data(edges, d => d.source[svg_config?.mapping?.vertex?.id] + "-" + d.target[svg_config?.mapping?.vertex?.id])
        .join(
            enter => {
                const gradient = enter.append("linearGradient")
                    .attr("id", d => `gradient-${d["___id"]}`)
                    .attr("gradientUnits", "userSpaceOnUse");

                gradient.append("stop")
                    .attr("data-edge-type", d => d[svg_config?.mapping?.edge?.type])
                    .attr("offset", "0%")
                    .attr("stop-color", d => d3.rgb(edgeColors(d[svg_config?.mapping?.edge?.type] || "_")).brighter(BRIGHTER_START));

                gradient.append("stop")
                    .attr("data-edge-type", d => d[svg_config?.mapping?.edge?.type])
                    .attr("offset", "100%")
                    .attr("stop-color", d => d3.rgb(edgeColors(d[svg_config?.mapping?.edge?.type] || "_")).brighter(BRIGHTER_END));

                return gradient;
            },
            update => update,
            exit => exit.remove()
        );

    // Group for borders (to highlight on mouseover)
    const edgeGroup = svg.append("g")
        .attr("stroke", `rgba(${COLOR_OVER_MOUSER}, 0)`);

    // Sets the group for the edges.
    const edgeGroups = edgeGroup.selectAll("g")
        .data(edges, d => d.source[svg_config?.mapping?.vertex?.id] + "-" + d.target[svg_config?.mapping?.vertex?.id])
        .join("g")
        .attr("data-bs-toggle", "tooltip")
        .attr("data-bs-trigger", "hover")
        .attr("data-bs-animation", "false")
        .attr("data-bs-html", "true")
        .attr("title", d => d[svg_config?.mapping?.edge?.type] || "");

    // Defines the gradients for the edges of the highlight (hovering glow effect)
    const edgeBorderGradients = defs.selectAll("radialGradient")
        .data(edges, d => d.source[svg_config?.mapping?.vertex?.id] + "-" + d.target[svg_config?.mapping?.vertex?.id])
        .join(
            enter => {
                const gradient = enter.append("radialGradient")
                    .attr("id", d => `radial-gradient-${d["___id"]}`);

                // Adds the center color.
                gradient.append("stop")
                    .attr("offset", "0%")
                    .attr("stop-color", `rgba(${COLOR_OVER_MOUSER}, 1)`)
                    .attr("stop-opacity", 0.5); // Total opacity in the center

                // Add the outer border color.
                gradient.append("stop")
                    .attr("offset", "100%")
                    .attr("stop-color", `rgba(${COLOR_OVER_MOUSER}, 0)`)
                    .attr("stop-opacity", 0); // Transparent at the ends

                return gradient;
            },
            update => update,
            exit => exit.remove()
        );

    // The highlight of the edge is a thicker, transparent path that lies behind the actual edge
    const edgeBorder = edgeGroups.append("path")
        .attr("class", "edge-border")
        .attr("id", d => `edge-border-${d["___id"]}`)
        .attr("stroke", `rgba(${COLOR_OVER_MOUSER}, 0)`)
        .attr("stroke-width", LINK_BORDER_WIDTH)
        .attr("fill", "none")
        .attr("stroke-linecap", "round");

    // The current edge
    const edge = edgeGroups.append("path")
        .attr("class", "link")
        .attr("stroke", d => `url(#gradient-${d["___id"]})`)
        .attr("stroke-width", 1.5)
        .attr("fill", "none")
        .attr("marker-end", d => `url(#arrowhead-${d["___id"]})`);
    
    // Add the events to the group so that the mouse can interact with it and its children
    edgeGroups
        .on("mouseover", function (event, d) {
            const edgeIds = getEdgePathById(data, d.___id);
            edgeIds.forEach(id => {
                d3.select(`#edge-border-${id}`).attr("stroke", `rgba(${COLOR_OVER_MOUSER_EXT_PATH}, 0.25)`);
            });

            d3.select(this).select(".edge-border").attr("stroke", `rgba(${COLOR_OVER_MOUSER}, 0.75)`);
        })
        .on("mouseout", function (event, d) {
            d3.selectAll(".edge-border").attr("stroke", `rgba(${COLOR_OVER_MOUSER}, 0)`);           
        })
        .on("click", function (event, d) {
            if (event.defaultPrevented) return;

            $(`#propertyBox-${indexId}`).data("prop-type", "edge");
            $(`#propertyBox-${indexId}`).data("type-key", d[svg_config?.mapping?.edge?.type] || "");
            showProperties(indexId, d, svg_config, data);
        })
        .on("mousemove", function(event) {            
            const tooltip = bootstrap.Tooltip.getInstance(this);
            if ((tooltip !== undefined) && tooltip._popper) {
                // 1. Creates a "Virtual Element" that Popper uses as a target.
                const virtualElement = {
                    getBoundingClientRect: () => ({
                        width: 0,
                        height: 0,
                        top: event.clientY,
                        right: event.clientX,
                        bottom: event.clientY,
                        left: event.clientX,
                    }),
                };

                // 2. Update Popper's options with the new reference (the mouse).
                tooltip._popper.setOptions((options) => ({
                    ...options,
                    modifiers: [
                        ...options.modifiers,
                        {
                            name: "offset",
                            options: {
                                offset: [0, 10], // Mouse offset [horizontal, vertical]
                            },
                        },
                    ],
                }));

                // 3. Force Popper to look at the mouse instead of the original element.
                tooltip._popper.state.elements.reference = virtualElement;
                tooltip._popper.update();
            }            
        });

    // ===============================================================
    // Vertices/Nodes
    // ===============================================================
    const vertex = svg.append("g")                
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .selectAll("g")
        .data(vertices, d => d[svg_config?.mapping?.vertex?.id])
        .join(
            enter => {
                const vertexGroup = enter.append("g")
                    .call(drag(simulation));

                // Vertex group events
                vertexGroup
                    // Event click at the vertex
                    .on("click", (event, d) => {
                        if (event.defaultPrevented) return;

                        $("#vertexIcon").val( (svg_config?.vertices[d[svg_config?.mapping?.vertex?.type] || "_"]?.icon?.prefix || "far") + " fa-" + (svg_config?.vertices[d[svg_config?.mapping?.vertex?.type] || "_"]?.icon?.iconName || "file-lines") ).trigger("change");
                        $(`#propertyBox-${indexId}`).data("prop-type", "vertex");
                        $(`#propertyBox-${indexId}`).data("type-key", d[svg_config?.mapping?.vertex?.type] || "_");
                        showProperties(indexId, d, svg_config, data);
                    })
                    // Sets vertex highlight on mouseover.
                    .on("mouseover", function(event, d) {
                        d3.select(this).select("circle")
                            .attr("stroke", `rgba(${COLOR_OVER_MOUSER}, 0.5)`) // Cor da borda
                            .attr("stroke-width", NODE_BORDER_WIDTH); // Largura da borda
                    })
                    // Remove the vertex highlight
                    .on("mouseout", function(event, d) {
                        d3.select(this).select("circle")
                            .attr("stroke", `rgba(${COLOR_OVER_MOUSER}, 0)`) // Original color
                            .attr("stroke-width", 1.5); // Original width
                    })
                    .attr("data-find-text", d => Utils.normalizeText(d[svg_config?.mapping?.vertex?.label] || d[svg_config?.mapping?.vertex?.id]));

                // Vertex circle
                vertexGroup.append("circle")
                    .attr("class", "no-select")
                    .attr("data-vertex-group", d => d[svg_config?.mapping?.vertex?.type] || "_")
                    .attr("stroke", "white")
                    .attr("stroke-width", 1.5)
                    .attr("fill", d => vertexColors(d[svg_config?.mapping?.vertex?.type] || "_"))
                    .attr("r", RADIUS_NODES)                                        
                    .attr("data-bs-toggle", "tooltip")
                    .attr("data-bs-trigger", "hover")
                    .attr("data-bs-animation", "false")
                    .attr("data-bs-html", "true")
                    .attr("title", d => d[svg_config?.mapping?.vertex?.id] + (d[svg_config?.mapping?.vertex?.type] ? "</br>" + d[svg_config?.mapping?.vertex?.type] : ""));

                // Vertex text
                vertexGroup.append("text")
                    .attr("class", "no-select")
                    .attr("x", TEXT_MARGIN)
                    .attr("y", "0.31em")
                    .attr("fill", "gray")
                    .attr("stroke", "gray")
                    .attr("stroke-width", 0.65)                        
                    .text(d => 
                        Utils.truncateText(d[svg_config?.mapping?.vertex?.label] || d[svg_config?.mapping?.vertex?.id], MAX_TEXT_LENGTH)
                    )
                    .style("pointer-events", "none");

                // Vertex icon
                vertexGroup.append("use")
                    .attr("class", "no-select")
                    .attr("xlink:href", d => "#" + (d[svg_config?.mapping?.vertex?.type] || "_"))
                    .attr("width", RADIUS_NODES)
                    .attr("height", RADIUS_NODES)
                    .attr("x", -(RADIUS_NODES / 2))
                    .attr("y", -(RADIUS_NODES / 2))
                    .attr("fill", "white")
                    .style("pointer-events", "none");

                return vertexGroup;
            },
            update => update,
            exit => exit.remove()
        )
        .call(drag(simulation));

    // Updates the visual position of all graph elements on every simulation tick.
    // This listener synchronizes the internal physical coordinates (x, y) 
    // calculated by d3-force with the SVG attributes of vertices, edges, 
    // and gradients.
    simulation.on("tick", () => {
        // Reusable edge path generator for both the main line and its border.
        const edgePathGenerator = createEdgeArc(RADIUS_NODES);

        // Update edge paths (main line and background border for selection).
        edgeBorder.attr("d", edgePathGenerator);
        edge.attr("d", edgePathGenerator);

        // Update vertex positions using a translate transformation.
        vertex.attr("transform", d => `translate(${d.x},${d.y})`);

        // Update linear gradient coordinates to match the moving endpoints.
        edgeGradients
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    });

    return svg.node();
};


/**
 * Classifies and groups edges with the same source and target.
 *
 * This function identifies multiple connections between the same pair of nodes 
 * and enriches each edge object with metadata (unique ID, sequence index, 
 * and total count). This is essential for rendering parallel arcs in 
 * multi-link graphs.
 *
 * @param {!Object} svg_config - Configuration object containing mapping 
 *     definitions for edge source and destination keys.
 * @param {!Array<!Object>} edges - Array of edge objects to be processed.
 * @return {!Array<!Object>} - The enriched array of edges with additional 
 *     properties: ___id, ___num, ___ttl, and ___typ.
 */
const classifyEdges = (svg_config, edges) => {
    const groups = new Map();

    // Group edges by a unique key representing the source-target pair.
    edges.forEach(edge => {
        // Create a unique key based on the configured mapping for src and dst.
        const sourceKey = edge[svg_config?.mapping?.edge?.src || ""] || "";
        const targetKey = edge[svg_config?.mapping?.edge?.dst || ""] || "";
        const key = `${sourceKey}-${targetKey}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(edge);
    });

    // Iterate through each group to assign sequence numbers and total counts.
    groups.forEach(group => {
        const total = group.length;
        group.forEach((edge, index) => {
            // Internal metadata for rendering and identification.
            edge["___id"] = crypto.randomUUID(); // Unique identifier for the edge.
            edge["___num"] = index;               // Sequential index within the group.
            edge["___ttl"] = total;               // Total number of edges in this group.
            edge["___typ"] = "edge";              // Internal type discriminator.
        });
    });

    return edges;
}


/**
 * Main orchestrator for rendering the graph visualization and attaching UI events.
 *
 * This function handles the full lifecycle of the graph: UI injection, 
 * configuration mapping, data cleaning (orphan edge removal), D3 simulation 
 * startup, and the binding of all toolbar actions (Download, Zoom, Refresh).
 *
 * @param {Object} context - The instance context (usually 'this') containing state data.
 * @param {string|number} indexId - Unique identifier for the graph instance.
 * @param {string|jQuery} jqSvgParent - Container for the visualization.
 * @param {!Object} graph_data - Object containing vertex and edge arrays.
 * @return {void}
 */
const showGraphForce = (context, indexId, jqSvgParent, graph_data) => {
    // Immediate return if the application context is undefined.
    if (!context) {
        return;
    }

    // Initialize HTML skeleton (Toolbar and Property Box).
    showGraph_htmlElements(indexId, jqSvgParent);
    $(`#vertices-edges-count-${indexId}`).text(`${graph_data.vertices.length} Vertices, ${graph_data.edges.length} Edges`);

    // Build the configuration object from global application settings.
    const svg_config = (() => {
        try {
            return {
                width: context.Selected.svg_settings.width,
                height: context.Selected.svg_settings.height,
                vertices_distance: context.Selected.svg_settings.min_vertex_distance,
                icon_radius: context.Selected.svg_settings.vertex_size,
                mapping: {
                    vertex: {
                        id: context.Selected.vertex_fields.id,
                        label: context.Selected.vertex_fields.label,
                        type: context.Selected.vertex_fields.type || "_",
                    },
                    edge: {
                        src: "source",
                        dst: "target",
                        type: context.Selected.edge_fields.type || "_",
                    },
                },
                vertices: formatIcon(context.Selected.vertices_types),
                edges: context.Selected.edges_types
            };        
        } catch (error) {
            return undefined;
        }
    })();
    if (!svg_config) return;

    // Data Preparation: Add internal IDs and types.
    graph_data.vertices = graph_data.vertices.map(v => 
        Object.assign(v, {"___id": crypto.randomUUID(), "___typ": "vertex"})
    );
    
    // Normalize edges and group them for parallel arc calculation.
    graph_data.edges = (() => {
        try {
            return formatEdge(
                graph_data.edges, 
                context.Selected.edge_fields.src, 
                context.Selected.edge_fields.dst
            );            
        } catch (error) {
            return [];
        }
    })();
    graph_data.edges = classifyEdges(svg_config, graph_data.edges);

    // Data Integrity: Filter out edges with non-existent source/target nodes.
    const idValidVertices = Array.from(new Set(
        graph_data.vertices.map(n => n[svg_config?.mapping?.vertex?.id])
    ));

    graph_data.edges = graph_data.edges.filter(e => 
        idValidVertices.includes(e.source) && idValidVertices.includes(e.target)
    );

    // Render: Create the D3 SVG and append to the DOM.
    const svg = chartGraphForce(indexId, graph_data, svg_config);
    $(`#d3-tree-${indexId}`).append(svg);

    // Initialize Bootstrap tooltips for the new elements.
    $(".tooltip").hide();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));

    // Initial State: Show properties for the first node and center viewport.
    showProperties(indexId, graph_data?.vertices[0], svg_config, graph_data);
    
    // Centering logic based on scroll availability.
    const centerViewport = () => {
        const container = $(`#d3-tree-${indexId}`);
        container.addClass("justify-content-center align-items-center");
        
        if ((container[0].scrollHeight - container[0].clientHeight) > 0) {
            container.removeClass("align-items-center")
                .scrollTop((container[0].scrollHeight - container[0].clientHeight) / 2);
        }
        if ((container[0].scrollWidth - container[0].clientWidth) > 0) {
            container.removeClass("justify-content-center")
                .scrollLeft((container[0].scrollWidth - container[0].clientWidth) / 2);
        }
    };
    centerViewport();

    // --- Toolbar Event Bindings ---

    /** --- Download Image: Clones SVG, adjusts ViewBox to content bounds, and triggers download --- */
    $(`.btn-svg-${indexId}-download-image`)
        .off("click")
        .on("click", function() {
            const svgElement = document.getElementById(`svgGraphForceViewer-${indexId}`);
            const svgClone = $(svgElement).clone();
            
            // Set dimensions and capture the actual content bounding box.
            $(svgClone).attr("width", svg_config.width).attr("height", svg_config.height);
            const bbox = svgElement.getBBox();
            svgClone.attr("viewBox", `${bbox.x - 100} ${bbox.y - 100} ${bbox.width + 180} ${bbox.height + 180}`);

            const dataString = new XMLSerializer().serializeToString(svgClone[0]);
            const svgBlob = new Blob([dataString], {type: "image/svg+xml;charset=utf-8"});
            const url = URL.createObjectURL(svgBlob);
            
            const downloadLink = document.createElement("a");
            downloadLink.href = url;
            downloadLink.download = `graph_svg_${new Date().toISOString().replace(/[^\d]/g, "").substring(0, 14)}.svg`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        });

    /** --- Download Data: Exports cleaned JSON (removing internal metadata) --- */
    $(`.btn-svg-${indexId}-download-data`)
        .off("click")
        .on("click", function() {
            const jsonObj = JSON.parse(JSON.stringify(context.Queries[`${indexId}`].result));
            
            // Strip internal helper properties before export.
            jsonObj.vertices = jsonObj.vertices?.map(({___id, ___typ, ...rest}) => rest);
            jsonObj.edges = jsonObj.edges?.map(({___id, ___typ, ___num, ___ttl, ...rest}) => rest);
            
            const blob = new Blob([JSON.stringify(jsonObj)], {type: 'application/json;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement("a");
            downloadLink.href = url;
            downloadLink.download = `graph_data_${new Date().toISOString().replace(/[^\d]/g, "").substring(0, 14)}.json`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        });

    /** --- Refresh: Re-renders the graph and resets the UI state --- */
    $(`.btn-svg-${indexId}-refresh`)
        .off("click")
        .on("click", function() {
            $(`#d3-tree-${indexId} #svgGraphForceViewer-${indexId}`).remove();
            const newSvg = chartGraphForce(indexId, graph_data, svg_config);
            $(`#d3-tree-${indexId}`).append(newSvg);
            showProperties(indexId, graph_data?.vertices[0], svg_config, graph_data);
            centerViewport();

            // Initialize Bootstrap tooltips for the new elements.
            $(".tooltip").hide();
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
        });

    /** --- Zoom Controls: Adjusts SVG width/height within defined limits (0.25x to 5x) --- */
    const applyZoom = (factor) => {
        const svgNode = $(`#d3-tree-${indexId} #svgGraphForceViewer-${indexId}`);
        const MAX_ZOOM = 5;
        const MIN_ZOOM = 0.25;
        
        let newWidth = svgNode.width() * factor;
        let newHeight = svgNode.height() * factor;

        // Constraint check.
        newWidth = Math.max(MIN_ZOOM * svg_config.width, Math.min(newWidth, MAX_ZOOM * svg_config.width));
        newHeight = Math.max(MIN_ZOOM * svg_config.height, Math.min(newHeight, MAX_ZOOM * svg_config.height));

        svgNode.attr("width", newWidth).attr("height", newHeight);
        centerViewport();
    };

    $(`.btn-svg-${indexId}-zoom-in`).off("click").on("click", () => applyZoom(1.1));
    $(`.btn-svg-${indexId}-zoom-out`).off("click").on("click", () => applyZoom(0.9));

    /** --- Property Window Toggle Event --- */
    $(`.btn-svg-${indexId}-prop-window`)
        .off("click")
        .on("click", function() {
            const propertyBox = $(`#propertyBox-${indexId}`);
            
            // Toggle visibility of the property panel.
            if (propertyBox.hasClass("d-none")) {
                propertyBox.removeClass("d-none");
            } else {
                propertyBox.addClass("d-none");
            }

            // Align the property box to the top-left corner of the SVG container.
            const position = $(`#d3-tree-${indexId}`).offset();
            propertyBox.offset({ 
                top: position.top + 10, 
                left: position.left + 10 
            });
        });

    /** --- Node Search and Highlighting Events --- */
    $(`#svg-find-node-${indexId}`)
        .off("keydown")
        .on("keydown", function(e) {
            const searchField = $(this);
            const graphElements = $(`#svgGraphForceViewer-${indexId} > g *`);

            // Clear search and reset highlights on Escape key.
            if (e.key === "Escape") {
                searchField.val("");
                graphElements.removeClass("blink");
                return;
            }

            // Execute search on Enter key.
            if (e.key === "Enter") {
                graphElements.removeClass("blink");
                
                // Normalize input text for a case-insensitive, accent-insensitive search.
                const textFind = Utils.normalizeText(searchField.val() || "").trim();
                if (!textFind) {
                    return;
                }

                // Use a case-insensitive [i] attribute selector to find and animate nodes.
                const texts = textFind.split("|");
                texts.forEach(t => {
                    $(`#svgGraphForceViewer-${indexId} > g [data-find-text*="${t.trim()}" i]`)
                        .addClass("blink");
                });
            }
        });
    
    /** --- Clear Search Event --- */
    $(`#svg-clear-find-node-${indexId}`)
        .off("click")
        .on("click", function() {
            // Reset the search input and remove all highlighting animations.
            $(`#svg-find-node-${indexId}`).val("");
            $(`#svgGraphForceViewer-${indexId} > g *`).removeClass("blink");
        });

}


/**
 * @fileoverview Export definitions for the Graph Visualization module.
 * This module provides functions to initialize, render, and manage 
 * interactive d3-force graphs with integrated UI components.
 */

/**
 * Main entry point to render the graph.
 */
export { 
    showGraphForce,
};
