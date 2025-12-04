export { };

declare global {
    interface Window {
        vscodeApi: any;
        tableViewFetcher: any;
        boardViewFetcher: any;
        overviewFetcher: any;
        roadmapViewFetcher: any;
        contentFetcher: any;
        filterBarHelper: any;
        __APP_MESSAGING__: any;
        __project_data__: any;
        __gh_update_debug__: any;
    }
}
