"use strict";

import * as Utils from '../utils/utils.js';
import { pathsTab } from './mainpage.paths.js';


/**
 * Generates the HTML structure for a new triangulation query (All/Shortest) tab header.
 *
 * This function creates a Bootstrap-based navigation item (li) containing
 * a tab button with the query index and a close button to remove the tab.
 *
 * @param {number|string} index The unique index identifying the query tab.
 * @return {!jQuery} A jQuery object representing the tab header element.
 */
function triangulationTab_UI_TabHeader(index) {
    // Construct the navigation item container with accessibility attributes.
    let tabHeader = $("<li>", {
        "class": "nav-item query-tab-header",
        "id": `query-tab-header-${index}`,
        "role": "presentation",
        "data-query-index": index
    }).append(
        // Create the main tab button linked to its corresponding content pane.
        $("<button>", {
            "class": "nav-link px-4 py-2 tab-query",
            "id": `query-${index}-tab`,
            "data-bs-toggle": "tab",
            "data-bs-target": `#query-${index}`,
            "type": "button",
            "role": "tab",
            "aria-controls": `query-${index}`,
            "aria-selected": "false",
            "data-query-index": index
        }).append(
            // Display the tab title with the specific query instance number.
            $("<span>", {"class": "ms-1"}).append(document.createTextNode(`Triangulation (${index})`)),
            // Attach a close button to allow the user to remove the tab from the UI.
            $("<button>", {
                "type": "button",
                "class": "btn m-0 p-0 ms-2 opacity-50 query-tab-header-close",
                "data-query-index": index
            }).append($("<i>", {"class": "fa-regular fa-circle-xmark"}))
        )
    );

    return tabHeader;
}


/**
 * Generates the HTML structure for a new Triangulation query tab content.
 *
 * This function constructs a Bootstrap-based UI panel containing 
 * input fields for graph patterns (triangulation), a filter fromExpr with column 
 * suggestion tools derived from the current data context, a filter 
 * edgesExpr with column suggestion tools derived from the current data context,
 * a filter Max Distance, and execution control buttons (Run/Cancel).
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @param {number|string} index The unique index identifying the query tab.
 * @param {string} job_id The unique job identifier associated with the query.
 * @return {jQuery|undefined} A jQuery object representing the tab pane 
 *     content, or undefined if the context is invalid.
 */
