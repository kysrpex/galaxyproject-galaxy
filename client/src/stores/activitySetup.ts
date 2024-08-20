/**
 * List of built-in activities
 */
import { type Activity } from "@/stores/activityStore";
import { type EventData } from "@/stores/eventStore";

export const defaultActivities = [
    {
        anonymous: false,
        description: "Displays currently running interactive tools (ITs), if these are enabled by the administrator.",
        icon: "fa-laptop",
        id: "interactivetools",
        mutable: false,
        optional: false,
        panel: false,
        title: "Interactive Tools",
        tooltip: "Show active interactive tools",
        to: "/interactivetool_entry_points/list",
        visible: true,
    },
    {
        anonymous: true,
        description: "Opens a data dialog, allowing uploads from URL, pasted content or disk.",
        icon: "upload",
        id: "upload",
        mutable: false,
        optional: false,
        panel: false,
        title: "Upload",
        to: null,
        tooltip: "Download from URL or upload files from disk",
        visible: true,
    },
    {
        anonymous: true,
        description: "Displays the tool panel to search and access all available tools.",
        icon: "wrench",
        id: "tools",
        mutable: false,
        optional: false,
        panel: true,
        title: "Tools",
        to: null,
        tooltip: "Search and run tools",
        visible: true,
    },
    {
        anonymous: true,
        description: "Displays a panel to search and access workflows.",
        icon: "sitemap",
        id: "workflows",
        mutable: false,
        optional: true,
        panel: false,
        title: "Workflows",
        to: "/workflows/list",
        tooltip: "Search and run workflows",
        visible: true,
    },
    {
        anonymous: false,
        description: "Displays all workflow runs.",
        icon: "fa-list",
        id: "invocation",
        mutable: false,
        optional: true,
        panel: true,
        title: "Workflow Invocations",
        tooltip: "Show all workflow runs",
        to: null,
        visible: true,
    },
    {
        anonymous: true,
        description: "Displays the list of available visualizations.",
        icon: "chart-bar",
        id: "visualizations",
        mutable: false,
        optional: true,
        panel: true,
        title: "Visualization",
        to: null,
        tooltip: "Visualize datasets",
        visible: true,
    },
    {
        anonymous: true,
        description: "Displays the list of all histories.",
        icon: "fa-hdd",
        id: "histories",
        mutable: false,
        optional: true,
        panel: false,
        title: "Histories",
        tooltip: "Show all histories",
        to: "/histories/list",
        visible: true,
    },
    {
        anonymous: false,
        description: "Displays the history selector panel and opens History Multiview in the center panel.",
        icon: "fa-columns",
        id: "multiview",
        mutable: false,
        optional: true,
        panel: true,
        title: "History Multiview",
        tooltip: "Select histories to show in History Multiview",
        to: "/histories/view_multiple",
        visible: true,
    },
    {
        anonymous: false,
        description: "Displays all of your datasets across all histories.",
        icon: "fa-folder",
        id: "datasets",
        mutable: false,
        optional: true,
        panel: false,
        title: "Datasets",
        tooltip: "Show all datasets",
        to: "/datasets/list",
        visible: true,
    },
    {
        anonymous: true,
        description: "Display and create new pages.",
        icon: "fa-file-contract",
        id: "pages",
        mutable: false,
        optional: true,
        panel: false,
        title: "Pages",
        tooltip: "Show all pages",
        to: "/pages/list",
        visible: true,
    },
    {
        anonymous: false,
        description: "Display Data Libraries with datasets available to all users.",
        icon: "fa-database",
        id: "libraries",
        mutable: false,
        optional: true,
        panel: false,
        title: "Libraries",
        tooltip: "Access data libraries",
        to: "/libraries",
        visible: true,
    },
] as const;

export function convertDropData(data: EventData): Activity | null {
    if (data.history_content_type === "dataset") {
        return {
            anonymous: true,
            description: "Displays this dataset.",
            icon: "fa-file",
            id: `dataset-${data.id}`,
            mutable: true,
            optional: true,
            panel: false,
            title: data.name as string,
            tooltip: "View your dataset",
            to: `/datasets/${data.id}/preview`,
            visible: true,
        };
    }
    if (data.model_class === "StoredWorkflow") {
        return {
            anonymous: false,
            description: data.description as string,
            icon: "fa-play",
            id: `workflow-${data.id}`,
            mutable: true,
            optional: true,
            panel: false,
            title: data.name as string,
            tooltip: data.name as string,
            to: `/workflows/run?id=${data.id}`,
            visible: true,
        };
    }
    return null;
}
