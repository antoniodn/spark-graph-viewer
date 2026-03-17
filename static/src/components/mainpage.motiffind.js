"use strict";

import * as Utils from '../utils/utils.js';
import { showGraphForce } from './graphforce.js';


/**
 * Generates the HTML structure for a new Motif Find query tab header.
 *
 * This function creates a Bootstrap-based navigation item (li) containing
 * a tab button with the query index and a close button to remove the tab.
 *
 * @param {number|string} index The unique index identifying the query tab.
 * @return {!jQuery} A jQuery object representing the tab header element.
 */
function motifFindTab_UI_TabHeader(index) {
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
            $("<span>", {"class": "ms-1"}).append(document.createTextNode(`Motif Find (${index})`)),
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
 * Generates the HTML structure for a new Motif Find query tab content.
 *
 * This function constructs a Bootstrap-based UI panel containing 
 * input fields for graph patterns (motifs), a filter textarea with column 
 * suggestion tools derived from the current data context, and execution 
 * control buttons (Run/Cancel).
 *
 * @param {!Object} context The instance context (usually 'this') containing state data.
 * @param {number|string} index The unique index identifying the query tab.
 * @param {string} job_id The unique job identifier associated with the query.
 * @return {jQuery|undefined} A jQuery object representing the tab pane 
 *     content, or undefined if the context is invalid.
 */
function motifFindTab_UI_TabContent(context, index, job_id) {
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
        "data-query-type": "motiffind",
        "data-query-index": index
    }).append(
        $("<div>", {"class":"p-3","style": "display: table; table-layout: fixed; width: 100%;"})
            .append(
                // --- Motif Expression Row ---
                $("<div>", {"class": "row g-3 mb-3 align-items-center"})
                    .append(
                        $("<div>", {"class": "col-1"})
                            .append($("<label>", {"class": "form-label pt-1"}).append(document.createTextNode("Motif Find"))),
                        $("<div>", {"class": "col"})
                            .append($("<input>", {
                                "type": "text",
                                "class": "form-control font-monospace query-motifExpr-input border border-dark-subtle rounded",
                                "disabled": "",
                                "data-query-index": index,
                                "style": "font-size:0.80rem;"
                            }).val("(v1)-[e1]->(v2)")),
                        $("<div>", {"class": "col-auto d-flex"})
                            .append(
                                // Controls to expand or reduce the motif search distance.
                                $("<button>", {"type": "button", "class": "btn ms-2 border query-add-motif-level border border-dark-subtle", "data-query-index": index, "data-bs-toggle": "tooltip", "data-bs-trigger":"hover", "data-bs-animation":"false", "title": "Add Level"}).append($("<i>", {"class": "fa-solid fa-plus opacity-50"})),
                                $("<button>", {"type": "button", "class": "btn ms-2 border query-subtract-motif-level border border-dark-subtle", "data-query-index": index, "data-bs-toggle": "tooltip", "data-bs-trigger":"hover", "data-bs-animation":"false", "title": "Remove Level"}).append($("<i>", {"class": "fa-solid fa-minus opacity-50"})),
                                $("<div>", {"class": "pt-2", "style": "min-width:85px;"})
                                    .append($("<span>", {"class": "ms-2 fw-lighter fst-italic small query-motif-distance", "data-query-index": index}).append(document.createTextNode("Distance:"))),                        
                            )
                    ),

                // --- Filter and Column Tools Row ---
                $("<div>", {"class": "row g-3 mb-3 align-items-start"})
                    .append(
                        $("<div>", {"class": "col-1"})
                            .append($("<label>", {"class": "form-label pt-1"}).append(document.createTextNode("Filter"))),
                        $("<div>", {"class": "col"})
                            .append($("<textarea>", {
                                "class": "form-control font-monospace query-filter-input border border-dark-subtle rounded",
                                "data-query-index": index,
                                "rows": "6",
                                "style": "min-height:110px;max-height:110px;font-size:0.80rem;"
                            })),
                        $("<div>", {"class": "col-auto"})
                            .append(
                                // Dropdown tool to inject Vertex column names into the filter.
                                $("<div>", {"class": "input-group mb-3"})
                                    .append(
                                        $("<button>", {"class": "btn btn-outline-secondary dropdown-toggle", "type": "button", "data-bs-toggle": "dropdown", "aria-expanded": "false", "style": "min-width:110px;", "data-query-index": index})
                                            .append($("<i>", {"class": "fa-solid fa-circle-user"}), $("<span>", {"class": "ms-2 small"}).append(document.createTextNode("Vertex"))),
                                        $("<ul>", {"class": "dropdown-menu dropdown-menu-end scrollable-list query-column-tool", "data-query-index": index})
                                            .append((function() {
                                                const items = [];
                                                const vertexTable = context.Data.vertices_table || {};
                                                const cols = vertexTable[Object.keys(vertexTable)[0]] || [];
                                                cols.forEach(col => {
                                                    items.push($("<li>", {"type": "button", "class": "dropdown-item small"}).append(document.createTextNode(col)));
                                                });
                                                return items;
                                            })()),
                                    ),
                                // Dropdown tool to inject Edge column names into the filter.
                                $("<div>", {"class": "input-group mb-3"})
                                    .append(
                                        $("<button>", {"class": "btn btn-outline-secondary dropdown-toggle", "type": "button", "data-bs-toggle": "dropdown", "aria-expanded": "false", "style": "min-width:110px;", "data-query-index": index})
                                            .append($("<i>", {"class":"fa-solid fa-arrow-up-long", "style":"transform: rotate(45deg);"}), $("<span>", {"class": "ms-2 small"}).append(document.createTextNode("Edge"))),
                                        $("<ul>", {"class": "dropdown-menu dropdown-menu-end scrollable-list query-column-tool", "data-query-index": index})
                                            .append((function() {
                                                const items = [];
                                                const edgeTable = context.Data.edges_table || {};
                                                const cols = edgeTable[Object.keys(edgeTable)[0]] || [];
                                                cols.forEach(col => {
                                                    items.push($("<li>", {"type": "button", "class": "dropdown-item small"}).append(document.createTextNode(col)));
                                                });
                                                return items;
                                            })()),
                                    ),
                            ),
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
                // Container where the D3 force-directed graph will be injected.
                $("<div>", {"class": "position-relative col m-0 p-0 border border-dark-subtle rounded", "id": `query-${index}-result-visualization`})
            )
    );

    return tabContent;
}