function triangulationTab_UI_TabContent(context, index, job_id) {
    // Immediate return if the application context or data metadata is missing.
    if (!context || !context.Data) {
        return;
    }

    // Main tab pane container with accessibility and layout attributes.
    let tabContent = $("<div>", {
        "class": "tab-pane container-fluid fade p-3 query-tab-content",
        "id": `query-${index}`,
        "role": "tabpanel",
        "aria-labelledby": `query-${index}-tab`,
        "data-query-type": "triangulation",
        "data-query-index": index
    }).append(
        $("<div>", {"class":"p-3","style": "display: table; table-layout: fixed; width: 100%;"})
            .append(

                // --- From Vertex Expression Field Row ---
                $("<div>", {"class":"row g-3 mb-3 align-items-center"})
                    .append(
                        $("<div>", {"class":"col m-0 p-0","style":"max-width: 150px;"})
                            .append(
                                $("<label>", {"class":"form-label pb-3"}).append(document.createTextNode("From Vertex"))),
                        $("<div>", {"class":"col m-0 p-0 d-flex"})
                            .append(
                                // Dropdown tool to inject Vertex column names into the filter.
                                $("<div>", {"class":"input-group mb-3 border border-dark-subtle rounded"})
                                    .append(
                                        $("<input>", {"type":"text","class":"form-control font-monospace triangulation-fromExpr-input","maxlength":"2048","aria-label":"From Vertex","style":"font-size:0.80rem;","data-query-index": index}),
                                        $("<button>", {"class":"btn btn-outline-secondary dropdown-toggle border-0","type":"button","data-bs-toggle":"dropdown","aria-expanded":"false","data-query-index": index})
                                            .append($("<i>", {"class":"fa-solid fa-circle-user"})),
                                        $("<ul>", {"class":"dropdown-menu dropdown-menu-end scrollable-list query-column-tool","data-query-index": index})
                                            .append((function() {
                                                const items = [];
                                                const vertexTable = context.Data.vertices_table || {};
                                                const cols = vertexTable[Object.keys(vertexTable)[0]] || [];
                                                cols.forEach(col => {
                                                    items.push($("<li>", {"type": "button", "class": "dropdown-item small"}).append(document.createTextNode(col)));
                                                });
                                                return items;
                                            })()),
                                    )
                            )
                    ),

                // --- Edge To Expression Field Row ---
                $("<div>", {"class":"row g-3 mb-3 align-items-center"})
                    .append(
                        $("<div>", {"class":"col m-0 p-0","style":"max-width: 150px;"})
                            .append($("<label>", {"class":"form-label pb-3"}).append(document.createTextNode("Edges Filter"))),
                        $("<div>", {"class":"col m-0 p-0 d-flex"})
                            .append(
                                $("<div>", {"class":"input-group mb-3 border border-dark-subtle rounded"})
                                    .append(
                                        $("<input>", {"type":"text","class":"form-control font-monospace triangulation-edgeExpr-input","maxlength":"2048","aria-label":"Edges Filter","style":"font-size:0.80rem;","data-query-index": index}),
                                        $("<button>", {"class":"btn btn-outline-secondary dropdown-toggle border-0","type":"button","data-bs-toggle":"dropdown","aria-expanded":"false","data-query-index": index})
                                            .append($("<i>", {"class":"fa-solid fa-arrow-up-long", "style":"transform: rotate(45deg);"})),
                                        $("<ul>", {"class":"dropdown-menu dropdown-menu-end scrollable-list query-column-tool","data-query-index": index})
                                            .append((function() {
                                                const items = [];
                                                const edgeTable = context.Data.edges_table || {};
                                                const cols = edgeTable[Object.keys(edgeTable)[0]] || [];
                                                cols.forEach(col => {
                                                    items.push($("<li>", {"type": "button", "class": "dropdown-item small"}).append(document.createTextNode(col)));
                                                });
                                                return items;
                                            })()),
                                    )
                            )
                    ),

                // --- Filter and Column Tools Row ---
                $("<div>", {"class":"row g-3 mb-3 align-items-center"})
                    .append(
                        $("<div>", {"class":"col m-0 p-0","style":"max-width: 150px;"})
                            .append($("<label>", {"class":"form-label pt-1"}).append(document.createTextNode("Max Distance"))),
                        $("<div>", {"class":"col m-0 p-0 d-flex"})
                            .append(
                                $("<input>", {
                                    "type":"number",
                                    "class":"px-2 py-2 border border-dark-subtle rounded triangulation-max-distance-input",
                                    "placeholder":"3",
                                    "step":"1",
                                    "min":"1",
                                    "max":"10",
                                    "maxlength":"2",
                                    "value":"3",
                                    "oninput":`if(this.value.length > this.maxLength) this.value = this.value.slice(0, this.maxLength);
                                        if(this.value !== "") {
                                            if(parseInt(this.value) > parseInt(this.max)) this.value = this.max;
                                            if(parseInt(this.value) < parseInt(this.min)) this.value = this.min;
                                        }`,
                                    "data-query-index": index
                                }).val("3")
                            )
                    ),

                // --- Execution Controls Row ---
                $("<div>", {"class": "row g-3 mb-3 align-items-start"})
                    .append(
                        $("<div>", {"class": "col-1"}),
                        $("<div>", {"class": "col d-flex gap-5 align-items-center"})
                            .append(
                                // Button to trigger the graph query execution.
                                $("<button>", {"class": "btn btn-success btn-run px-3 btn-execute-command align-items-center text-nowrap", "type": "button", "data-query-index": index, "data-job-id": job_id})
                                    .append($("<i>", {"class": "fa-solid fa-circle-play"}), $("<span>", {"class": "mx-4"}).append(document.createTextNode("Run"))),
                                // Button to cancel the currently running query job.
                                $("<button>", {"class": "btn btn-danger btn-cancel px-3 btn-cancel-command align-items-center text-nowrap", "type": "button", "disabled": true, "data-query-index": index, "data-job-id": job_id})
                                    .append($("<i>", {"class": "fa-solid fa-circle-xmark"}), $("<span>", {"class": "mx-4"}).append(document.createTextNode("Cancel"))),
                                // Placeholder for status or error messages.
                                $("<span>", {"class": "m-0 p-0 fst-italic small opacity-50 query-message overflow-auto", "style": "font-size:0.80rem;max-height:90px;", "id": `query-${index}-message`, "data-query-index": index}),
                            ),
                    ),

                // --- Results Visualization Area ---
                // Container where the table result will be injected.
                $("<div>", {"class": "position-relative col m-0 p-0 border border-dark-subtle rounded", "id": `query-${index}-result-visualization`})
            )
    );

    return tabContent;
}


