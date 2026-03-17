/**
 * @fileoverview Main entry point for the Spark Graph application.
 * Orchestrates the integration between state management, UI components,
 * and graph query modules.
 */

"use strict";

import * as MainPage from './src/components/mainpage.js';
import * as MotifFind from './src/components/mainpage.motiffind.js';
import * as PathsFind from './src/components/mainpage.paths.js';
import * as TriangulationFind from './src/components/mainpage.triangulation.js';

/**
 * Main class representing the Spark Graph application instance.
 * 
 * This class initializes the global state and binds project lifecycle 
 * methods (Load, Save, Read, New) and query modules to its context.
 */
export default class AppSparkGraphClass {

    /**
     * Initializes a new instance of the AppSparkGraphClass.
     * 
     * Sets up the initial data structure and injects dependencies 
     * from the MainPage and MotifFind modules.
     */
    constructor() {
        // Initializes the base state and merges it into 'this'
        const initialState = MainPage.createInitialState();
        Object.assign(this, initialState);

        // Bind project lifecycle and UI methods to the class instance
        this.MainPage = {
            /** @see MainPage.loadCatalog */
            loadCatalog: () => { MainPage.loadCatalog(this) },
            /** @see MainPage.fileSaveGraphNotebook */
            fileSaveGraphNotebook: () => { MainPage.fileSaveGraphNotebook(this) },
            /** @see MainPage.fileReadGraphNotebook */
            fileReadGraphNotebook: () => { MainPage.fileReadGraphNotebook(this) },
            /** @see MainPage.newGraphNotebook */
            newGraphNotebook: () => { MainPage.newGraphNotebook(this) },
            /** @see MotifFind.motifFindTab */
            motifFindTab: () => { MotifFind.motifFindTab(this) },
            /** @see MotifFind.motifFindTab */
            pathsTab: (typePath) => {
                const validatedtypePath = ["allpaths","shortestpath"].includes(typePath) ? typePath : "allpaths";
                PathsFind.pathsTab(this, validatedtypePath);
            },
            /** @see TriangulationFind.triangulationTab */
            triangulationTab: () => { TriangulationFind.triangulationTab(this) },
        };
    }
}