/**
 * Orchestrates the creation and event binding of a new Motif Find query tab.
 *
 * This function validates the required graph configurations, calculates the next 
 * available tab index, injects the UI components (header and content), 
 * and binds all interactive events including motif distance manipulation, 
 * filter shortcuts, and AJAX execution.
 *
 * @param {!Object} context The application state object containing selections, 
 *     mappings, and query history.
 * @return {number|undefined} The index of the newly created tab, or undefined 
 *     if configuration is incomplete.
 */
function motifFindTab(context) {
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
    const tabHeader = motifFindTab_UI_TabHeader(index);
    $(".graphTabHeader").append(tabHeader);

    const job_id = `job_find_${index}_${Date.now()}`;
    const tabContent = motifFindTab_UI_TabContent(context, index, job_id);
    $(".graphTabContent").append(tabContent);

    // Initialize Bootstrap tooltips for the new elements.
    $(".tooltip").hide();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));

    // --- Event Bindings ---

    // Update distance label dynamically on manual input.
    $(".query-motifExpr-input")
        .off("input")
        .on("input", function(e) {
            e.preventDefault();
            const idx = parseInt($(this).data("query-index")) || 1;
            const queryText = $(this).val() || "";
            const expr_sz = queryText.split(";").length;
            $(`#query-${idx}-motifDistance`).text(`Distance: ${expr_sz}`);
        });

    // Handle Ctrl+Enter shortcut in the filter textarea to trigger execution.
    $(".query-filter-input")
        .off("keydown")
        .on("keydown", function(e) {
            if (e.ctrlKey && e.key === "Enter") {
                e.preventDefault();
                const idx = parseInt($(this).data("query-index")) || 1;
                $(`.btn-execute-command[data-query-index=${idx}]`).trigger("click");
            }
        });

    // Column Tool: Inject clicked column name into the current cursor position.
    $(".query-column-tool > .dropdown-item")
        .off("click")
        .on("click", function() {
            const idx = parseInt($(this).closest(".query-column-tool").data("query-index")) || 1;
            const col_name = $(this).text();
            const filterEl = $(`.query-filter-input[data-query-index=${idx}]`)[0];
            
            // Native API to insert text at cursor position.
            filterEl.setRangeText(col_name, filterEl.selectionStart, filterEl.selectionEnd, 'end');
            filterEl.focus();
        });

    // Level Controls: Expand or contract the motif pattern (e.g., v1->v2 to v1->v2->v3).
    $(".query-add-motif-level, .query-subtract-motif-level")
        .off("click")
        .on("click", function() {
            const isAdd = $(this).hasClass("query-add-motif-level");
            const OP_SHIFT = isAdd ? 1 : -1;
            const idx = parseInt($(this).data("query-index")) || 1;
            const $sel_motif = $(`.query-motifExpr-input[data-query-index=${idx}]`);
            const motif_current = $sel_motif.val() || "";
            
            let expr_sz = motif_current ? motif_current.split(";").length + OP_SHIFT - 1 : 0;
            expr_sz = Math.max(0, expr_sz);

            // Generate the new Cypher-like motif string.
            const motif_new = [...Array(expr_sz + 1).keys()]
                .map(i => `(v${i+1})-[e${i+1}]->(v${i+2})`)
                .join(" ; ");

            // Limit maximum search depth to prevent browser/server hanging.
            if (expr_sz < 9) {
                $sel_motif.val(motif_new);
                $(`.query-motif-distance[data-query-index=${idx}]`).text(`Distance: ${expr_sz + 1}`);
            }
            
            $sel_motif.focus();
            $sel_motif[0].setSelectionRange(motif_new.length, motif_new.length);
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
                
                motif_expression: $(`.query-motifExpr-input[data-query-index=${idx}]`).val(),
                filter_clause: $(`.query-filter-input[data-query-index=${idx}]`).val(),

                global_filter_vertex: AppSparkGraph?.Data?.filters.vertex,
                global_filter_edge: AppSparkGraph?.Data?.filters.edge
            };

            $(".alert-message").text("Wait, query is running...");
            $(".alert-message, .alert-message-border").removeClass("d-none");
            $(`.btn-cancel-command[data-query-index="${idx}"]`).prop('disabled', false);

            $.ajax({
                type: "GET",
                url: `./api/graph/find`,
                data: $.param(api_params),
                contentType: "application/x-www-form-urlencoded; charset=utf-8",
                success: function(result) {
                    if (!result || typeof result !== 'object') return;

                    const $msg = $(`.query-message[data-query-index="${idx}"]`);
                    $msg.removeClass("text-danger")
                        .text(`Last execute at: ${new Date().toISOString()}`);

                    // Initialize context query storage if not present.
                    if (!context.Queries || typeof context.Queries !== 'object') {
                        context.Queries = {};
                    }

                    // Save result for future persistence (notebook).
                    context.Queries[`${idx}`] = {
                        type: "motiffind",
                        motif: api_params.motif_expression,
                        filter: api_params.filter_clause,
                        result: result,
                    };

                    // Trigger SVG rendering.
                    showGraphForce(context, idx, $(`#query-${idx}-result-visualization`), result);
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
 * @fileoverview Export definitions for the Motif Query Management module.
 * Provides the public API to instantiate and manage interactive graph 
 * search tabs within the application.
 */

/**
 * Main entry point to create and initialize a new Motif Find tab.
 */
export {
    /** @see motifFindTab */
    motifFindTab,
};