/**
 * Renders a triangulation data table and appends it to a parent container.
 *
 * @param {Object} context The application context containing state and metadata.
 * @param {number|string} idx Unique index used for generating element IDs.
 * @param {jQuery|HTMLElement} jqSvgParent The parent element where the table will be appended.
 * @param {Object} data The data object containing triangulation details.
 * @return {void}
 */
function showTriangulationTable(context, idx, jqSvgParent, data) {
    // Immediate return if the application context or essential data metadata is missing.
    if (!context || !context.Data) {
        return;
    }

    // Create the main table structure with Bootstrap classes for styling.
    let tabContent = $("<table>", {"class": "table mt-4"})
        .append(
            $("<thead>")
                .append(
                    $("<tr>")
                        .append(
                            $("<th>", {"scope": "col", "class": "align-middle", "style": "width: 150px;"}).append(document.createTextNode("user_id")),
                            $("<th>", {"scope": "col", "class": "align-middle", "style": "width: 120px;"}).append(document.createTextNode("Occurrences")),
                            $("<th>", {"scope": "col", "class": "align-middle", "style": "width: 120px;"}).append(document.createTextNode("Max Dist")),
                            $("<th>", {"scope": "col", "class": "align-middle"}).append(document.createTextNode("Vertex"))
                        )
                ),
            $("<tbody>")
                .append(
                    (() => {
                        // Validate if triangulation data is present and is an array.
                        if (!data.hasOwnProperty("triangulation") || !Array.isArray(data.triangulation)) {
                            return;
                        }

                        // sort result
                        data.triangulation.sort((a, b) => b.occurrences - a.occurrences);

                        let rows = [];
                        data.triangulation.forEach((d, row_idx) => {
                            // Construct each row with triangulation metrics and detailed vertex information.
                            rows.push(
                                $("<tr>")
                                    .append(
                                        $("<td>").append($("<span>", {"role": "button", "class": "text-truncate text-primary triangulation-id-link", "data-max-distance": d.max_distance}).append(document.createTextNode(d.id || "-"))),
                                        $("<td>").append(document.createTextNode(d.occurrences)),
                                        $("<td>").append(document.createTextNode(d.max_distance)),
                                        $("<td>")
                                            .append(
                                                // Nested accordion for displaying complex vertex properties without cluttering the view.
                                                $("<div>", {"class": "accordion accordion-flush m-0 p-0", "id": `vertex-detail-row-${idx}-${row_idx}`})
                                                    .append(
                                                        $("<div>", {"class": "accordion-item m-0 p-0"})
                                                            .append(
                                                                $("<div>", {"class": "accordion-header"})
                                                                    .append(
                                                                        $("<button>", {"class": "accordion-button collapsed m-0 p-0", "type": "button", "data-bs-toggle": "collapse", "data-bs-target": `#collapse-row-${idx}-${row_idx}`, "aria-expanded": "false", "aria-controls": `#collapse-row-${idx}-${row_idx}`})
                                                                            .append($("<span>", {"class": "small"}).append(document.createTextNode(d.vertex[context.Selected.vertex_fields.label] || "Vertex Content")))
                                                                    ),
                                                                $("<div>", {"id": `collapse-row-${idx}-${row_idx}`, "class": "accordion-collapse collapse", "data-bs-parent": `#vertex-detail-row-${idx}-${row_idx}`})
                                                                    .append(
                                                                        $("<div>", {"class": "accordion-body small m-0 p-2"})
                                                                            .append(
                                                                                ((obj) => {
                                                                                    // Map each key-value pair from the vertex object into styled paragraph elements.
                                                                                    let info = [];
                                                                                    Object.keys(obj).forEach(k => {
                                                                                        info.push($("<p>", {"class": "m-0 p-0"}).append($("<strong>", {"class": "text-truncate me-2"}).append(document.createTextNode(k + ":")), document.createTextNode(obj[k])))
                                                                                    });
                                                                                    return info;
                                                                                })(d.vertex)
                                                                            )
                                                                    )
                                                            )
                                                    )
                                            )
                                    )
                            )
                        });

                        return rows;
                    })()
                )
        );

    // Clear previous content and render the new table into the DOM.
    $(jqSvgParent).empty().append(tabContent);


    // Column Tool: Inject clicked column name into the current cursor position.
    $(".triangulation-id-link")
        .off("click")
        .on("click", function() {
            const id = $(this).text();
            const max_distance = $(this).data("max-distance")
            const index = pathsTab(context, "allpaths");

            // Update UI inputs for each query tab.
            $(`.paths-fromExpr-input[data-query-index=${index}]`).val(`${context.Selected.vertex_fields.id} = "${id}"`);
            $(`.paths-toExpr-input[data-query-index=${index}]`).val(`${context.Selected.vertex_fields.id} = "${id}"`);
            $(`.paths-edgeExpr-input[data-query-index=${index}]`).val("");
            $(`.paths-max-distance-input[data-query-index=${index}]`).val(max_distance);

            // Execute All Paths query to item
            $(`.btn-execute-command[data-query-index=${index}]`).trigger("click");
        });
}



/**
 * Orchestrates the creation and event binding of a new triangulation query (All/Shortest) tab.
 *
 * This function validates the required graph configurations, calculates the next 
 * available tab index, injects the UI components (header and content), 
 * and binds all interactive events including filters, 
 * maximun distance, and AJAX execution.
 *
 * @param {!Object} context The application state object containing selections, 
 *     mappings, and query history.
 * @return {number|undefined} The index of the newly created tab, or undefined 
 *     if configuration is incomplete.
 */
function triangulationTab(context) {
    // --- Pre-validation ---
    // Ensure all mandatory datasource and style settings are defined.
    const selected = context.Selected;
    if (!selected.catalog || !selected.schema || !selected.vertices_table || 
        !selected.edges_table || !selected.vertex_fields.id || 
        !selected.vertex_fields.label || !selected.edge_fields.src || 
        !selected.edge_fields.dst || !selected.vertices_types || !selected.edges_types
    ) {
        return;
    }

    // --- Tab Indexing ---
    // Calculate the next unique index based on existing tab headers.
    let index = Math.max(...$('.query-tab-header').map(function() { 
        return $(this).data("query-index"); 
    }).get());
    index = (index === -Infinity) ? 1 : index + 1;

    // --- UI Injection ---
    const tabHeader = triangulationTab_UI_TabHeader(index);
    $(".graphTabHeader").append(tabHeader);

    const job_id = `job_find_${index}_${Date.now()}`;
    const tabContent = triangulationTab_UI_TabContent(context, index, job_id);
    $(".graphTabContent").append(tabContent);

    // Initialize Bootstrap tooltips for the new elements.
    $(".tooltip").hide();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));

    // --- Event Bindings ---

    // Column Tool: Inject clicked column name into the current cursor position.
    $(".query-column-tool > .dropdown-item")
        .off("click")
        .on("click", function() {
            const idx = parseInt($(this).closest(".query-column-tool").data("query-index")) || 1;
            const col_name = $(this).text();
            const filterEl = $(this).closest("div").find("input")[0];
            
            // Native API to insert text at cursor position.
            filterEl.setRangeText(col_name, filterEl.selectionStart, filterEl.selectionEnd, 'end');
            filterEl.focus();
        });

    // Execution: Sends the motif and filter to the API and renders the resulting graph.
    $(`.btn-execute-command[data-query-index=${index}]`)
        .off("click")
        .on("click", function() {
            $(".btn-execute-command").prop("disabled", true);
            $(".btn-cancel-command").prop('disabled', true);
            const idx = parseInt($(this).data("query-index")) || 1;
            
            const api_params = {
                job_id: $(this).data("job-id"),
                vertices_table: context.Selected.vertices_table,
                edges_table: context.Selected.edges_table,
                col_vertex_id: context.Selected.vertex_fields.id,
                col_edge_src: context.Selected.edge_fields.src,
                col_edge_dst: context.Selected.edge_fields.dst,

                fromExpr: $(`.triangulation-fromExpr-input[data-query-index=${idx}]`).val(),
                max_distance: parseInt($(`.triangulation-max-distance-input[data-query-index=${idx}]`).val()),
                edgeExpr: $(`.triangulation-edgeExpr-input[data-query-index=${idx}]`).val() || undefined,

                global_filter_vertex: AppSparkGraph?.Data?.filters.vertex,
                global_filter_edge: AppSparkGraph?.Data?.filters.edge
            };

            $(".alert-message").text("Wait, query is running...");
            $(".alert-message, .alert-message-border").removeClass("d-none");
            $(`.btn-cancel-command[data-query-index="${idx}"]`).prop('disabled', false);

            $.ajax({
                type: "GET",
                url: "./api/graph/triangulation",
                data: $.param(api_params),
                contentType: "application/x-www-form-urlencoded; charset=utf-8",
                success: function(result) {
                    if (!result || typeof result !== "object") return;

                    const $msg = $(`.query-message[data-query-index="${idx}"]`);
                    $msg.removeClass("text-danger")
                        .text(`Last execute at: ${new Date().toISOString()}`);

                    // Initialize context query storage if not present.
                    if (!context.Queries || typeof context.Queries !== "object") {
                        context.Queries = {};
                    }

                    // Save result for future persistence (notebook).
                    context.Queries[`${idx}`] = {
                        type: "triangulation",
                        fromExpr: api_params.fromExpr,
                        max_distance: api_params.max_distance,
                        edgeExpr: api_params.edgeExpr,
                        result: result,
                    };

                    // Trigger table result rendering.
                    showTriangulationTable(context, idx, $(`#query-${idx}-result-visualization`), result);
                },
                error: function(xhr, status, error) {
                    const errorData = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                    const $msg = $(`.query-message[data-query-index="${idx}"]`);
                    $msg.addClass("text-danger")
                        .text(`Error: ${Utils.truncateText(errorData.detail) || error}`);
                },
                complete: function() {
                    $(".alert-message, .alert-message-border").addClass("d-none");
                    $(".btn-execute-command").prop('disabled', false);
                    $(".btn-cancel-command").prop('disabled', true);
                }
            });
        });

    // Execution: Cancels the previous API call.
    $(`.btn-cancel-command[data-query-index=${index}]`)
        .off("click")
        .on("click", function() {
            $(".btn-execute-command").prop("disabled", true);
            $(".btn-cancel-command").prop('disabled', true);
            const idx = parseInt($(this).data("query-index")) || 1;
            
            const api_params = {
                job_id: $(this).data("job-id")
            };

            $(".alert-message").text("Wait, query is canceling...");
            $(".alert-message, .alert-message-border").removeClass("d-none");

            $.ajax({
                type: "GET",
                url: `./api/graph/cancel`,
                data: $.param(api_params),
                contentType: "application/x-www-form-urlencoded; charset=utf-8",
                success: function(result) {
                    const $msg = $(`.query-message[data-query-index="${idx}"]`);
                    $msg.removeClass("text-danger")
                        .text(`Canceled at: ${new Date().toISOString()}`);
                },
                error: function(xhr, status, error) {
                    const errorData = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                    const $msg = $(`.query-message[data-query-index="${idx}"]`);
                    $msg.addClass("text-danger")
                        .text(`Error: ${Utils.truncateText(errorData.detail) || error}`);
                },
                complete: function() {
                    $(".alert-message, .alert-message-border").addClass("d-none");
                    $(".btn-execute-command").prop('disabled', false);
                    $(".btn-cancel-command").prop('disabled', true);
                }
            });
        });

    // Close Tab: Cleans up the context memory and removes UI elements.
    $(".query-tab-header-close")
        .off("click")
        .on("click", function() {
            const idx = parseInt($(this).data("query-index")) || 1;
            
            // Switch back to the main datasource tab before deletion.
            const triggerEl = document.querySelector('.graphTabHeader .datasourceHeaderTab button');
            bootstrap.Tab.getOrCreateInstance(triggerEl).show();

            delete context.Queries[`${idx}`];
            $(`#query-tab-header-${idx}`).remove();
            $(`#query-${idx}`).remove();
        });

    // Automatic focus on the newly created tab.
    const createdEl = $(`#query-tab-header-${index} button`)[0];
    bootstrap.Tab.getOrCreateInstance(createdEl).show();

    return index;
}


/**
 * @fileoverview Export definitions for the triangulation (All / Shortest) Management module.
 * Provides the public API to instantiate and manage interactive graph 
 * search tabs within the application.
 */

/**
 * Main entry point to create and initialize a new Motif Find tab.
 */
export {
    /** @see triangulationTab */
    triangulationTab,
    /** @see showTriangulationTable */
    showTriangulationTable,
};